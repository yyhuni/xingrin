"""
扫描控制服务

职责：
- 停止扫描（docker kill 强制杀死）
- 删除扫描（两阶段删除）
"""

import logging
import threading
from typing import Dict, List
from django.db import transaction, connection
from django.db.utils import DatabaseError, OperationalError
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone

from apps.common.definitions import ScanStatus
from apps.scan.repositories import DjangoScanRepository

logger = logging.getLogger(__name__)


class ScanControlService:
    """
    扫描控制服务
    
    职责：
    - 停止扫描（取消 Flow Run）
    - 删除扫描（两阶段删除）
    - 批量操作
    """
    
    def __init__(self):
        """
        初始化服务
        """
        self.scan_repo = DjangoScanRepository()

    def _stop_containers(
        self, 
        container_ids: List[str],
        worker_id: int,
    ) -> int:
        """
        在指定 Worker 上停止 Docker 容器
        
        Args:
            container_ids: 容器 ID 列表
            worker_id: Worker 节点 ID
            
        Returns:
            成功停止的数量
        """
        if not container_ids:
            return 0
        
        from apps.engine.models import WorkerNode
        
        try:
            worker = WorkerNode.objects.get(id=worker_id)
        except WorkerNode.DoesNotExist:
            logger.error(f"Worker 不存在: {worker_id}")
            return 0
        
        # 构建 docker kill 命令（强制杀死，避免进程不响应 SIGTERM）
        container_ids_str = ' '.join(container_ids)
        docker_cmd = f"docker kill {container_ids_str} 2>/dev/null || true"
        
        stopped_count = 0
        
        if worker.is_local:
            # 本地执行
            import subprocess
            try:
                result = subprocess.run(
                    docker_cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                # 统计成功停止的容器数（输出的每一行是一个成功停止的容器 ID）
                if result.stdout:
                    stopped_count = len(result.stdout.strip().split('\n'))
                logger.info(f"本地 docker kill 完成: {stopped_count}/{len(container_ids)}")
            except Exception as e:
                logger.error(f"本地 docker kill 失败: {e}")
        else:
            # 远程通过 SSH 执行
            import paramiko
            ssh = None
            try:
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                ssh.connect(
                    hostname=worker.ip_address,
                    port=worker.ssh_port,
                    username=worker.username,
                    password=worker.password if worker.password else None,
                    timeout=10,
                )
                
                stdin, stdout, stderr = ssh.exec_command(docker_cmd, timeout=30)
                output = stdout.read().decode().strip()
                if output:
                    stopped_count = len(output.split('\n'))
                logger.info(f"SSH docker kill 完成 - Worker: {worker.name}, 数量: {stopped_count}/{len(container_ids)}")
            except Exception as e:
                logger.error(f"SSH docker kill 失败 - Worker: {worker.name}: {e}")
            finally:
                if ssh:
                    ssh.close()
        
        return stopped_count

    def delete_scans_two_phase(self, scan_ids: List[int]) -> dict:
        """
        两阶段删除扫描任务
        
        流程：
        1. 软删除：立即更新 deleted_at 字段（同步，快速）
        2. 后台异步：停止容器 + 分发硬删除任务（不阻塞 API）
        
        Args:
            scan_ids: 扫描任务 ID 列表
            
        Returns:
            删除结果统计
        """
        # 1. 获取要删除的 Scan 信息
        scans = list(self.scan_repo.get_all(prefetch_relations=False).filter(id__in=scan_ids))
        if not scans:
            raise ValueError("未找到要删除的 Scan")
            
        scan_names = [f"Scan #{s.id}" for s in scans]
        existing_ids = [s.id for s in scans]
        
        # 2. 收集需要停止的容器信息（同步收集，异步执行）
        containers_by_worker: Dict[int, List[str]] = {}
        for scan in scans:
            if scan.status in [ScanStatus.RUNNING, ScanStatus.INITIATED]:
                if scan.container_ids and scan.worker_id:
                    if scan.worker_id not in containers_by_worker:
                        containers_by_worker[scan.worker_id] = []
                    containers_by_worker[scan.worker_id].extend(scan.container_ids)
        
        # 3. 第一阶段：软删除（同步，快速）
        soft_count = self.scan_repo.soft_delete_by_ids(existing_ids)
        logger.info(f"✓ 软删除完成: {soft_count} 个 Scan")
        
        # 4. 第二阶段：后台异步执行停止容器 + 硬删除（不阻塞 API）
        thread = threading.Thread(
            target=self._async_cleanup_and_hard_delete,
            args=(existing_ids, containers_by_worker),
            daemon=True,
        )
        thread.start()
            
        return {
            'soft_deleted_count': soft_count,
            'scan_names': scan_names,
            'hard_delete_scheduled': True,
        }
    
    def _async_cleanup_and_hard_delete(
        self,
        scan_ids: List[int],
        containers_by_worker: Dict[int, List[str]]
    ):
        """
        后台线程：停止容器 + 分发硬删除任务
        """
        # 后台线程需要新的数据库连接
        connection.close()
        
        # 1. 停止容器
        if containers_by_worker:
            total_containers = sum(len(c) for c in containers_by_worker.values())
            logger.info(f"🛑 后台停止容器 - Worker 数量: {len(containers_by_worker)}, 容器数量: {total_containers}")
            stopped_count = 0
            for worker_id, container_ids in containers_by_worker.items():
                try:
                    count = self._stop_containers(container_ids, worker_id)
                    stopped_count += count
                except Exception as e:
                    logger.warning(f"停止容器时出错 - Worker ID {worker_id}: {e}")
            logger.info(f"✓ 已停止 {stopped_count}/{total_containers} 个容器")
        
        # 2. 分发硬删除任务
        try:
            from apps.engine.services.task_distributor import get_task_distributor
            
            distributor = get_task_distributor()
            success, message, container_id = distributor.execute_delete_task(
                task_type='scans',
                ids=scan_ids
            )
            
            if success:
                logger.info(f"✓ 硬删除任务已分发 - Container: {container_id}")
            else:
                logger.warning(f"硬删除任务分发失败: {message}")
            
        except Exception as e:
            logger.error(f"❌ 分发删除任务失败: {e}", exc_info=True)
    
    def stop_scan(self, scan_id: int) -> tuple[bool, int]:
        """
        主动停止扫描任务（用户发起）
        
        工作流程：
        1. 验证扫描状态（只能停止 RUNNING/INITIATED）
        2. 通过 docker kill 强制终止容器
        3. 立即更新状态为 CANCELLED（终态）
        
        Args:
            scan_id: 扫描任务 ID
        
        Returns:
            (是否成功, 停止的容器数量)
        
        并发安全：
            使用数据库行锁（select_for_update）防止并发修改，
            避免用户重复点击导致的重复操作
        """
        try:
            # 1. 在事务内获取扫描对象、检查状态、更新状态（加锁，防止并发）
            with transaction.atomic():
                # 使用 select_for_update() 加行锁，防止并发修改
                scan = self.scan_repo.get_by_id_for_update(scan_id)
                if not scan:
                    logger.error("Scan 不存在 - Scan ID: %s", scan_id)
                    return False, 0
                
                # 2. 验证状态（只能停止 RUNNING/INITIATED）
                if scan.status not in [ScanStatus.RUNNING, ScanStatus.INITIATED]:
                    logger.warning(
                        "无法停止扫描：当前状态为 %s - Scan ID: %s",
                        ScanStatus(scan.status).label,
                        scan_id
                    )
                    return False, 0
                
                # 3. 获取容器 ID 列表和 Worker ID（在锁内读取，确保数据一致性）
                container_ids = scan.container_ids or []
                worker_id = scan.worker_id
                
                # 4. 立即更新状态为 CANCELLED（终态）
                scan.status = ScanStatus.CANCELLED
                scan.stopped_at = timezone.now()
                scan.error_message = "用户手动取消扫描"
                scan.save(update_fields=['status', 'stopped_at', 'error_message'])
                logger.info("✓ 已更新状态为 CANCELLED（事务内）- Scan ID: %s", scan_id)
                
                # 5. 更新阶段进度：running → cancelled, pending → cancelled
                from apps.scan.services.scan_state_service import ScanStateService
                state_service = ScanStateService()
                state_service.cancel_running_stages(scan_id, final_status="cancelled")
        
            # 事务结束，锁释放
            # 后续耗时操作在事务外执行，避免长时间持有锁
            
            # 6. 停止 Docker 容器（通过 SSH/本地执行 docker stop）
            stopped_count = 0
            if container_ids and worker_id:
                try:
                    stopped_count = self._stop_containers(container_ids, worker_id)
                    logger.info(
                        "✓ 已停止 %d/%d 个容器 - Scan ID: %s",
                        stopped_count, len(container_ids), scan_id
                    )
                except Exception as e:
                    logger.error("停止容器失败: %s", e)
                    # 容器停止失败不影响取消结果，状态已经更新为 CANCELLED
            elif not worker_id:
                logger.warning("无 Worker 信息，跳过容器停止 - Scan ID: %s", scan_id)
            else:
                logger.info("无关联容器需要停止 - Scan ID: %s", scan_id)
            
            return True, stopped_count
            
        except (DatabaseError, OperationalError) as e:
            logger.exception("数据库错误：停止扫描失败 - Scan ID: %s", scan_id)
            raise
        except ObjectDoesNotExist:
            logger.error("Scan 不存在 - Scan ID: %s", scan_id)
            return False, 0


# 导出接口
__all__ = ['ScanControlService']
