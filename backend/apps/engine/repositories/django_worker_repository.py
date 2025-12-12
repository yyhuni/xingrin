"""
WorkerNode 数据访问层 Django ORM 实现

基于 Django ORM 的 WorkerNode Repository 实现类
"""

import logging
from typing import Any

from django.utils import timezone

from apps.engine.models import WorkerNode
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoWorkerRepository:
    """基于 Django ORM 的 WorkerNode 数据访问层实现"""

    def get_by_id(self, worker_id: int) -> WorkerNode | None:
        """根据 ID 获取 Worker 节点"""
        try:
            return WorkerNode.objects.get(id=worker_id)
        except WorkerNode.DoesNotExist:
            logger.warning("WorkerNode 不存在 - ID: %s", worker_id)
            return None

    def get_all(self):
        """获取所有 Worker 节点的查询集"""
        return WorkerNode.objects.all().order_by("-created_at")

    def update_status(self, worker_id: int, status: str) -> bool:
        """更新 Worker 节点状态"""
        worker = self.get_by_id(worker_id)
        if not worker:
            return False

        worker.status = status
        worker.save(update_fields=["status"])
        logger.info("Worker %s 状态更新为: %s", worker_id, status)
        return True


    def delete_by_id(self, worker_id: int) -> bool:
        """根据 ID 删除 Worker 节点"""
        worker = self.get_by_id(worker_id)
        if not worker:
            return False

        worker.delete()
        logger.info("Worker %s 已删除", worker_id)
        return True

    def get_or_create_by_name(
        self, 
        name: str, 
        is_local: bool = True
    ) -> tuple[WorkerNode, bool]:
        """
        根据名称获取或创建 Worker 节点
        
        用于本地 Worker 自注册。
        
        Args:
            name: Worker 名称
            is_local: 是否为本地节点
            
        Returns:
            (worker, created) 元组
        """
        import socket
        
        # 尝试获取本机 IP
        try:
            hostname = socket.gethostname()
            ip_address = socket.gethostbyname(hostname)
        except Exception:
            ip_address = '127.0.0.1'
        
        worker, created = WorkerNode.objects.get_or_create(
            name=name,
            defaults={
                'ip_address': ip_address,
                'is_local': is_local,
                'status': 'offline',  # 等待心跳上报后自动变为 online
            }
        )
        
        if created:
            logger.info("本地 Worker 注册成功: %s (IP: %s)", name, ip_address)
        else:
            logger.debug("本地 Worker 已存在: %s", name)
        
        return worker, created


__all__ = ["DjangoWorkerRepository"]
