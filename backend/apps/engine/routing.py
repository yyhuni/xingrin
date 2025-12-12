"""
Worker WebSocket 路由配置
"""

from django.urls import path
from .consumers import WorkerDeployConsumer

websocket_urlpatterns = [
    path('ws/workers/<int:worker_id>/deploy/', WorkerDeployConsumer.as_asgi()),
]
