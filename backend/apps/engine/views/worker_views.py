"""
Worker 节点 Views
"""
import os
import threading
import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.engine.serializers import WorkerNodeSerializer
from apps.engine.services import WorkerService
from apps.common.signals import worker_delete_failed

logger = logging.getLogger(__name__)


class WorkerNodeViewSet(viewsets.ModelViewSet):
    """
    Worker 节点 ViewSet
    
    HTTP API:
    - GET /api/workers/ - 获取节点列表
    - POST /api/workers/ - 创建节点
    - DELETE /api/workers/{id}/ - 删除节点（同时执行远程卸载）
    - POST /api/workers/{id}/heartbeat/ - 心跳上报
    
    部署通过 WebSocket 终端进行:
    - ws://host/ws/workers/{id}/deploy/
    """
    
    serializer_class = WorkerNodeSerializer

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.worker_service = WorkerService()

    def get_queryset(self):
        """通过服务层获取 Worker 查询集"""
        return self.worker_service.get_all_workers()
    
    def get_serializer_context(self):
        """传入批量查询的 Redis 负载数据，避免 N+1 查询"""
        context = super().get_serializer_context()
        
        # 仅在 list 操作时批量预加载
        if self.action == 'list':
            from apps.engine.services.worker_load_service import worker_load_service
            queryset = self.get_queryset()
            worker_ids = list(queryset.values_list('id', flat=True))
            context['loads'] = worker_load_service.get_all_loads(worker_ids)
        
        return context
    
    def destroy(self, request, *args, **kwargs):
        """
        删除 Worker 节点
        
        流程：
        1. 后台线程执行远程卸载脚本
        2. 卸载完成后删除数据库记录
        3. 发送通知
        """
        worker = self.get_object()
        
        # 在主线程中提取所有需要的数据（避免后台线程访问 ORM 对象）
        worker_id = worker.id
        worker_name = worker.name
        ip_address = worker.ip_address
        ssh_port = worker.ssh_port
        username = worker.username
        password = worker.password
        
        # 1. 删除 Redis 中的负载数据
        from apps.engine.services.worker_load_service import worker_load_service
        worker_load_service.delete_load(worker_id)
        
        # 2. 删除数据库记录（立即生效，前端刷新时不会再看到）
        self.worker_service.delete_worker(worker_id)
        
        def _async_remote_uninstall():
            """后台执行远程卸载"""
            try:
                success, message = self.worker_service.remote_uninstall(
                    worker_id=worker_id,
                    ip_address=ip_address,
                    ssh_port=ssh_port,
                    username=username,
                    password=password
                )
                if success:
                    logger.info(f"Worker {worker_name} 远程卸载成功")
                else:
                    logger.warning(f"Worker {worker_name} 远程卸载: {message}")
                    # 卸载失败时发送通知
                    worker_delete_failed.send(
                        sender=self.__class__,
                        worker_name=worker_name,
                        message=message
                    )
            except Exception as e:
                logger.error(f"Worker {worker_name} 远程卸载失败: {e}")
                worker_delete_failed.send(
                    sender=self.__class__,
                    worker_name=worker_name,
                    message=str(e)
                )
        
        # 2. 后台线程执行远程卸载（不阻塞响应）
        threading.Thread(target=_async_remote_uninstall, daemon=True).start()
        
        # 3. 立即返回成功
        return Response(
            {"message": f"节点 {worker_name} 已删除"},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def heartbeat(self, request, pk=None):
        """接收心跳上报（写 Redis，首次心跳更新部署状态）"""
        from apps.engine.services.worker_load_service import worker_load_service
        
        worker = self.get_object()
        info = request.data if request.data else {}
        
        # 1. 写入 Redis（实时负载数据，TTL=60秒）
        cpu = info.get('cpu_percent', 0)
        mem = info.get('memory_percent', 0)
        worker_load_service.update_load(worker.id, cpu, mem)
        
        # 2. 首次心跳：更新状态为 online
        if worker.status not in ('online', 'offline'):
            worker.status = 'online'
            worker.save(update_fields=['status'])
        
        return Response({'status': 'ok'})
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        """
        Worker 自注册 API
        
        本地 Worker 启动时调用此接口注册自己。
        如果同名节点已存在，返回现有记录；否则创建新记录。
        
        请求体:
        {
            "name": "Local-Scan-Worker",
            "is_local": true
        }
        
        返回:
        {
            "worker_id": 1,
            "name": "Local-Scan-Worker",
            "created": false  # true 表示新创建，false 表示已存在
        }
        """
        name = request.data.get('name')
        is_local = request.data.get('is_local', True)
        
        if not name:
            return Response(
                {'error': '缺少 name 参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        worker, created = self.worker_service.register_worker(
            name=name,
            is_local=is_local
        )
        
        return Response({
            'worker_id': worker.id,
            'name': worker.name,
            'created': created
        })
    
    @action(detail=False, methods=['get'])
    def config(self, request):
        """
        获取任务容器配置
        
        任务容器启动时调用此接口获取完整配置，
        实现配置中心化管理，Worker 只需知道 SERVER_URL。
        
        返回:
        {
            "db": {"host": "...", "port": "...", ...},
            "redisUrl": "...",
            "paths": {"results": "...", "logs": "..."}
        }
        """
        from django.conf import settings
        
        return Response({
            'db': {
                'host': getattr(settings, 'WORKER_DB_HOST', settings.DATABASES['default']['HOST']),
                'port': str(settings.DATABASES['default']['PORT']),
                'name': settings.DATABASES['default']['NAME'],
                'user': settings.DATABASES['default']['USER'],
                'password': settings.DATABASES['default']['PASSWORD'],
            },
            'redisUrl': getattr(settings, 'WORKER_REDIS_URL', 'redis://redis:6379/0'),
            'paths': {
                'results': getattr(settings, 'CONTAINER_RESULTS_MOUNT', '/app/backend/results'),
                'logs': getattr(settings, 'CONTAINER_LOGS_MOUNT', '/app/backend/logs'),
            },
            'logging': {
                'level': os.getenv('LOG_LEVEL', 'INFO'),
                'enableCommandLogging': os.getenv('ENABLE_COMMAND_LOGGING', 'true').lower() == 'true',
            },
            'debug': settings.DEBUG
        })
