"""
WorkerNode 业务逻辑服务层（Service）

负责 Worker 节点相关的业务逻辑处理
"""

import logging
from typing import Any

from apps.engine.repositories import DjangoWorkerRepository

logger = logging.getLogger(__name__)


class WorkerService:
    """Worker 节点业务逻辑服务"""

    def __init__(self) -> None:
        """初始化服务，注入 Repository 依赖"""
        self.repo = DjangoWorkerRepository()

    # ==================== 查询 ====================

    def get_worker(self, worker_id: int):
        """根据 ID 获取 Worker 节点"""
        return self.repo.get_by_id(worker_id)

    def get_all_workers(self):
        """获取所有 Worker 节点查询集"""
        return self.repo.get_all()

    # ==================== 状态更新 ====================

    def update_status(self, worker_id: int, status: str) -> bool:
        """更新 Worker 节点状态
        
        Args:
            worker_id: Worker ID
            status: 状态 (pending/deploying/online/offline)
        """
        return self.repo.update_status(worker_id, status)


    def delete_worker(self, worker_id: int) -> bool:
        """删除 Worker 节点"""
        return self.repo.delete_by_id(worker_id)

    # ==================== 自注册 ====================

    def register_worker(self, name: str, is_local: bool = True):
        """
        注册 Worker 节点（本地 Worker 自注册用）
        
        幂等操作：已存在则返回现有节点。
        
        Args:
            name: Worker 名称
            is_local: 是否为本地节点
            
        Returns:
            (WorkerNode, created) 元组
        """
        return self.repo.get_or_create_by_name(
            name=name,
            is_local=is_local
        )

    def remote_uninstall(
        self, 
        worker_id: int,
        ip_address: str, 
        ssh_port: int, 
        username: str, 
        password: str | None
    ) -> tuple[bool, str]:
        """
        在远程主机上执行卸载脚本
        
        Args:
            worker_id: Worker ID（仅用于日志）
            ip_address: SSH 主机地址
            ssh_port: SSH 端口
            username: SSH 用户名
            password: SSH 密码
            
        Returns:
            (success, message) 元组
        """
        if not password:
            return False, "未配置 SSH 密码，跳过远程卸载"
        
        try:
            import paramiko
            from apps.engine.services.deploy_service import get_uninstall_script
            
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            logger.info(f"[卸载] 正在连接 {ip_address}...")
            ssh.connect(
                ip_address,
                port=ssh_port,
                username=username,
                password=password,
                timeout=30
            )
            
            # 上传卸载脚本
            uninstall_script = get_uninstall_script()
            remote_script_path = '/tmp/xingrin_uninstall.sh'
            
            sftp = ssh.open_sftp()
            with sftp.file(remote_script_path, 'w') as f:
                f.write(uninstall_script)
            sftp.chmod(remote_script_path, 0o755)
            sftp.close()
            
            # 执行卸载脚本
            logger.info(f"[卸载] 正在执行卸载脚本...")
            stdin, stdout, stderr = ssh.exec_command(f"bash {remote_script_path}")
            exit_status = stdout.channel.recv_exit_status()
            
            ssh.close()
            
            if exit_status == 0:
                logger.info(f"[卸载] Worker {worker_id} 远程卸载成功")
                return True, "远程卸载成功"
            else:
                error = stderr.read().decode().strip()
                logger.warning(f"[卸载] Worker {worker_id} 远程卸载失败: {error}")
                return False, f"远程卸载失败: {error}"
                
        except Exception as e:
            logger.warning(f"[卸载] Worker {worker_id} 远程卸载异常: {e}")
            return False, f"远程卸载异常: {str(e)}"


__all__ = ["WorkerService"]
