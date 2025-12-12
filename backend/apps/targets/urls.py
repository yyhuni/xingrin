from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrganizationViewSet, TargetViewSet
from apps.asset.views import (
    SubdomainViewSet, WebSiteViewSet, DirectoryViewSet,
    EndpointViewSet, HostPortMappingViewSet, VulnerabilityViewSet
)

# 创建路由器
router = DefaultRouter()

# 注册 ViewSet
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'targets', TargetViewSet, basename='target')

# Target 下的嵌套资产路由
target_subdomains_list = SubdomainViewSet.as_view({'get': 'list'})
target_subdomains_export = SubdomainViewSet.as_view({'get': 'export'})
target_websites_list = WebSiteViewSet.as_view({'get': 'list'})
target_websites_export = WebSiteViewSet.as_view({'get': 'export'})
target_directories_list = DirectoryViewSet.as_view({'get': 'list'})
target_directories_export = DirectoryViewSet.as_view({'get': 'export'})
target_endpoints_list = EndpointViewSet.as_view({'get': 'list'})
target_endpoints_export = EndpointViewSet.as_view({'get': 'export'})
target_ip_addresses_list = HostPortMappingViewSet.as_view({'get': 'list'})
target_ip_addresses_export = HostPortMappingViewSet.as_view({'get': 'export'})
target_vulnerabilities_list = VulnerabilityViewSet.as_view({'get': 'list'})

urlpatterns = [
    path('', include(router.urls)),
    # 嵌套路由：/api/targets/{target_pk}/xxx/
    path('targets/<int:target_pk>/subdomains/', target_subdomains_list, name='target-subdomains-list'),
    path('targets/<int:target_pk>/subdomains/export/', target_subdomains_export, name='target-subdomains-export'),
    path('targets/<int:target_pk>/websites/', target_websites_list, name='target-websites-list'),
    path('targets/<int:target_pk>/websites/export/', target_websites_export, name='target-websites-export'),
    path('targets/<int:target_pk>/directories/', target_directories_list, name='target-directories-list'),
    path('targets/<int:target_pk>/directories/export/', target_directories_export, name='target-directories-export'),
    path('targets/<int:target_pk>/endpoints/', target_endpoints_list, name='target-endpoints-list'),
    path('targets/<int:target_pk>/endpoints/export/', target_endpoints_export, name='target-endpoints-export'),
    path('targets/<int:target_pk>/ip-addresses/', target_ip_addresses_list, name='target-ip-addresses-list'),
    path('targets/<int:target_pk>/ip-addresses/export/', target_ip_addresses_export, name='target-ip-addresses-export'),
    path('targets/<int:target_pk>/vulnerabilities/', target_vulnerabilities_list, name='target-vulnerabilities-list'),
]
