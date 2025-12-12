from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ScanViewSet, ScheduledScanViewSet
from .notifications.views import notification_callback
from apps.asset.views import (
    SubdomainSnapshotViewSet, WebsiteSnapshotViewSet, DirectorySnapshotViewSet,
    EndpointSnapshotViewSet, HostPortMappingSnapshotViewSet, VulnerabilitySnapshotViewSet
)

# 创建路由器
router = DefaultRouter()

# 注册 ViewSet
router.register(r'scans', ScanViewSet, basename='scan')
router.register(r'scheduled-scans', ScheduledScanViewSet, basename='scheduled-scan')

# Scan 下的嵌套快照路由
scan_subdomains_list = SubdomainSnapshotViewSet.as_view({'get': 'list'})
scan_subdomains_export = SubdomainSnapshotViewSet.as_view({'get': 'export'})
scan_websites_list = WebsiteSnapshotViewSet.as_view({'get': 'list'})
scan_websites_export = WebsiteSnapshotViewSet.as_view({'get': 'export'})
scan_directories_list = DirectorySnapshotViewSet.as_view({'get': 'list'})
scan_directories_export = DirectorySnapshotViewSet.as_view({'get': 'export'})
scan_endpoints_list = EndpointSnapshotViewSet.as_view({'get': 'list'})
scan_endpoints_export = EndpointSnapshotViewSet.as_view({'get': 'export'})
scan_ip_addresses_list = HostPortMappingSnapshotViewSet.as_view({'get': 'list'})
scan_ip_addresses_export = HostPortMappingSnapshotViewSet.as_view({'get': 'export'})
scan_vulnerabilities_list = VulnerabilitySnapshotViewSet.as_view({'get': 'list'})

urlpatterns = [
    path('', include(router.urls)),
    # Worker 回调 API
    path('callbacks/notification/', notification_callback, name='notification-callback'),
    # 嵌套路由：/api/scans/{scan_pk}/xxx/
    path('scans/<int:scan_pk>/subdomains/', scan_subdomains_list, name='scan-subdomains-list'),
    path('scans/<int:scan_pk>/subdomains/export/', scan_subdomains_export, name='scan-subdomains-export'),
    path('scans/<int:scan_pk>/websites/', scan_websites_list, name='scan-websites-list'),
    path('scans/<int:scan_pk>/websites/export/', scan_websites_export, name='scan-websites-export'),
    path('scans/<int:scan_pk>/directories/', scan_directories_list, name='scan-directories-list'),
    path('scans/<int:scan_pk>/directories/export/', scan_directories_export, name='scan-directories-export'),
    path('scans/<int:scan_pk>/endpoints/', scan_endpoints_list, name='scan-endpoints-list'),
    path('scans/<int:scan_pk>/endpoints/export/', scan_endpoints_export, name='scan-endpoints-export'),
    path('scans/<int:scan_pk>/ip-addresses/', scan_ip_addresses_list, name='scan-ip-addresses-list'),
    path('scans/<int:scan_pk>/ip-addresses/export/', scan_ip_addresses_export, name='scan-ip-addresses-export'),
    path('scans/<int:scan_pk>/vulnerabilities/', scan_vulnerabilities_list, name='scan-vulnerabilities-list'),
]

