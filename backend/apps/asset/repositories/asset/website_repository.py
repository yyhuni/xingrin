"""
Django ORM 实现的 WebSite Repository
"""

import logging
from typing import List, Generator, Tuple, Dict, Optional
from django.db import transaction, IntegrityError, OperationalError, DatabaseError
from django.utils import timezone

from apps.asset.models.asset_models import WebSite
from apps.asset.dtos import WebSiteDTO
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)



@auto_ensure_db_connection
class DjangoWebSiteRepository:
    """Django ORM 实现的 WebSite Repository"""

    def bulk_create_ignore_conflicts(self, items: List[WebSiteDTO]) -> None:
        """
        批量创建 WebSite，忽略冲突
        
        Args:
            items: WebSite DTO 列表
            
        Raises:
            IntegrityError: 数据完整性错误
            OperationalError: 数据库操作错误
            DatabaseError: 数据库错误
        """
        if not items:
            return

        try:
            # 转换为 Django 模型对象
            website_objects = [
                WebSite(
                    target_id=item.target_id,
                    url=item.url,
                    host=item.host,
                    location=item.location,
                    title=item.title,
                    webserver=item.webserver,
                    body_preview=item.body_preview,
                    content_type=item.content_type,
                    tech=item.tech,
                    status_code=item.status_code,
                    content_length=item.content_length,
                    vhost=item.vhost
                )
                for item in items
            ]

            with transaction.atomic():
                # 批量插入或更新
                # 如果URL和目标已存在，忽略冲突
                WebSite.objects.bulk_create(
                    website_objects,
                    ignore_conflicts=True
                )

            logger.debug(f"成功处理 {len(items)} 条 WebSite 记录")

        except IntegrityError as e:
            logger.error(
                f"批量插入 WebSite 失败 - 数据完整性错误: {e}, "
                f"记录数: {len(items)}"
            )
            raise

        except OperationalError as e:
            logger.error(
                f"批量插入 WebSite 失败 - 数据库操作错误: {e}, "
                f"记录数: {len(items)}"
            )
            raise

        except DatabaseError as e:
            logger.error(
                f"批量插入 WebSite 失败 - 数据库错误: {e}, "
                f"记录数: {len(items)}"
            )
            raise

        except Exception as e:
            logger.error(
                f"批量插入 WebSite 失败 - 未知错误: {e}, "
                f"记录数: {len(items)}, "
                f"错误类型: {type(e).__name__}",
                exc_info=True
            )
            raise

    def get_urls_for_export(self, target_id: int, batch_size: int = 1000) -> Generator[str, None, None]:
        """
        流式导出目标下的所有站点 URL
        
        Args:
            target_id: 目标 ID  
            batch_size: 批次大小
            
        Yields:
            str: 站点 URL
        """
        try:
            # 查询目标下的站点，只选择 URL 字段，避免不必要的数据传输
            queryset = WebSite.objects.filter(
                target_id=target_id
            ).values_list('url', flat=True).iterator(chunk_size=batch_size)
            
            for url in queryset:
                yield url
        except Exception as e:
            logger.error(f"流式导出站点 URL 失败 - Target ID: {target_id}, 错误: {e}")
            raise

    def get_by_target(self, target_id: int):
        return WebSite.objects.filter(target_id=target_id).order_by('-discovered_at')

    def count_by_target(self, target_id: int) -> int:
        """
        统计目标下的站点总数
        
        Args:
            target_id: 目标 ID
            
        Returns:
            int: 站点总数
        """
        try:
            count = WebSite.objects.filter(target_id=target_id).count()
            logger.debug(f"Target {target_id} 的站点总数: {count}")
            return count
            
        except Exception as e:
            logger.error(f"统计站点数量失败 - Target ID: {target_id}, 错误: {e}")
            raise

    def count_by_scan(self, scan_id: int) -> int:
        """
        统计扫描下的站点总数
        """
        try:
            count = WebSite.objects.filter(scan_id=scan_id).count()
            logger.debug(f"Scan {scan_id} 的站点总数: {count}")
            return count
        except Exception as e:
            logger.error(f"统计站点数量失败 - Scan ID: {scan_id}, 错误: {e}")
            raise

    def get_by_url(self, url: str, target_id: int) -> Optional[int]:
        """
        根据 URL 和 target_id 查找站点 ID
        
        Args:
            url: 站点 URL
            target_id: 目标 ID
            
        Returns:
            Optional[int]: 站点 ID，如果不存在返回 None
            
        Raises:
            ValueError: 发现多个站点时
        """
        try:
            website = WebSite.objects.filter(url=url, target_id=target_id).first()
            if website:
                return website.id
            return None
            
        except Exception as e:
            logger.error(f"查询站点失败 - URL: {url}, Target ID: {target_id}, 错误: {e}")
            raise
    
    def get_all(self):
        """
        获取所有网站
        
        Returns:
            QuerySet: 网站查询集
        """
        return WebSite.objects.all()
    
    def soft_delete_by_ids(self, website_ids: List[int]) -> int:
        """
        根据 ID 列表批量软删除WebSite
        
        Args:
            website_ids: WebSite ID 列表
        
        Returns:
            软删除的记录数
        """
        try:
            updated_count = (
                WebSite.objects
                .filter(id__in=website_ids)
                .update(deleted_at=timezone.now())
            )
            logger.debug(
                "批量软删除WebSite成功 - Count: %s, 更新记录: %s",
                len(website_ids),
                updated_count
            )
            return updated_count
        except Exception as e:
            logger.error(
                "批量软删除WebSite失败 - IDs: %s, 错误: %s",
                website_ids,
                e
            )
            raise
    
    def hard_delete_by_ids(self, website_ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        根据 ID 列表硬删除WebSite（使用数据库级 CASCADE）
        
        Args:
            website_ids: WebSite ID 列表
        
        Returns:
            (删除的记录数, 删除详情字典)
        """
        try:
            batch_size = 1000
            total_deleted = 0
            
            logger.debug(f"开始批量删除 {len(website_ids)} 个WebSite（数据库 CASCADE）...")
            
            for i in range(0, len(website_ids), batch_size):
                batch_ids = website_ids[i:i + batch_size]
                count, _ = WebSite.all_objects.filter(id__in=batch_ids).delete()
                total_deleted += count
                logger.debug(f"批次删除完成: {len(batch_ids)} 个WebSite，删除 {count} 条记录")
            
            deleted_details = {
                'websites': len(website_ids),
                'total': total_deleted,
                'note': 'Database CASCADE - detailed stats unavailable'
            }
            
            logger.debug(
                "批量硬删除成功（CASCADE）- WebSite数: %s, 总删除记录: %s",
                len(website_ids),
                total_deleted
            )
            
            return total_deleted, deleted_details
        
        except Exception as e:
            logger.error(
                "批量硬删除失败（CASCADE）- WebSite数: %s, 错误: %s",
                len(website_ids),
                str(e),
                exc_info=True
            )
            raise
