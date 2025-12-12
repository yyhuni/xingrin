"""
WebSocket 路由配置
"""

from django.urls import path

# 延迟导入，避免循环依赖
from .consumers import NotificationConsumer

websocket_urlpatterns = [
    path('ws/notifications/', NotificationConsumer.as_asgi()),
]
