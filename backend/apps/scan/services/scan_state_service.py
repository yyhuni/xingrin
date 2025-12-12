"""
扫描状态管理服务

职责：
- 更新扫描状态
- 条件状态更新（乐观锁）
- 更新缓存统计数据
"""

import logging
from datetime import datetime
from django.db.utils import DatabaseError, OperationalError
from django.core.exceptions import ObjectDoesNotExist

from apps.common.definitions import ScanStatus
from apps.scan.repositories import DjangoScanRepository

logger = logging.getLogger(__name__)


class ScanStateService:
    """
    扫描状态管理服务
    
    职责：
    - 更新扫描状态
    - 条件状态更新（乐观锁）
    - 更新缓存统计数据
    - 状态验证
    """
    
    def __init__(self):
        """
        初始化服务
        """
        self.repo = DjangoScanRepository()
    
    def update_status(
        self, 
        scan_id: int, 
        status: ScanStatus, 
        error_message: str | None = None,
        stopped_at: datetime | None = None
    ) -> bool:
        """
        更新 Scan 状态
        
        Args:
            scan_id: 扫描任务 ID
            status: 新状态
            error_message: 错误消息（可选）
            stopped_at: 结束时间（可选）
        
        Returns:
            是否更新成功
        
        Note:
            created_at 是自动设置的，不需要手动传递
        """
        try:
            result = self.repo.update_status(
                scan_id, 
                status, 
                error_message,
                stopped_at=stopped_at
            )
            if result:
                logger.debug(
                    "更新 Scan 状态成功 - Scan ID: %s, 状态: %s", 
                    scan_id, 
                    ScanStatus(status).label
                )
            return result
        except (DatabaseError, OperationalError) as e:
            logger.exception("数据库错误：更新 Scan 状态失败 - Scan ID: %s", scan_id)
            raise  # 数据库错误应该向上传播
        except ObjectDoesNotExist:
            logger.error("Scan 不存在 - Scan ID: %s", scan_id)
            return False
    
    def update_status_if_match(
        self,
        scan_id: int,
        current_status: ScanStatus,
        new_status: ScanStatus,
        stopped_at: datetime | None = None
    ) -> bool:
        """
        条件更新 Scan 状态（原子操作）
        
        仅当扫描状态匹配 current_status 时才更新为 new_status。
        这是一个原子操作，用于处理并发场景下的状态更新。
        
        Args:
            scan_id: 扫描任务 ID
            current_status: 当前期望的状态
            new_status: 要更新到的新状态
            stopped_at: 结束时间（可选）
        
        Returns:
            是否更新成功（True=更新了记录，False=未更新或状态不匹配）
        
        Note:
            此方法通过 Repository 层执行原子操作，适用于需要条件更新的场景
        """
        try:
            result = self.repo.update_status_if_match(
                scan_id=scan_id,
                current_status=current_status,
                new_status=new_status,
                stopped_at=stopped_at
            )
            if result:
                logger.debug(
                    "条件更新 Scan 状态成功 - Scan ID: %s, %s → %s",
                    scan_id,
                    current_status.value,
                    new_status.value
                )
            return result
        except (DatabaseError, OperationalError) as e:
            logger.exception(
                "数据库错误：条件更新 Scan 状态失败 - Scan ID: %s",
                scan_id
            )
            raise
        except Exception as e:
            logger.error(
                "条件更新 Scan 状态失败 - Scan ID: %s, 错误: %s",
                scan_id,
                e
            )
            return False
    
    def update_cached_stats(self, scan_id: int) -> dict | None:
        """
        更新扫描任务的缓存统计数据
        
        使用 Repository 层进行数据访问，符合分层架构规范
        
        Args:
            scan_id: 扫描任务 ID
        
        Returns:
            成功返回统计数据字典，失败返回 None
        
        Note:
            应该在扫描进入终态时调用，更新缓存的统计字段以提升查询性能
        """
        try:
            # 通过 Repository 层更新统计数据
            result = self.repo.update_cached_stats(scan_id)
            if result:
                logger.debug("更新缓存统计数据成功 - Scan ID: %s", scan_id)
            return result
        except (DatabaseError, OperationalError) as e:
            logger.exception("数据库错误：更新缓存统计数据失败 - Scan ID: %s", scan_id)
            return None
        except Exception as e:
            logger.error("更新缓存统计数据失败 - Scan ID: %s, 错误: %s", scan_id, e)
            return None
    
    def update_progress(
        self,
        scan_id: int,
        progress: int | None = None,
        current_stage: str | None = None,
        stage_progress: dict | None = None
    ) -> bool:
        """
        更新扫描进度信息
        
        Args:
            scan_id: 扫描任务 ID
            progress: 进度百分比 0-100（可选）
            current_stage: 当前阶段（可选）
            stage_progress: 各阶段详情（可选）
        
        Returns:
            是否更新成功
        """
        try:
            result = self.repo.update_progress(
                scan_id,
                progress=progress,
                current_stage=current_stage,
                stage_progress=stage_progress
            )
            if result:
                logger.debug(
                    "更新扫描进度成功 - Scan ID: %s, stage: %s",
                    scan_id,
                    current_stage
                )
            return result
        except (DatabaseError, OperationalError) as e:
            logger.exception("数据库错误：更新扫描进度失败 - Scan ID: %s", scan_id)
            return False
        except Exception as e:
            logger.error("更新扫描进度失败 - Scan ID: %s, 错误: %s", scan_id, e)
            return False
    
    def init_stage_progress(self, scan_id: int, stages: list[str]) -> bool:
        """
        初始化阶段进度（所有阶段设为 pending）
        
        Args:
            scan_id: 扫描任务 ID
            stages: 阶段列表，如 ['subdomain_discovery', 'port_scan', ...]
                   顺序与 engine_config 配置和 Flow 执行顺序一致
        
        Returns:
            是否初始化成功
        """
        stage_progress = {
            stage: {"status": "pending", "order": idx}
            for idx, stage in enumerate(stages)
        }
        return self.update_progress(
            scan_id,
            progress=0,
            stage_progress=stage_progress
        )
    
    def start_stage(self, scan_id: int, stage: str) -> bool:
        """
        开始执行某个阶段
        
        Args:
            scan_id: 扫描任务 ID
            stage: 阶段名称
        
        Returns:
            是否更新成功
        """
        from datetime import datetime
        
        # 从数据库获取当前进度状态
        scan = self.repo.get_by_id(scan_id)
        if not scan:
            logger.warning(f"start_stage: Scan not found - ID: {scan_id}")
            return False
        
        stage_progress = scan.stage_progress or {}
        
        # 保留原有的 order 字段
        existing = stage_progress.get(stage, {})
        order = existing.get("order", 0)
        
        # 如果阶段已经是 cancelled 状态，不要启动
        if existing.get("status") == "cancelled":
            logger.info(f"start_stage: 阶段已取消，跳过 - Scan ID: {scan_id}, Stage: {stage}")
            return True
        
        stage_progress[stage] = {
            "status": "running",
            "order": order,
            "started_at": datetime.now().isoformat()
        }
        
        # 计算进度百分比
        total_stages = len(stage_progress)
        completed = sum(1 for s in stage_progress.values() if s.get("status") == "completed")
        progress = int((completed / total_stages) * 100) if total_stages > 0 else 0
        
        return self.update_progress(
            scan_id,
            progress=progress,
            current_stage=stage,
            stage_progress=stage_progress
        )
    
    def complete_stage(
        self,
        scan_id: int,
        stage: str,
        detail: str | None = None
    ) -> bool:
        """
        完成某个阶段
        
        Args:
            scan_id: 扫描任务 ID
            stage: 阶段名称
            detail: 完成详情（可选）
        
        Returns:
            是否更新成功
        """
        from datetime import datetime
        
        # 从数据库获取当前进度状态
        scan = self.repo.get_by_id(scan_id)
        if not scan:
            logger.warning(f"complete_stage: Scan not found - ID: {scan_id}")
            return False
        
        stage_progress = scan.stage_progress or {}
        
        existing = stage_progress.get(stage, {})
        order = existing.get("order", 0)
        started_at = existing.get("started_at")
        
        # 如果阶段已经是 cancelled 状态，不要覆盖为 completed
        if existing.get("status") == "cancelled":
            logger.info(f"complete_stage: 阶段已取消，跳过 - Scan ID: {scan_id}, Stage: {stage}")
            return True
        
        duration = 0  # 默认 0，避免 null
        if started_at:
            try:
                start_time = datetime.fromisoformat(started_at)
                duration = int((datetime.now() - start_time).total_seconds())
            except (ValueError, TypeError):
                logger.warning(f"complete_stage: 无法解析 started_at - Stage: {stage}, Value: {started_at}")
        else:
            logger.error(f"complete_stage: started_at 缺失 - Scan ID: {scan_id}, Stage: {stage}")
        
        stage_progress[stage] = {
            "status": "completed",
            "order": order,
            "duration": duration,
        }
        if detail:
            stage_progress[stage]["detail"] = detail
        
        # 计算进度百分比
        total_stages = len(stage_progress)
        completed = sum(1 for s in stage_progress.values() if s.get("status") == "completed")
        progress = int((completed / total_stages) * 100) if total_stages > 0 else 0
        
        # 如果全部完成，进度设为 100
        if completed == total_stages:
            progress = 100
        
        return self.update_progress(
            scan_id,
            progress=progress,
            current_stage="" if completed == total_stages else stage,
            stage_progress=stage_progress
        )
    
    def fail_stage(
        self,
        scan_id: int,
        stage: str,
        error: str | None = None
    ) -> bool:
        """
        标记某个阶段失败
        
        Args:
            scan_id: 扫描任务 ID
            stage: 阶段名称
            error: 错误信息（可选）
        
        Returns:
            是否更新成功
        """
        # 从数据库获取当前进度状态
        scan = self.repo.get_by_id(scan_id)
        if not scan:
            logger.warning(f"fail_stage: Scan not found - ID: {scan_id}")
            return False
        
        stage_progress = scan.stage_progress or {}
        
        # 保留原有的 order 字段
        existing = stage_progress.get(stage, {})
        order = existing.get("order", 0)
        
        # 如果阶段已经是 cancelled 状态，不要覆盖为 failed
        # （用户手动停止时会先标记为 cancelled，docker kill 后触发的 on_failed 不应覆盖）
        if existing.get("status") == "cancelled":
            logger.info(f"fail_stage: 阶段已取消，跳过 - Scan ID: {scan_id}, Stage: {stage}")
            return True
        
        stage_progress[stage] = {
            "status": "failed",
            "order": order,
            "error": error
        }
        
        return self.update_progress(
            scan_id,
            current_stage=stage,
            stage_progress=stage_progress
        )
    
    def cancel_running_stages(self, scan_id: int, final_status: str = "cancelled") -> bool:
        """
        标记所有未完成的阶段（扫描被取消时调用）
        
        将所有 running 状态的阶段标记为 final_status，
        将所有 pending 状态的阶段标记为 skipped
        
        Args:
            scan_id: 扫描任务 ID
            final_status: running 阶段的最终状态
        
        Returns:
            是否更新成功
        """
        try:
            scan = self.repo.get_by_id(scan_id)
            if not scan or not scan.stage_progress:
                return False
            
            stage_progress = scan.stage_progress
            updated = False
            
            for stage, info in stage_progress.items():
                status = info.get("status")
                order = info.get("order", 0)
                
                if status == "running":
                    # 正在运行的阶段标记为 final_status
                    stage_progress[stage] = {
                        "status": final_status,
                        "order": order,
                    }
                    updated = True
                elif status == "pending":
                    # 未开始的阶段统一标记为 cancelled
                    stage_progress[stage] = {
                        "status": "cancelled",
                        "order": order,
                    }
                    updated = True
            
            if updated:
                self.update_progress(
                    scan_id,
                    current_stage="",
                    stage_progress=stage_progress
                )
            
            return True
        except Exception as e:
            logger.error("取消阶段进度失败 - Scan ID: %s, 错误: %s", scan_id, e)
            return False


# 导出接口
__all__ = ['ScanStateService']
