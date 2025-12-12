"""资产统计 Service"""
import logging
from typing import Optional

from django.db.models import Count

from apps.asset.repositories import AssetStatisticsRepository
from apps.asset.models import (
    AssetStatistics,
    StatisticsHistory,
    Subdomain,
    WebSite,
    Endpoint,
    HostPortMapping,
    Vulnerability,
)
from apps.targets.models import Target
from apps.scan.models import Scan

logger = logging.getLogger(__name__)


class AssetStatisticsService:
    """
    资产统计服务
    
    职责：
    - 获取统计数据
    - 刷新统计数据（供定时任务调用）
    """

    def __init__(self):
        self.repo = AssetStatisticsRepository()

    def get_statistics(self) -> dict:
        """
        获取统计数据
        
        Returns:
            统计数据字典
        """
        stats = self.repo.get_statistics()
        
        if stats is None:
            # 如果没有统计数据，返回默认值
            return {
                'total_targets': 0,
                'total_subdomains': 0,
                'total_ips': 0,
                'total_endpoints': 0,
                'total_websites': 0,
                'total_vulns': 0,
                'total_assets': 0,
                'running_scans': Scan.objects.filter(status='running').count(),
                'updated_at': None,
                # 变化值
                'change_targets': 0,
                'change_subdomains': 0,
                'change_ips': 0,
                'change_endpoints': 0,
                'change_websites': 0,
                'change_vulns': 0,
                'change_assets': 0,
                'vuln_by_severity': self._get_vuln_by_severity(),
            }
        
        # 运行中的扫描数量实时查询（数量小，无需缓存）
        running_scans = Scan.objects.filter(status='running').count()
        
        return {
            'total_targets': stats.total_targets,
            'total_subdomains': stats.total_subdomains,
            'total_ips': stats.total_ips,
            'total_endpoints': stats.total_endpoints,
            'total_websites': stats.total_websites,
            'total_vulns': stats.total_vulns,
            'total_assets': stats.total_assets,
            'running_scans': running_scans,
            'updated_at': stats.updated_at,
            # 变化值 = 当前值 - 上次值
            'change_targets': stats.total_targets - stats.prev_targets,
            'change_subdomains': stats.total_subdomains - stats.prev_subdomains,
            'change_ips': stats.total_ips - stats.prev_ips,
            'change_endpoints': stats.total_endpoints - stats.prev_endpoints,
            'change_websites': stats.total_websites - stats.prev_websites,
            'change_vulns': stats.total_vulns - stats.prev_vulns,
            'change_assets': stats.total_assets - stats.prev_assets,
            # 漏洞严重程度分布
            'vuln_by_severity': self._get_vuln_by_severity(),
        }
    
    def _get_vuln_by_severity(self) -> dict:
        """获取按严重程度统计的漏洞数量"""
        result = Vulnerability.objects.values('severity').annotate(count=Count('id'))
        severity_map = {item['severity']: item['count'] for item in result}
        return {
            'critical': severity_map.get('critical', 0),
            'high': severity_map.get('high', 0),
            'medium': severity_map.get('medium', 0),
            'low': severity_map.get('low', 0),
            'info': severity_map.get('info', 0),
        }

    def refresh_statistics(self) -> AssetStatistics:
        """
        刷新统计数据（执行实际 COUNT 查询）
        
        供定时任务调用，不建议在接口中直接调用。
        
        Returns:
            更新后的统计数据对象
        """
        logger.info("开始刷新资产统计...")
        
        # 执行 COUNT 查询
        total_targets = Target.objects.filter(deleted_at__isnull=True).count()
        total_subdomains = Subdomain.objects.count()
        total_ips = HostPortMapping.objects.values('ip').distinct().count()
        total_endpoints = Endpoint.objects.count()
        total_websites = WebSite.objects.count()
        total_vulns = Vulnerability.objects.count()
        
        # 更新统计表
        stats = self.repo.update_statistics(
            total_targets=total_targets,
            total_subdomains=total_subdomains,
            total_ips=total_ips,
            total_endpoints=total_endpoints,
            total_websites=total_websites,
            total_vulns=total_vulns,
        )
        
        # 保存每日快照（用于折线图）
        self.repo.save_daily_snapshot(stats)
        
        logger.info("资产统计刷新完成")
        return stats

    def get_statistics_history(self, days: int = 7) -> list[dict]:
        """
        获取历史统计数据（用于折线图）
        
        Args:
            days: 获取最近多少天的数据，默认 7 天
        
        Returns:
            历史数据列表，每项包含 date 和各统计字段
        """
        history = self.repo.get_history(days=days)
        return [
            {
                'date': h.date.isoformat(),
                'totalTargets': h.total_targets,
                'totalSubdomains': h.total_subdomains,
                'totalIps': h.total_ips,
                'totalEndpoints': h.total_endpoints,
                'totalWebsites': h.total_websites,
                'totalVulns': h.total_vulns,
                'totalAssets': h.total_assets,
            }
            for h in history
        ]
