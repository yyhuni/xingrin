import logging
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.exceptions import NotFound, ValidationError as DRFValidationError
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from django.db import DatabaseError, IntegrityError, OperationalError
from django.http import StreamingHttpResponse

from .serializers import (
    SubdomainListSerializer, WebSiteSerializer, DirectorySerializer, 
    VulnerabilitySerializer, EndpointListSerializer, IPAddressAggregatedSerializer,
    SubdomainSnapshotSerializer, WebsiteSnapshotSerializer, DirectorySnapshotSerializer,
    EndpointSnapshotSerializer, VulnerabilitySnapshotSerializer
)
from .services import (
    SubdomainService, WebSiteService, DirectoryService, 
    VulnerabilityService, AssetStatisticsService, EndpointService, HostPortMappingService
)
from .services.snapshot import (
    SubdomainSnapshotsService, WebsiteSnapshotsService, DirectorySnapshotsService,
    EndpointSnapshotsService, HostPortMappingSnapshotsService, VulnerabilitySnapshotsService
)
from apps.common.pagination import BasePagination

logger = logging.getLogger(__name__)


class AssetStatisticsViewSet(viewsets.ViewSet):
    """
    资产统计 API
    
    提供仪表盘所需的统计数据（预聚合，读取缓存表）
    """
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = AssetStatisticsService()
    
    def list(self, request):
        """
        获取资产统计数据
        
        GET /assets/statistics/
        
        返回:
        - totalTargets: 目标总数
        - totalSubdomains: 子域名总数
        - totalIps: IP 总数
        - totalEndpoints: 端点总数
        - totalWebsites: 网站总数
        - totalVulns: 漏洞总数
        - totalAssets: 总资产数
        - runningScans: 运行中的扫描数
        - updatedAt: 统计更新时间
        """
        try:
            stats = self.service.get_statistics()
            return Response({
                'totalTargets': stats['total_targets'],
                'totalSubdomains': stats['total_subdomains'],
                'totalIps': stats['total_ips'],
                'totalEndpoints': stats['total_endpoints'],
                'totalWebsites': stats['total_websites'],
                'totalVulns': stats['total_vulns'],
                'totalAssets': stats['total_assets'],
                'runningScans': stats['running_scans'],
                'updatedAt': stats['updated_at'],
                # 变化值
                'changeTargets': stats['change_targets'],
                'changeSubdomains': stats['change_subdomains'],
                'changeIps': stats['change_ips'],
                'changeEndpoints': stats['change_endpoints'],
                'changeWebsites': stats['change_websites'],
                'changeVulns': stats['change_vulns'],
                'changeAssets': stats['change_assets'],
                # 漏洞严重程度分布
                'vulnBySeverity': stats['vuln_by_severity'],
            })
        except (DatabaseError, OperationalError) as e:
            logger.exception("获取资产统计数据失败")
            return Response(
                {'error': '获取统计数据失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request: Request):
        """
        获取统计历史数据（用于折线图）
        
        GET /assets/statistics/history/?days=7
        
        Query Parameters:
            days: 获取最近多少天的数据，默认 7，最大 90
        
        Returns:
            历史数据列表
        """
        try:
            days_param = request.query_params.get('days', '7')
            try:
                days = int(days_param)
            except (ValueError, TypeError):
                days = 7
            days = min(max(days, 1), 90)  # 限制在 1-90 天
            
            history = self.service.get_statistics_history(days=days)
            return Response(history)
        except (DatabaseError, OperationalError) as e:
            logger.exception("获取统计历史数据失败")
            return Response(
                {'error': '获取历史数据失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# 注意：IPAddress 模型已被重构为 HostPortMapping
# IPAddressViewSet 已删除，需要根据新架构重新实现


class SubdomainViewSet(viewsets.ModelViewSet):
    """子域名管理 ViewSet
    
    支持两种访问方式：
    1. 嵌套路由：GET /api/targets/{target_pk}/subdomains/
    2. 独立路由：GET /api/subdomains/（全局查询）
    """
    
    serializer_class = SubdomainListSerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = SubdomainService()
    
    def get_queryset(self):
        """根据是否有 target_pk 参数决定查询范围"""
        target_pk = self.kwargs.get('target_pk')
        if target_pk:
            return self.service.get_subdomains_by_target(target_pk)
        return self.service.get_all()

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """导出子域名（纯文本，一行一个）"""
        target_pk = self.kwargs.get('target_pk')
        if not target_pk:
            raise DRFValidationError('必须在目标下导出')
        
        def line_iterator():
            for name in self.service.iter_subdomain_names_by_target(target_pk):
                yield f"{name}\n"

        response = StreamingHttpResponse(
            line_iterator(),
            content_type='text/plain; charset=utf-8',
        )
        response['Content-Disposition'] = f'attachment; filename="target-{target_pk}-subdomains.txt"'
        return response


class WebSiteViewSet(viewsets.ModelViewSet):
    """站点管理 ViewSet
    
    支持两种访问方式：
    1. 嵌套路由：GET /api/targets/{target_pk}/websites/
    2. 独立路由：GET /api/websites/（全局查询）
    """
    
    serializer_class = WebSiteSerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['host']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = WebSiteService()
    
    def get_queryset(self):
        """根据是否有 target_pk 参数决定查询范围"""
        target_pk = self.kwargs.get('target_pk')
        if target_pk:
            return self.service.get_websites_by_target(target_pk)
        return self.service.get_all()

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """导出站点 URL（纯文本，一行一个）"""
        target_pk = self.kwargs.get('target_pk')
        if not target_pk:
            raise DRFValidationError('必须在目标下导出')
        
        def line_iterator():
            for url in self.service.iter_website_urls_by_target(target_pk):
                yield f"{url}\n"

        response = StreamingHttpResponse(
            line_iterator(),
            content_type='text/plain; charset=utf-8',
        )
        response['Content-Disposition'] = f'attachment; filename="target-{target_pk}-websites.txt"'
        return response


class DirectoryViewSet(viewsets.ModelViewSet):
    """目录管理 ViewSet
    
    支持两种访问方式：
    1. 嵌套路由：GET /api/targets/{target_pk}/directories/
    2. 独立路由：GET /api/directories/（全局查询）
    """
    
    serializer_class = DirectorySerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['url']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = DirectoryService()
    
    def get_queryset(self):
        """根据是否有 target_pk 参数决定查询范围"""
        target_pk = self.kwargs.get('target_pk')
        if target_pk:
            return self.service.get_directories_by_target(target_pk)
        return self.service.get_all()

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """导出目录 URL（纯文本，一行一个）"""
        target_pk = self.kwargs.get('target_pk')
        if not target_pk:
            raise DRFValidationError('必须在目标下导出')
        
        def line_iterator():
            for url in self.service.iter_directory_urls_by_target(target_pk):
                yield f"{url}\n"

        response = StreamingHttpResponse(
            line_iterator(),
            content_type='text/plain; charset=utf-8',
        )
        response['Content-Disposition'] = f'attachment; filename="target-{target_pk}-directories.txt"'
        return response


class EndpointViewSet(viewsets.ModelViewSet):
    """端点管理 ViewSet
    
    支持两种访问方式：
    1. 嵌套路由：GET /api/targets/{target_pk}/endpoints/
    2. 独立路由：GET /api/endpoints/（全局查询）
    """
    
    serializer_class = EndpointListSerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['host']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = EndpointService()
    
    def get_queryset(self):
        """根据是否有 target_pk 参数决定查询范围"""
        target_pk = self.kwargs.get('target_pk')
        if target_pk:
            return self.service.get_queryset_by_target(target_pk)
        return self.service.get_all()

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """导出端点 URL（纯文本，一行一个）"""
        target_pk = self.kwargs.get('target_pk')
        if not target_pk:
            raise DRFValidationError('必须在目标下导出')
        
        def line_iterator():
            for url in self.service.iter_endpoint_urls_by_target(target_pk):
                yield f"{url}\n"

        response = StreamingHttpResponse(
            line_iterator(),
            content_type='text/plain; charset=utf-8',
        )
        response['Content-Disposition'] = f'attachment; filename="target-{target_pk}-endpoints.txt"'
        return response


class HostPortMappingViewSet(viewsets.ModelViewSet):
    """主机端口映射管理 ViewSet（IP 地址聚合视图）
    
    支持两种访问方式：
    1. 嵌套路由：GET /api/targets/{target_pk}/ip-addresses/
    2. 独立路由：GET /api/ip-addresses/（全局查询）
    
    返回按 IP 聚合的数据，每个 IP 显示其关联的所有 hosts 和 ports
    
    注意：由于返回的是聚合数据（字典列表），不支持 DRF SearchFilter
    """
    
    serializer_class = IPAddressAggregatedSerializer
    pagination_class = BasePagination
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = HostPortMappingService()
    
    def get_queryset(self):
        """根据是否有 target_pk 参数决定查询范围，返回按 IP 聚合的数据"""
        target_pk = self.kwargs.get('target_pk')
        search = self.request.query_params.get('search', None)
        if target_pk:
            return self.service.get_ip_aggregation_by_target(target_pk, search=search)
        return self.service.get_all_ip_aggregation(search=search)

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """导出 IP 地址（纯文本，一行一个）"""
        target_pk = self.kwargs.get('target_pk')
        if not target_pk:
            raise DRFValidationError('必须在目标下导出')
        
        def line_iterator():
            for ip in self.service.iter_ips_by_target(target_pk):
                yield f"{ip}\n"

        response = StreamingHttpResponse(
            line_iterator(),
            content_type='text/plain; charset=utf-8',
        )
        response['Content-Disposition'] = f'attachment; filename="target-{target_pk}-ip-addresses.txt"'
        return response


class VulnerabilityViewSet(viewsets.ModelViewSet):
    """漏洞资产管理 ViewSet（只读）
    
    支持两种访问方式：
    1. 嵌套路由：GET /api/targets/{target_pk}/vulnerabilities/
    2. 独立路由：GET /api/vulnerabilities/（全局查询）
    """
    
    serializer_class = VulnerabilitySerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['vuln_type']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = VulnerabilityService()
    
    def get_queryset(self):
        """根据是否有 target_pk 参数决定查询范围"""
        target_pk = self.kwargs.get('target_pk')
        if target_pk:
            return self.service.get_queryset_by_target(target_pk)
        return self.service.get_all()


# ==================== 快照 ViewSet（Scan 嵌套路由） ====================

class SubdomainSnapshotViewSet(viewsets.ModelViewSet):
    """子域名快照 ViewSet - 嵌套路由：GET /api/scans/{scan_pk}/subdomains/"""
    
    serializer_class = SubdomainSnapshotSerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'discovered_at']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = SubdomainSnapshotsService()
    
    def get_queryset(self):
        scan_pk = self.kwargs.get('scan_pk')
        if scan_pk:
            return self.service.get_by_scan(scan_pk)
        return self.service.get_all()

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        scan_pk = self.kwargs.get('scan_pk')
        if not scan_pk:
            raise DRFValidationError('必须在扫描下导出')
        
        def line_iterator():
            for name in self.service.iter_subdomain_names_by_scan(scan_pk):
                yield f"{name}\n"

        response = StreamingHttpResponse(line_iterator(), content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="scan-{scan_pk}-subdomains.txt"'
        return response


class WebsiteSnapshotViewSet(viewsets.ModelViewSet):
    """网站快照 ViewSet - 嵌套路由：GET /api/scans/{scan_pk}/websites/"""
    
    serializer_class = WebsiteSnapshotSerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['host']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = WebsiteSnapshotsService()
    
    def get_queryset(self):
        scan_pk = self.kwargs.get('scan_pk')
        if scan_pk:
            return self.service.get_by_scan(scan_pk)
        return self.service.get_all()

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        scan_pk = self.kwargs.get('scan_pk')
        if not scan_pk:
            raise DRFValidationError('必须在扫描下导出')
        
        def line_iterator():
            for url in self.service.iter_website_urls_by_scan(scan_pk):
                yield f"{url}\n"

        response = StreamingHttpResponse(line_iterator(), content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="scan-{scan_pk}-websites.txt"'
        return response


class DirectorySnapshotViewSet(viewsets.ModelViewSet):
    """目录快照 ViewSet - 嵌套路由：GET /api/scans/{scan_pk}/directories/"""
    
    serializer_class = DirectorySnapshotSerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['url']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = DirectorySnapshotsService()
    
    def get_queryset(self):
        scan_pk = self.kwargs.get('scan_pk')
        if scan_pk:
            return self.service.get_by_scan(scan_pk)
        return self.service.get_all()

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        scan_pk = self.kwargs.get('scan_pk')
        if not scan_pk:
            raise DRFValidationError('必须在扫描下导出')
        
        def line_iterator():
            for url in self.service.iter_directory_urls_by_scan(scan_pk):
                yield f"{url}\n"

        response = StreamingHttpResponse(line_iterator(), content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="scan-{scan_pk}-directories.txt"'
        return response


class EndpointSnapshotViewSet(viewsets.ModelViewSet):
    """端点快照 ViewSet - 嵌套路由：GET /api/scans/{scan_pk}/endpoints/"""
    
    serializer_class = EndpointSnapshotSerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['host']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = EndpointSnapshotsService()
    
    def get_queryset(self):
        scan_pk = self.kwargs.get('scan_pk')
        if scan_pk:
            return self.service.get_by_scan(scan_pk)
        return self.service.get_all()

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        scan_pk = self.kwargs.get('scan_pk')
        if not scan_pk:
            raise DRFValidationError('必须在扫描下导出')
        
        def line_iterator():
            for url in self.service.iter_endpoint_urls_by_scan(scan_pk):
                yield f"{url}\n"

        response = StreamingHttpResponse(line_iterator(), content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="scan-{scan_pk}-endpoints.txt"'
        return response


class HostPortMappingSnapshotViewSet(viewsets.ModelViewSet):
    """主机端口映射快照 ViewSet - 嵌套路由：GET /api/scans/{scan_pk}/ip-addresses/
    
    注意：由于返回的是聚合数据（字典列表），不支持 DRF SearchFilter
    """
    
    serializer_class = IPAddressAggregatedSerializer
    pagination_class = BasePagination
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = HostPortMappingSnapshotsService()
    
    def get_queryset(self):
        scan_pk = self.kwargs.get('scan_pk')
        search = self.request.query_params.get('search', None)
        if scan_pk:
            return self.service.get_ip_aggregation_by_scan(scan_pk, search=search)
        return self.service.get_all_ip_aggregation(search=search)

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        scan_pk = self.kwargs.get('scan_pk')
        if not scan_pk:
            raise DRFValidationError('必须在扫描下导出')
        
        def line_iterator():
            for ip in self.service.iter_ips_by_scan(scan_pk):
                yield f"{ip}\n"

        response = StreamingHttpResponse(line_iterator(), content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="scan-{scan_pk}-ip-addresses.txt"'
        return response


class VulnerabilitySnapshotViewSet(viewsets.ModelViewSet):
    """漏洞快照 ViewSet - 嵌套路由：GET /api/scans/{scan_pk}/vulnerabilities/"""
    
    serializer_class = VulnerabilitySnapshotSerializer
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['vuln_type']
    ordering = ['-discovered_at']
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.service = VulnerabilitySnapshotsService()
    
    def get_queryset(self):
        scan_pk = self.kwargs.get('scan_pk')
        if scan_pk:
            return self.service.get_by_scan(scan_pk)
        return self.service.get_all()
