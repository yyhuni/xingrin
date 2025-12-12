"""
Django ORM 实现的 Directory Repository
"""

import logging
from typing import List, Tuple, Dict, Iterator
from django.db import transaction, IntegrityError, OperationalError, DatabaseError
from django.utils import timezone

from apps.asset.models.asset_models import Directory
from apps.asset.dtos import DirectoryDTO
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)



@auto_ensure_db_connection
class DjangoDirectoryRepository:
    """Django ORM 实现的 Directory Repository"""

    def bulk_create_ignore_conflicts(self, items: List[DirectoryDTO]) -> int:
        """
        批量创建 Directory，忽略冲突
        
        Args:
            items: Directory DTO 列表
            
        Returns:
            int: 实际创建的记录数
            
        Raises:
            IntegrityError: 数据完整性错误
            OperationalError: 数据库操作错误
            DatabaseError: 数据库错误
        """
        if not items:
            return 0

        try:
            # 转换为 Django 模型对象
            directory_objects = [
                Directory(
                    website_id=item.website_id,
                    target_id=item.target_id,
                    url=item.url,
                    status=item.status,
                    content_length=item.content_length,
                    words=item.words,
                    lines=item.lines,
                    content_type=item.content_type,
                    duration=item.duration
                )
                for item in items
            ]

            with transaction.atomic():
                # 批量插入或忽略冲突
                # 如果 website + url 已存在，忽略冲突
                Directory.objects.bulk_create(
                    directory_objects,
                    ignore_conflicts=True
                )

            logger.debug(f"成功处理 {len(items)} 条 Directory 记录")
            return len(items)

        except IntegrityError as e:
            logger.error(
                f"批量插入 Directory 失败 - 数据完整性错误: {e}, "
                f"记录数: {len(items)}"
            )
            raise

        except OperationalError as e:
            logger.error(
                f"批量插入 Directory 失败 - 数据库操作错误: {e}, "
                f"记录数: {len(items)}"
            )
            raise

        except DatabaseError as e:
            logger.error(
                f"批量插入 Directory 失败 - 数据库错误: {e}, "
                f"记录数: {len(items)}"
            )
            raise

        except Exception as e:
            logger.error(
                f"批量插入 Directory 失败 - 未知错误: {e}, "
                f"记录数: {len(items)}, "
                f"错误类型: {type(e).__name__}",
                exc_info=True
            )
            raise

    def get_by_website(self, website_id: int) -> List[DirectoryDTO]:
        """
        获取指定站点的所有目录
        
        Args:
            website_id: 站点 ID
            
        Returns:
            List[DirectoryDTO]: 目录列表
        """
        try:
            directories = Directory.objects.filter(website_id=website_id)
            return [
                DirectoryDTO(
                    website_id=d.website_id,
                    target_id=d.target_id,
                    url=d.url,
                    status=d.status,
                    content_length=d.content_length,
                    words=d.words,
                    lines=d.lines,
                    content_type=d.content_type,
                    duration=d.duration
                )
                for d in directories
            ]

        except Exception as e:
            logger.error(f"获取目录列表失败 - Website ID: {website_id}, 错误: {e}")
            raise

    def count_by_website(self, website_id: int) -> int:
        """
        统计指定站点的目录总数
        
        Args:
            website_id: 站点 ID
            
        Returns:
            int: 目录总数
        """
        try:
            count = Directory.objects.filter(website_id=website_id).count()
            logger.debug(f"Website {website_id} 的目录总数: {count}")
            return count

        except Exception as e:
            logger.error(f"统计目录数量失败 - Website ID: {website_id}, 错误: {e}")
            raise
    
    def get_all(self):
        """
        获取所有目录
        
        Returns:
            QuerySet: 目录查询集
        """
        return Directory.objects.all()
    
    def get_by_target(self, target_id: int):
        return Directory.objects.filter(target_id=target_id).select_related('website').order_by('-discovered_at')

    def get_urls_for_export(self, target_id: int, batch_size: int = 1000) -> Iterator[str]:
        """流式导出目标下的所有目录 URL（只查 url 字段，避免加载多余数据）。"""
        try:
            queryset = (
                Directory.objects
                .filter(target_id=target_id)
                .values_list('url', flat=True)
                .order_by('url')
                .iterator(chunk_size=batch_size)
            )
            for url in queryset:
                yield url
        except Exception as e:
            logger.error("流式导出目录 URL 失败 - Target ID: %s, 错误: %s", target_id, e)
            raise
    
    def soft_delete_by_ids(self, directory_ids: List[int]) -> int:
        """
        根据 ID 列表批量软删除Directory
        
        Args:
            directory_ids: Directory ID 列表
        
        Returns:
            软删除的记录数
        """
        try:
            updated_count = (
                Directory.objects
                .filter(id__in=directory_ids)
                .update(deleted_at=timezone.now())
            )
            logger.debug(
                "批量软删除Directory成功 - Count: %s, 更新记录: %s",
                len(directory_ids),
                updated_count
            )
            return updated_count
        except Exception as e:
            logger.error(
                "批量软删除Directory失败 - IDs: %s, 错误: %s",
                directory_ids,
                e
            )
            raise
    
    def hard_delete_by_ids(self, directory_ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        根据 ID 列表硬删除Directory（使用数据库级 CASCADE）
        
        Args:
            directory_ids: Directory ID 列表
        
        Returns:
            (删除的记录数, 删除详情字典)
        """
        try:
            batch_size = 1000
            total_deleted = 0
            
            logger.debug(f"开始批量删除 {len(directory_ids)} 个Directory（数据库 CASCADE）...")
            
            for i in range(0, len(directory_ids), batch_size):
                batch_ids = directory_ids[i:i + batch_size]
                count, _ = Directory.all_objects.filter(id__in=batch_ids).delete()
                total_deleted += count
                logger.debug(f"批次删除完成: {len(batch_ids)} 个Directory，删除 {count} 条记录")
            
            deleted_details = {
                'directories': len(directory_ids),
                'total': total_deleted,
                'note': 'Database CASCADE - detailed stats unavailable'
            }
            
            logger.debug(
                "批量硬删除成功（CASCADE）- Directory数: %s, 总删除记录: %s",
                len(directory_ids),
                total_deleted
            )
            
            return total_deleted, deleted_details
        
        except Exception as e:
            logger.error(
                "批量硬删除失败（CASCADE）- Directory数: %s, 错误: %s",
                len(directory_ids),
                str(e),
                exc_info=True
            )
            raise
