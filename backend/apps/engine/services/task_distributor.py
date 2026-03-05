"""
负载感知任务分发器

根据 Worker 负载动态分发任务，支持本地和远程 Worker。

核心逻辑：
1. 查询所有在线 Worker 的负载（从心跳数据）
2. 选择负载最低的 Worker（可能是本地或远程）
3. 本地 Worker：直接执行 docker run
4. 远程 Worker：通过 SSH 执行 docker run
5. 任务执行完自动销毁容器（--rm）

镜像版本管理：
- 版本锁定：使用 settings.IMAGE_TAG 确保 server 和 worker 版本一致
- 预拉取策略：安装时预拉取镜像，执行时使用 --pull=missing
- 本地开发：可通过 TASK_EXECUTOR_IMAGE 环境变量指向本地镜像

环境变量注入：
- Worker 容器不使用 env_file，通过 docker run -e 动态注入
- 只注入 SERVER_URL，容器启动后从配置中心获取完整配置
- 本地 Worker：SERVER_URL = http://server:{port}（Docker 内部网络）
- 远程 Worker：SERVER_URL = http://{public_host}:{port}（公网地址）

任务启动流程：
1. Server 调用 execute_scan_flow() 等方法提交任务
2. select_best_worker() 从 Redis 读取心跳数据，选择负载最低的节点
3. _build_docker_command() 构建完整的 docker run 命令：
   - 设置网络（本地加入 Docker 网络，远程不指定）
   - 注入环境变量（-e SERVER_URL=...）
   - 挂载结果和日志目录（-v）
   - 指定执行脚本（python -m apps.scan.scripts.xxx）
4. _execute_docker_command() 执行命令：
   - 本地：subprocess.run() 直接执行
   - 远程：paramiko SSH 执行
5. docker run -d 立即返回容器 ID，任务在后台执行

特点：
- 负载感知：任务优先分发到最空闲的机器
- 统一调度：本地和远程 Worker 使用相同的选择逻辑
- 资源隔离：每个任务独立容器
- 按需创建：空闲时零占用
- 版本一致：所有节点使用相同版本的 worker 镜像
"""

import logging
import time
from typing import Optional, Dict, Any

import paramiko
from django.conf import settings
from django.db.models import Count, Q

from apps.engine.models import WorkerNode
from apps.scan.models import Scan
from apps.common.definitions import ScanStatus
from apps.scan.services.scan_recovery_service import reclaim_stuck_initiated_scans

logger = logging.getLogger(__name__)


