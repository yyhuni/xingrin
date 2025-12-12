"""HostPortMapping Repository - Django ORM 实现"""

import logging
from typing import List, Iterator

from apps.asset.models.asset_models import HostPortMapping
from apps.asset.dtos.asset import HostPortMappingDTO
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoHostPortMappingRepository:
    """HostPortMapping Repository - Django ORM 实现"""

    def bulk_create_ignore_conflicts(self, items: List[HostPortMappingDTO]) -> int:
        """
        批量创建主机端口关联（忽略冲突）
        
        Args:
            items: 主机端口关联 DTO 列表
        
        Returns:
            int: 实际创建的记录数（注意：ignore_conflicts 时可能为 0）
        
        Note:
            - 基于唯一约束 (target + host + ip + port) 自动去重
            - 忽略已存在的记录，不更新
        """
        try:
            logger.debug("准备批量创建主机端口关联 - 数量: %d", len(items))
            
            if not items:
                logger.debug("主机端口关联为空，跳过创建")
                return 0
                
            # 构建记录对象
            records = []
            for item in items:
                records.append(HostPortMapping(
                    target_id=item.target_id,
                    host=item.host,
                    ip=item.ip,
                    port=item.port
                ))
            
            # 批量创建（忽略冲突，基于唯一约束去重）
            created = HostPortMapping.objects.bulk_create(
                records, 
                ignore_conflicts=True
            )
            
            created_count = len(created) if created else 0
            logger.debug("主机端口关联创建完成 - 数量: %d", created_count)
            
            return created_count
            
        except Exception as e:
            logger.error(
                "批量创建主机端口关联失败 - 数量: %d, 错误: %s",
                len(items),
                str(e),
                exc_info=True
            )
            raise

    def get_for_export(self, target_id: int, batch_size: int = 1000):
        queryset = (
            HostPortMapping.objects
            .filter(target_id=target_id)
            .order_by("host", "port")
            .values("host", "port")
            .iterator(chunk_size=batch_size)
        )
        for item in queryset:
            yield item

    def get_ips_for_export(self, target_id: int, batch_size: int = 1000) -> Iterator[str]:
        """流式导出目标下的所有唯一 IP 地址。"""
        queryset = (
            HostPortMapping.objects
            .filter(target_id=target_id)
            .values_list("ip", flat=True)
            .distinct()
            .order_by("ip")
            .iterator(chunk_size=batch_size)
        )
        for ip in queryset:
            yield ip

    def get_ip_aggregation_by_target(self, target_id: int, search: str = None):
        from django.db.models import Min

        qs = HostPortMapping.objects.filter(target_id=target_id)
        if search:
            qs = qs.filter(ip__icontains=search)

        ip_aggregated = (
            qs
            .values('ip')
            .annotate(
                discovered_at=Min('discovered_at')
            )
            .order_by('-discovered_at')
        )

        results = []
        for item in ip_aggregated:
            ip = item['ip']
            mappings = (
                HostPortMapping.objects
                .filter(target_id=target_id, ip=ip)
                .values('host', 'port')
                .distinct()
            )

            hosts = sorted({m['host'] for m in mappings})
            ports = sorted({m['port'] for m in mappings})

            results.append({
                'ip': ip,
                'hosts': hosts,
                'ports': ports,
                'discovered_at': item['discovered_at'],
            })

        return results

    def get_all_ip_aggregation(self, search: str = None):
        """获取所有 IP 聚合数据（全局查询）"""
        from django.db.models import Min

        qs = HostPortMapping.objects.all()
        if search:
            qs = qs.filter(ip__icontains=search)

        ip_aggregated = (
            qs
            .values('ip')
            .annotate(
                discovered_at=Min('discovered_at')
            )
            .order_by('-discovered_at')
        )

        results = []
        for item in ip_aggregated:
            ip = item['ip']
            mappings = (
                HostPortMapping.objects
                .filter(ip=ip)
                .values('host', 'port')
                .distinct()
            )

            hosts = sorted({m['host'] for m in mappings})
            ports = sorted({m['port'] for m in mappings})

            results.append({
                'ip': ip,
                'hosts': hosts,
                'ports': ports,
                'discovered_at': item['discovered_at'],
            })

        return results
