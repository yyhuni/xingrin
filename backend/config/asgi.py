"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# 初始化 Django ASGI 应用（必须在导入路由之前）
django_asgi_app = get_asgi_application()

# 导入 WebSocket 路由
from apps.scan.notifications.routing import websocket_urlpatterns as notification_ws
from apps.engine.routing import websocket_urlpatterns as worker_ws

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AuthMiddlewareStack(
        URLRouter(notification_ws + worker_ws)
    ),
})