class TaskDistributor:
    """
    负载感知任务分发器
    
    根据 Worker 负载自动选择最优节点执行任务。
    - 本地 Worker (is_local=True)：直接执行 docker 命令
    - 远程 Worker (is_local=False)：通过 SSH 执行 docker 命令
    
    负载均衡策略：
    - 心跳间隔：3 秒（Agent 上报到 Redis）
    - 任务间隔：6 秒（确保心跳已更新）
    - 高负载阈值：85%（CPU 或内存超过则跳过）
    - 在线判断：Redis TTL（15秒过期视为离线）
    """
    
    # 上次任务提交时间（类级别，所有实例共享）
    _last_submit_time: float = 0
    
    def __init__(self):
        self.docker_image = settings.TASK_EXECUTOR_IMAGE
        if not self.docker_image:
            raise ValueError("TASK_EXECUTOR_IMAGE 未配置，请确保 IMAGE_TAG 环境变量已设置")
        # 统一使用 /opt/xingrin 下的路径
        self.logs_mount = "/opt/xingrin/logs"
        self.submit_interval = getattr(settings, 'TASK_SUBMIT_INTERVAL', 5)
        self.max_concurrent_scans_global = getattr(settings, 'MAX_CONCURRENT_SCANS_GLOBAL', 0)
        self.max_concurrent_scans_per_worker = getattr(settings, 'MAX_CONCURRENT_SCANS_PER_WORKER', 0)
        self.capacity_check_interval = getattr(settings, 'DISPATCH_CAPACITY_CHECK_INTERVAL', 10)
        self.capacity_max_retries = getattr(settings, 'DISPATCH_CAPACITY_MAX_RETRIES', 120)
        self.initiated_stuck_timeout_seconds = int(
            getattr(settings, 'DISPATCH_INITIATED_STUCK_TIMEOUT_SECONDS', 900)
        )
        self.task_container_cpus = getattr(settings, 'TASK_CONTAINER_CPUS', '').strip()
        self.task_container_memory = getattr(settings, 'TASK_CONTAINER_MEMORY', '').strip()
        self.task_container_memory_swap = getattr(settings, 'TASK_CONTAINER_MEMORY_SWAP', '').strip()

    def _get_inflight_scan_queryset(self):
        """
        获取“已提交或正在运行”的扫描任务。

        说明：
        - running: 正在执行
        - initiated + worker 非空: 已提交到 Worker，等待 Flow on_running 回调切换状态
        """
        return Scan.objects.filter(
            Q(status=ScanStatus.RUNNING) |
            (Q(status=ScanStatus.INITIATED) & Q(worker_id__isnull=False))
        )

    def _get_global_inflight_count(self) -> int:
        """获取全局并发扫描数（已提交+运行中）"""
        return self._get_inflight_scan_queryset().count()

    def _get_worker_inflight_count(self, worker_id: int) -> int:
        """获取单个 Worker 并发扫描数（已提交+运行中）"""
        return self._get_inflight_scan_queryset().filter(worker_id=worker_id).count()

    def _is_global_capacity_available(self) -> bool:
        """检查是否有全局并发槽位（0 表示不限制）"""
        if self.max_concurrent_scans_global <= 0:
            return True
        return self._get_global_inflight_count() < self.max_concurrent_scans_global
    
    def get_online_workers(self) -> list[WorkerNode]:
        """
        获取所有在线的 Worker
        
        判断条件：
        - status in ('online', 'offline') 表示已部署
        - Redis 中有心跳数据（TTL 未过期）
        """
        from apps.engine.services.worker_load_service import worker_load_service
        
        # 1. 获取所有已部署的节点（online/offline 表示已部署）
        workers = WorkerNode.objects.filter(status__in=['online', 'offline'])
        
        # 2. 过滤出 Redis 中有心跳数据的（在线）
        online_workers = []
        for worker in workers:
            if worker_load_service.is_online(worker.id):
                online_workers.append(worker)
        
        return online_workers
    
    def select_best_worker(self) -> Optional[WorkerNode]:
        """
        选择负载最低的在线 Worker
        
        选择策略：
        - 从 Redis 读取实时负载数据
        - CPU 权重 70%，内存权重 30%
        - 排除 CPU > 85% 或 内存 > 85% 的机器
        
        Returns:
            最优 Worker，如果没有可用的返回 None
        """
        from apps.engine.services.worker_load_service import worker_load_service
        
        workers = self.get_online_workers()
        
        if not workers:
            logger.warning("没有可用的在线 Worker")
            return None
        
        # 从 Redis 批量获取负载数据
        worker_ids = [w.id for w in workers]
        loads = worker_load_service.get_all_loads(worker_ids)
        worker_inflight_counts = {
            row["worker_id"]: row["total"]
            for row in self._get_inflight_scan_queryset()
            .filter(worker_id__in=worker_ids)
            .values("worker_id")
            .annotate(total=Count("id"))
        }
        
        # 计算每个 Worker 的负载分数
        scored_workers = []
        high_load_workers = []  # 高负载 Worker（降级备选）
        
        for worker in workers:
            # 先检查每节点并发上限
            if self.max_concurrent_scans_per_worker > 0:
                inflight = worker_inflight_counts.get(worker.id, 0)
                if inflight >= self.max_concurrent_scans_per_worker:
                    logger.info(
                        "Worker %s 达到并发上限，跳过分配 (inflight=%d, limit=%d)",
                        worker.name,
                        inflight,
                        self.max_concurrent_scans_per_worker
                    )
                    continue

            # 从 Redis 获取负载数据
            load = loads.get(worker.id)
            if not load:
                # Redis 无数据，跳过该节点（不应该发生，因为 get_online_workers 已过滤）
                logger.warning(f"Worker {worker.name} 无负载数据，跳过")
                continue
            
            cpu = load.get('cpu', 0)
            mem = load.get('mem', 0)
            
            # 加权分数（越低越好）
            score = cpu * 0.7 + mem * 0.3
            
            # 区分正常和高负载（阈值降到 85%，更保守）
            if cpu > 85 or mem > 85:
                high_load_workers.append((worker, score, cpu, mem))
                logger.debug(
                    "高负载 Worker: %s (CPU: %.1f%%, MEM: %.1f%%)",
                    worker.name, cpu, mem
                )
            else:
                scored_workers.append((worker, score, cpu, mem))
        
        # 降级策略：如果没有正常负载的，循环等待后重新检测
        if not scored_workers:
            if high_load_workers:
                # 高负载等待参数（默认每 60 秒检测一次，最多 10 次）
                high_load_wait = getattr(settings, 'HIGH_LOAD_WAIT_SECONDS', 60)
                high_load_max_retries = getattr(settings, 'HIGH_LOAD_MAX_RETRIES', 10)
                
                # 开始等待前发送高负载通知
                high_load_workers.sort(key=lambda x: x[1])
                _, _, first_cpu, first_mem = high_load_workers[0]
                from apps.common.signals import all_workers_high_load
                all_workers_high_load.send(
                    sender=self.__class__,
                    worker_name="所有节点",
                    cpu=first_cpu,
                    mem=first_mem
                )
                
                for retry in range(high_load_max_retries):
                    logger.warning(
                        "所有 Worker 高负载，等待 %d 秒后重试... (%d/%d)",
                        high_load_wait, retry + 1, high_load_max_retries
                    )
                    time.sleep(high_load_wait)
                    
                    # 重新获取负载数据
                    loads = worker_load_service.get_all_loads(worker_ids)
                    
                    # 重新评估
                    scored_workers = []
                    high_load_workers = []
                    
                    for worker in workers:
                        load = loads.get(worker.id)
                        if not load:
                            continue
                        
                        cpu = load.get('cpu', 0)
                        mem = load.get('mem', 0)
                        score = cpu * 0.7 + mem * 0.3
                        
                        if cpu > 85 or mem > 85:
                            high_load_workers.append((worker, score, cpu, mem))
                        else:
                            scored_workers.append((worker, score, cpu, mem))
                    
                    # 如果有正常负载的 Worker，跳出循环
                    if scored_workers:
                        logger.info("检测到正常负载 Worker，结束等待")
                        break
                
                # 超时或仍然高负载，选择负载最低的
                if not scored_workers and high_load_workers:
                    high_load_workers.sort(key=lambda x: x[1])
                    best_worker, _, cpu, mem = high_load_workers[0]
                    
                    logger.warning(
                        "等待超时，强制分发到高负载 Worker: %s (CPU: %.1f%%, MEM: %.1f%%)",
                        best_worker.name, cpu, mem
                    )
                    return best_worker
            else:
                logger.warning("没有可用的 Worker")
                return None
        
        # 选择分数最低的
        scored_workers.sort(key=lambda x: x[1])
        best_worker, score, cpu, mem = scored_workers[0]
        
        logger.info(
            "选择 Worker: %s (CPU: %.1f%%, MEM: %.1f%%, Score: %.1f)",
            best_worker.name, cpu, mem, score
        )
        
        return best_worker
    
    def _wait_for_submit_interval(self):
        """
        等待任务提交间隔（后台线程中执行，不阻塞 API）
        
        确保连续任务提交之间有足够的间隔，让心跳有时间更新负载数据。
        如果距上次提交已超过间隔，则不等待。
        """
        if TaskDistributor._last_submit_time > 0:
            elapsed = time.time() - TaskDistributor._last_submit_time
            if elapsed < self.submit_interval:
                time.sleep(self.submit_interval - elapsed)
        TaskDistributor._last_submit_time = time.time()
    
    def _build_docker_command(
        self,
        worker: WorkerNode,
        script_module: str,
        script_args: Dict[str, Any],
    ) -> str:
        """
        构建 docker run 命令
        
        容器只需要 SERVER_URL，启动后从配置中心获取完整配置。
        
        Args:
            worker: 目标 Worker（用于区分本地/远程网络）
            script_module: 脚本模块路径（如 apps.scan.scripts.run_initiate_scan）
            script_args: 脚本参数（会转换为命令行参数）
        
        Returns:
            完整的 docker run 命令
        """
        import shlex
        
        # 根据 Worker 类型确定网络和 Server 地址
        if worker.is_local:
            # 本地：加入 Docker 网络，使用内部服务名
            network_arg = f"--network {settings.DOCKER_NETWORK_NAME}"
            server_url = f"http://server:{settings.SERVER_PORT}"
        else:
            # 远程：通过 Nginx 反向代理访问（HTTPS，不直连 8888 端口）
            network_arg = ""
            server_url = f"https://{settings.PUBLIC_HOST}:{settings.PUBLIC_PORT}"
        
        # 挂载路径（统一挂载 /opt/xingrin，扫描工具在 /opt/xingrin-tools/bin 不受影响）
        host_xingrin_dir = "/opt/xingrin"
        
        # 环境变量：SERVER_URL + IS_LOCAL，其他配置容器启动时从配置中心获取
        # IS_LOCAL 用于 Worker 向配置中心声明身份，决定返回的数据库地址
        # Prefect 本地模式配置：启用 ephemeral server（本地临时服务器）
        is_local_str = "true" if worker.is_local else "false"
        env_vars = [
            f"-e SERVER_URL={shlex.quote(server_url)}",
            f"-e IS_LOCAL={is_local_str}",
            f"-e WORKER_API_KEY={shlex.quote(settings.WORKER_API_KEY)}",  # Worker API 认证密钥
            "-e PREFECT_HOME=/tmp/.prefect",  # 设置 Prefect 数据目录到可写位置
            "-e PREFECT_SERVER_EPHEMERAL_ENABLED=true",  # 启用 ephemeral server（本地临时服务器）
            "-e PREFECT_SERVER_EPHEMERAL_STARTUP_TIMEOUT_SECONDS=120",  # 增加启动超时时间
            "-e PREFECT_SERVER_DATABASE_CONNECTION_URL=sqlite+aiosqlite:////tmp/.prefect/prefect.db",  # 使用 /tmp 下的 SQLite
            "-e PREFECT_LOGGING_LEVEL=WARNING",  # 日志级别（减少 DEBUG 噪音）
        ]
        
        # 挂载卷（统一挂载整个 /opt/xingrin 目录）
        volumes = [
            f"-v {host_xingrin_dir}:{host_xingrin_dir}",
        ]
        
        # 构建命令行参数
        # 使用 shlex.quote 处理特殊字符，确保参数在 shell 中正确解析
        args_str = " ".join([f"--{k}={shlex.quote(str(v))}" for k, v in script_args.items()])
        
        # 日志文件路径（容器内），保留最近 10000 行
        log_file = f"{self.logs_mount}/container_{script_module.split('.')[-1]}.log"
        
        # 构建内部命令（日志轮转 + 执行脚本）
        inner_cmd = f'tail -n 10000 {log_file} > {log_file}.tmp 2>/dev/null; mv {log_file}.tmp {log_file} 2>/dev/null; python -m {script_module} {args_str} >> {log_file} 2>&1'
        
        # 完整命令
        # 镜像拉取策略：--pull=missing
        # - 本地 Worker：install.sh 已预拉取镜像，直接使用本地版本
        # - 远程 Worker：deploy 时已预拉取镜像，直接使用本地版本
        # - 避免每次任务都检查 Docker Hub，提升性能和稳定性
        # OOM 优先级：--oom-score-adj=1000 让 Worker 在内存不足时优先被杀
        # - 范围 -1000 到 1000，值越大越容易被 OOM Killer 选中
        # - 保护 server/nginx/frontend 等核心服务，确保 Web 界面可用
        resource_limits = []
        if self.task_container_cpus:
            resource_limits.append(f"--cpus={shlex.quote(self.task_container_cpus)}")
        if self.task_container_memory:
            resource_limits.append(f"--memory={shlex.quote(self.task_container_memory)}")
        if self.task_container_memory_swap:
            resource_limits.append(f"--memory-swap={shlex.quote(self.task_container_memory_swap)}")

        cmd = f'''docker run --rm -d --pull=missing {network_arg} \\
            --oom-score-adj=1000 \\
            {' '.join(resource_limits)} \\
            {' '.join(env_vars)} \\
            {' '.join(volumes)} \\
            {self.docker_image} \\
            sh -c "{inner_cmd}"'''
        
        return cmd
    
    def _execute_docker_command(
        self,
        worker: WorkerNode,
        docker_cmd: str,
    ) -> tuple[bool, str]:
        """
        在 Worker 上执行 docker run 命令
        
        docker run -d 会立即返回容器 ID，无需等待任务完成。
        
        Args:
            worker: 目标 Worker
            docker_cmd: docker run 命令
        
        Returns:
            (success, container_id) 元组
        """
        logger.info("准备执行 Docker 命令 - Worker: %s, Local: %s", worker.name, worker.is_local)
        logger.info("Docker 命令: %s", docker_cmd[:200] + '...' if len(docker_cmd) > 200 else docker_cmd)
        
        if worker.is_local:
            return self._execute_local_docker(docker_cmd)
        else:
            return self._execute_ssh_docker(worker, docker_cmd)
    
    def _execute_local_docker(
        self,
        docker_cmd: str,
    ) -> tuple[bool, str]:
        """
        在本地执行 docker run 命令
        
        docker run -d 立即返回容器 ID。
        """
        import subprocess
        logger.info("开始执行本地 Docker 命令...")
        try:
            result = subprocess.run(
                docker_cmd,
                shell=True,
                capture_output=True,
                text=True,
            )
            
            if result.returncode != 0:
                logger.error(
                    "本地 Docker 执行失败 - Exit: %d, Stderr: %s, Stdout: %s",
                    result.returncode, result.stderr[:500], result.stdout[:500]
                )
                return False, result.stderr
            
            container_id = result.stdout.strip()
            logger.info("本地 Docker 执行成功 - Container ID: %s", container_id[:12] if container_id else 'N/A')
            return True, container_id
            
        except Exception as e:
            logger.error("本地 Docker 执行异常: %s", e, exc_info=True)
            return False, f"执行异常: {e}"
    
    def _execute_ssh_docker(
        self,
        worker: WorkerNode,
        docker_cmd: str,
    ) -> tuple[bool, str]:
        """
        在远程 Worker 上通过 SSH 执行 docker run 命令
        
        docker run -d 立即返回容器 ID，无需长时间等待。
        
        Args:
            worker: 目标 Worker
            docker_cmd: docker run 命令
        
        Returns:
            (success, container_id) 元组
        """
        ssh = None
        logger.info("开始 SSH Docker 执行 - Worker: %s (%s:%d)", worker.name, worker.ip_address, worker.ssh_port)
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # 连接（SSH 连接超时 10 秒足够）
            ssh.connect(
                hostname=worker.ip_address,
                port=worker.ssh_port,
                username=worker.username,
                password=worker.password if worker.password else None,
                timeout=10,
            )
            logger.debug("SSH 连接成功 - Worker: %s", worker.name)
            
            # 执行 docker run（-d 模式立即返回）
            stdin, stdout, stderr = ssh.exec_command(docker_cmd)
            exit_code = stdout.channel.recv_exit_status()
            
            output = stdout.read().decode().strip()
            error = stderr.read().decode().strip()
            
            if exit_code != 0:
                logger.error(
                    "SSH Docker 执行失败 - Worker: %s, Exit: %d, Stderr: %s, Stdout: %s",
                    worker.name, exit_code, error[:500], output[:500]
                )
                return False, error
            
            logger.info("SSH Docker 执行成功 - Worker: %s, Container ID: %s", worker.name, output[:12] if output else 'N/A')
            return True, output
            
        except paramiko.AuthenticationException as e:
            logger.error("SSH 认证失败 - Worker: %s, Error: %s", worker.name, e)
            return False, f"认证失败: {e}"
        except paramiko.SSHException as e:
            logger.error("SSH 连接错误 - Worker: %s, Error: %s", worker.name, e)
            return False, f"SSH 错误: {e}"
        except Exception as e:
            logger.error("SSH Docker 执行异常 - Worker: %s, Error: %s", worker.name, e)
            return False, f"执行异常: {e}"
        finally:
            if ssh:
                ssh.close()
    
    def execute_scan_flow(
        self,
        scan_id: int,
        target_name: str,
        target_id: int,
        scan_workspace_dir: str,
        engine_name: str,
        scheduled_scan_name: str | None = None,
    ) -> tuple[bool, str, Optional[str], Optional[int]]:
        """
        在远程或本地 Worker 上执行扫描 Flow
        
        Args:
            scan_id: 扫描任务 ID
            target_name: 目标名称
            target_id: 目标 ID
            scan_workspace_dir: 扫描工作目录
            engine_name: 引擎名称
            scheduled_scan_name: 定时扫描任务名称（可选）
        
        Returns:
            (success, message, container_id, worker_id) 元组
        
        Note:
            engine_config 由 Flow 内部通过 scan_id 查询数据库获取
        """
        logger.info("="*60)
        logger.info("execute_scan_flow 开始")
        logger.info("  scan_id: %s", scan_id)
        logger.info("  target_name: %s", target_name)
        logger.info("  target_id: %s", target_id)
        logger.info("  scan_workspace_dir: %s", scan_workspace_dir)
        logger.info("  engine_name: %s", engine_name)
        logger.info("  docker_image: %s", self.docker_image)
        logger.info("="*60)
        
        # 1. 容量等待 + 提交节流（后台线程执行，不阻塞 API）
        worker = None
        retry = 0
        unlimited = self.capacity_max_retries <= 0
        while unlimited or retry < self.capacity_max_retries:
            self._wait_for_submit_interval()

            if not self._is_global_capacity_available():
                reclaimed = reclaim_stuck_initiated_scans(self.initiated_stuck_timeout_seconds)
                if reclaimed > 0:
                    logger.info("检测到全局并发已满，已回收 %d 个僵尸占位任务，立即重试分发", reclaimed)
                    continue
                global_inflight = self._get_global_inflight_count()
                logger.warning(
                    "全局并发已满，等待重试... (inflight=%d, limit=%d, retry=%d/%s)",
                    global_inflight,
                    self.max_concurrent_scans_global,
                    retry + 1,
                    "∞" if unlimited else self.capacity_max_retries
                )
                time.sleep(self.capacity_check_interval)
                retry += 1
                continue

            worker = self.select_best_worker()
            if not worker:
                reclaimed = reclaim_stuck_initiated_scans(self.initiated_stuck_timeout_seconds)
                if reclaimed > 0:
                    logger.info("暂无可用 Worker 时回收到 %d 个僵尸占位任务，立即重试分发", reclaimed)
                    continue
                logger.warning(
                    "暂无可用 Worker，等待重试... (retry=%d/%s)",
                    retry + 1,
                    "∞" if unlimited else self.capacity_max_retries
                )
                time.sleep(self.capacity_check_interval)
                retry += 1
                continue

            # 双重检查：避免并发竞争导致瞬时超配
            if self.max_concurrent_scans_per_worker > 0:
                worker_inflight = self._get_worker_inflight_count(worker.id)
                if worker_inflight >= self.max_concurrent_scans_per_worker:
                    logger.warning(
                        "Worker %s 在提交前达到并发上限，等待重试... (inflight=%d, limit=%d, retry=%d/%s)",
                        worker.name,
                        worker_inflight,
                        self.max_concurrent_scans_per_worker,
                        retry + 1,
                        "∞" if unlimited else self.capacity_max_retries
                    )
                    worker = None
                    time.sleep(self.capacity_check_interval)
                    retry += 1
                    continue

            break

        if not worker:
            return False, "等待可用 Worker 超时（可调大 DISPATCH_CAPACITY_MAX_RETRIES，0 表示无限等待）", None, None
        
        # 2. 构建 docker run 命令
        script_args = {
            'scan_id': scan_id,
            'target_name': target_name,
            'target_id': target_id,
            'scan_workspace_dir': scan_workspace_dir,
            'engine_name': engine_name,
        }
        if scheduled_scan_name:
            script_args['scheduled_scan_name'] = scheduled_scan_name
        
        docker_cmd = self._build_docker_command(
            worker=worker,
            script_module='apps.scan.scripts.run_initiate_scan',
            script_args=script_args,
        )
        
        logger.info(
            "提交扫描任务到 Worker: %s - Scan ID: %d, Target: %s",
            worker.name, scan_id, target_name
        )
        
        # 3. 执行 docker run（本地直接执行，远程通过 SSH）
        success, output = self._execute_docker_command(worker, docker_cmd)
        
        if success:
            container_id = output[:12] if output else None
            logger.info(
                "扫描任务已提交 - Scan ID: %d, Worker: %s, Container: %s",
                scan_id, worker.name, container_id
            )
            return True, f"任务已提交到 {worker.name}", container_id, worker.id
        else:
            logger.error(
                "扫描任务提交失败 - Scan ID: %d, Worker: %s, Error: %s",
                scan_id, worker.name, output
            )
            return False, output, None, None
    
    def execute_cleanup_on_all_workers(
        self,
        retention_days: int = 7,
    ) -> list[dict]:
        """
        在所有 Worker 上执行清理任务
        
        Args:
            retention_days: 保留天数，默认7天
            
        Returns:
            各 Worker 的执行结果列表
        """
        results = []
        
        # 获取所有在线的 Worker
        workers = self.get_online_workers()
        if not workers:
            logger.warning("没有可用的 Worker 执行清理任务")
            return results
        
        logger.info(f"开始在 {len(workers)} 个 Worker 上执行清理任务")
        
        for worker in workers:
            try:
                # 构建 docker run 命令（清理过期扫描结果目录）
                script_args = {
                    'results_dir': '/opt/xingrin/results',
                    'retention_days': retention_days,
                }
                
                docker_cmd = self._build_docker_command(
                    worker=worker,
                    script_module='apps.scan.scripts.run_cleanup',
                    script_args=script_args,
                )
                
                # 执行清理命令
                success, output = self._execute_docker_command(worker, docker_cmd)
                
                results.append({
                    'worker_id': worker.id,
                    'worker_name': worker.name,
                    'success': success,
                    'output': output[:500] if output else None,
                })
                
                if success:
                    logger.info(f"✓ Worker {worker.name} 清理任务已启动")
                else:
                    logger.warning(f"✗ Worker {worker.name} 清理任务启动失败: {output}")
                    
            except Exception as e:
                logger.error(f"Worker {worker.name} 清理任务执行异常: {e}")
                results.append({
                    'worker_id': worker.id,
                    'worker_name': worker.name,
                    'success': False,
                    'error': str(e),
                })
        
        return results

    def execute_delete_task(
        self,
        task_type: str,
        ids: list[int],
    ) -> tuple[bool, str, str | None]:
        """
        分发删除任务到最优 Worker
        
        统一入口，根据 task_type 选择对应的删除脚本执行。
        
        Args:
            task_type: 任务类型 ('targets', 'organizations', 'scans')
            ids: 要删除的 ID 列表
            
        Returns:
            (success, message, container_id) 元组
        """
        import json
        
        # 映射任务类型到脚本
        script_map = {
            'targets': 'apps.targets.scripts.run_delete_targets',
            'organizations': 'apps.targets.scripts.run_delete_organizations',
            'scans': 'apps.scan.scripts.run_delete_scans',
        }
        
        # 映射任务类型到参数名
        param_map = {
            'targets': 'target_ids',
            'organizations': 'organization_ids',
            'scans': 'scan_ids',
        }
        
        if task_type not in script_map:
            return False, f"不支持的任务类型: {task_type}", None
        
        # 选择最佳 Worker
        worker = self.select_best_worker()
        if not worker:
            return False, "没有可用的 Worker", None
        
        # 构建参数（ID 列表需要 JSON 序列化）
        script_args = {
            param_map[task_type]: json.dumps(ids),
        }
        
        # 构建 docker run 命令
        docker_cmd = self._build_docker_command(
            worker=worker,
            script_module=script_map[task_type],
            script_args=script_args,
        )
        
        logger.info(
            "分发删除任务 - 类型: %s, 数量: %d, Worker: %s",
            task_type, len(ids), worker.name
        )
        
        # 执行命令
        success, output = self._execute_docker_command(worker, docker_cmd)
        
        if success:
            container_id = output.strip() if output else None
            logger.info(
                "✓ 删除任务已分发 - 类型: %s, Container: %s",
                task_type, container_id
            )
            return True, f"任务已提交到 {worker.name}", container_id
        else:
            logger.error(
                "✗ 删除任务分发失败 - 类型: %s, Error: %s",
                task_type, output
            )
            return False, output, None


# 单例
_distributor: Optional[TaskDistributor] = None


def get_task_distributor() -> TaskDistributor:
    """获取任务分发器单例"""
    global _distributor
    if _distributor is None:
        _distributor = TaskDistributor()
    return _distributor
