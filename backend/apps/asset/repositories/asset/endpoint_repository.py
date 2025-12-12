"""Endpoint Repository - Django ORM 实现"""

import logging
from typing import List, Optional, Tuple, Dict, Any

from apps.asset.models import Endpoint
from apps.asset.dtos.asset import EndpointDTO
from apps.common.decorators import auto_ensure_db_connection
from django.db import transaction

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoEndpointRepository:
    """端点 Repository - 负责端点表的数据访问"""
    
    def bulk_create_ignore_conflicts(self, items: List[EndpointDTO]) -> int:
        """
        批量创建端点（忽略冲突）
        
        Args:
            items: 端点 DTO 列表
            
        Returns:
            int: 创建的记录数
        """
        if not items:
            return 0
        
        try:
            endpoints = []
            for item in items:
                # Endpoint 模型当前只关联 target，不再依赖 website 外键
                # 这里按照 EndpointDTO 的字段映射构造 Endpoint 实例
                endpoints.append(Endpoint(
                    target_id=item.target_id,
                    url=item.url,
                    host=item.host or '',
                    title=item.title or '',
                    status_code=item.status_code,
                    content_length=item.content_length,
                    webserver=item.webserver or '',
                    body_preview=item.body_preview or '',
                    content_type=item.content_type or '',
                    tech=item.tech if item.tech else [],
                    vhost=item.vhost,
                    location=item.location or '',
                    matched_gf_patterns=item.matched_gf_patterns if item.matched_gf_patterns else []
                ))
            
            with transaction.atomic():
                created = Endpoint.objects.bulk_create(
                    endpoints,
                    ignore_conflicts=True,
                    batch_size=1000
                )
                return len(created)
                
        except Exception as e:
            logger.error(f"批量创建端点失败: {e}")
            raise
    
    def get_by_website(self, website_id: int) -> List[EndpointDTO]:
        """
        获取网站下的所有端点
        
        Args:
            website_id: 网站 ID
            
        Returns:
            List[EndpointDTO]: 端点列表
        """
        endpoints = Endpoint.objects.filter(
            website_id=website_id
        ).order_by('-discovered_at')
        
        result = []
        for endpoint in endpoints:
            result.append(EndpointDTO(
                website_id=endpoint.website_id,
                target_id=endpoint.target_id,
                url=endpoint.url,
                title=endpoint.title,
                status_code=endpoint.status_code,
                content_length=endpoint.content_length,
                webserver=endpoint.webserver,
                body_preview=endpoint.body_preview,
                content_type=endpoint.content_type,
                tech=endpoint.tech,
                vhost=endpoint.vhost,
                location=endpoint.location,
                matched_gf_patterns=endpoint.matched_gf_patterns
            ))
        
        return result
    
    def get_queryset_by_target(self, target_id: int):
        return Endpoint.objects.filter(target_id=target_id).order_by('-discovered_at')

    def get_all(self):
        """获取所有端点（全局查询）"""
        return Endpoint.objects.all().order_by('-discovered_at')
    
    def get_by_target(self, target_id: int) -> List[EndpointDTO]:
        """
        获取目标下的所有端点
        
        Args:
            target_id: 目标 ID
            
        Returns:
            List[EndpointDTO]: 端点列表
        """
        endpoints = Endpoint.objects.filter(
            target_id=target_id
        ).order_by('-discovered_at')
        
        result = []
        for endpoint in endpoints:
            result.append(EndpointDTO(
                website_id=endpoint.website_id,
                target_id=endpoint.target_id,
                url=endpoint.url,
                title=endpoint.title,
                status_code=endpoint.status_code,
                content_length=endpoint.content_length,
                webserver=endpoint.webserver,
                body_preview=endpoint.body_preview,
                content_type=endpoint.content_type,
                tech=endpoint.tech,
                vhost=endpoint.vhost,
                location=endpoint.location,
                matched_gf_patterns=endpoint.matched_gf_patterns
            ))
        
        return result
    
    def count_by_website(self, website_id: int) -> int:
        """
        统计网站下的端点数量
        
        Args:
            website_id: 网站 ID
            
        Returns:
            int: 端点数量
        """
        return Endpoint.objects.filter(website_id=website_id).count()
    
    def count_by_target(self, target_id: int) -> int:
        """
        统计目标下的端点数量
        
        Args:
            target_id: 目标 ID
            
        Returns:
            int: 端点数量
        """
        return Endpoint.objects.filter(target_id=target_id).count()
    
    def soft_delete_by_ids(self, ids: List[int]) -> int:
        """
        软删除端点（批量）
        
        Args:
            ids: 端点 ID 列表
            
        Returns:
            int: 更新的记录数
        """
        from django.utils import timezone
        return Endpoint.objects.filter(
            id__in=ids
        ).update(deleted_at=timezone.now())
    
    def hard_delete_by_ids(self, ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        硬删除端点（批量）
        
        Args:
            ids: 端点 ID 列表
            
        Returns:
            Tuple[int, Dict[str, int]]: (删除总数, 详细信息)
        """
        deleted_count, details = Endpoint.all_objects.filter(
            id__in=ids
        ).delete()
        
        return deleted_count, details
