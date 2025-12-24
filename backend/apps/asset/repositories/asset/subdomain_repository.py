"""Subdomain Repository - Django ORM 实现"""

import logging
from typing import List, Iterator

from django.db import transaction

from apps.asset.models.asset_models import Subdomain
from apps.asset.dtos import SubdomainDTO
from apps.common.decorators import auto_ensure_db_connection
from apps.common.utils import deduplicate_for_bulk

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoSubdomainRepository:
    """基于 Django ORM 的子域名仓储实现"""

    def bulk_create_ignore_conflicts(self, items: List[SubdomainDTO]) -> None:
        """
        批量创建子域名，忽略冲突
        
        注意：自动按模型唯一约束去重，保留最后一条记录。
        
        Args:
            items: 子域名 DTO 列表
        """
        if not items:
            return

        try:
            # 自动按模型唯一约束去重
            unique_items = deduplicate_for_bulk(items, Subdomain)
            
            subdomain_objects = [
                Subdomain(
                    name=item.name,
                    target_id=item.target_id,
                )
                for item in unique_items
            ]

            with transaction.atomic():
                Subdomain.objects.bulk_create(
                    subdomain_objects,
                    ignore_conflicts=True,
                )

            logger.debug(f"成功处理 {len(unique_items)} 条子域名记录")

        except Exception as e:
            logger.error(f"批量插入子域名失败: {e}")
            raise
    
    def get_all(self):
        """获取所有子域名"""
        return Subdomain.objects.all().order_by('-created_at')

    def get_by_target(self, target_id: int):
        """获取目标下的所有子域名"""
        return Subdomain.objects.filter(target_id=target_id).order_by('-created_at')
    
    def count_by_target(self, target_id: int) -> int:
        """统计目标下的域名数量"""
        return Subdomain.objects.filter(target_id=target_id).count()
    
    def get_domains_for_export(self, target_id: int, batch_size: int = 1000) -> Iterator[str]:
        """流式导出域名"""
        queryset = Subdomain.objects.filter(
            target_id=target_id
        ).only('name').iterator(chunk_size=batch_size)
        
        for subdomain in queryset:
            yield subdomain.name
    
    def get_by_names_and_target_id(self, names: set, target_id: int) -> dict:
        """根据域名列表和目标ID批量查询 Subdomain"""
        subdomains = Subdomain.objects.filter(
            name__in=names,
            target_id=target_id
        ).only('id', 'name')
        
        return {sd.name: sd for sd in subdomains}

    def iter_raw_data_for_export(
        self, 
        target_id: int,
        batch_size: int = 1000
    ) -> Iterator[dict]:
        """
        流式获取原始数据用于 CSV 导出
        
        Args:
            target_id: 目标 ID
            batch_size: 每批数据量
        
        Yields:
            {'name': 'sub.example.com', 'discovered_at': datetime}
        """
        qs = (
            Subdomain.objects
            .filter(target_id=target_id)
            .values('name', 'discovered_at')
            .order_by('name')
        )
        
        for row in qs.iterator(chunk_size=batch_size):
            yield row
