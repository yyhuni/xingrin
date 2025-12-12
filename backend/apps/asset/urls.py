"""
Asset 应用 URL 配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SubdomainViewSet,
    WebSiteViewSet,
    DirectoryViewSet,
    VulnerabilityViewSet,
    AssetStatisticsViewSet,
)

# 创建 DRF 路由器
router = DefaultRouter()

# 注册 ViewSet
# 注意：IPAddress 模型已被重构为 HostPortMapping，相关路由已移除
router.register(r'subdomains', SubdomainViewSet, basename='subdomain')
router.register(r'websites', WebSiteViewSet, basename='website')
router.register(r'directories', DirectoryViewSet, basename='directory')
router.register(r'vulnerabilities', VulnerabilityViewSet, basename='vulnerability')
router.register(r'statistics', AssetStatisticsViewSet, basename='asset-statistics')

urlpatterns = [
    path('assets/', include(router.urls)),
]
