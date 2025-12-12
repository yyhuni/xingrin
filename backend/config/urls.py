"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

from apps.scan.notifications.views import NotificationSettingsView

# API 文档配置
schema_view = get_schema_view(
   openapi.Info(
      title="XingRin API",
      default_version='v1',
      description="Web 应用侦察工具 API 文档",
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    # Django 后台管理
    path('admin/', admin.site.urls),
    
    # API 文档
    path('api/swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='swagger'),
    path('api/redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='redoc'),
    
    # 业务 API（包含 organizations 和 targets）
    path('api/', include('apps.targets.urls')),
    
    # 扫描 API
    path('api/', include('apps.scan.urls')),
    
    # 引擎 & Worker API
    path('api/', include('apps.engine.urls')),
    
    # 资产 API
    path('api/', include('apps.asset.urls')),
    
    # 通知 API
    path('api/notifications/', include('apps.scan.notifications.urls')),
    
    # 通知设置 API
    path('api/settings/notifications/', NotificationSettingsView.as_view(), name='notification-settings'),
    
    # 认证 API
    path('api/', include('apps.common.urls')),
]
