"""
Target Django ORM 仓储实现

使用 Django ORM 实现目标数据访问
"""

import logging
from typing import List, Tuple, Dict
from django.db import transaction, IntegrityError, OperationalError, DatabaseError
from django.utils import timezone

from ..models import Target
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoTargetRepository:
    """Target Django ORM 仓储实现"""
    
    def count_by_ids(self, target_ids: List[int]) -> int:
        """
        统计给定 ID 列表中存在的目标数量
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            存在的目标数量
        """
        if not target_ids:
            return 0
        return Target.objects.filter(id__in=target_ids).count()
    
    def get_by_ids(self, target_ids: List[int]) -> List[Target]:
        """
        根据 ID 列表批量获取目标
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            Target 对象列表
        """
        if not target_ids:
            return []
        return list(Target.objects.filter(id__in=target_ids))
    
    def bulk_create_ignore_conflicts(self, targets: List[Target]) -> None:
        """
        批量创建目标，忽略冲突
        
        Args:
            targets: Target 对象列表
        """
        if not targets:
            return
            
        try:
            Target.objects.bulk_create(targets, ignore_conflicts=True)
        except Exception as e:
            logger.error(f"批量创建目标失败: {e}")
            raise

    def get_by_names(self, names: List[str]) -> List[Target]:
        """
        根据名称列表批量获取目标
        
        Args:
            names: 目标名称列表
            
        Returns:
            Target 对象列表
        """
        if not names:
            return []
        return list(Target.objects.filter(name__in=names))

    def get_by_id(self, target_id: int) -> Target | None:
        """
        根据 ID 获取目标
        
        Args:
            target_id: 目标 ID
        
        Returns:
            Target 对象或 None
        """
        try:
            return Target.objects.get(id=target_id)
        except Target.DoesNotExist:
            logger.warning("目标不存在 - Target ID: %s", target_id)
            return None
    
    def get_names_by_ids(self, target_ids: List[int]) -> List[Tuple[int, str]]:
        """
        根据 ID 列表获取目标的 ID 和名称
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            [(id, name), ...] 元组列表
        """
        return list(
            Target.objects
            .filter(id__in=target_ids)
            .values_list('id', 'name')
        )
    
    def soft_delete_by_ids(self, target_ids: List[int]) -> int:
        """
        根据 ID 列表批量软删除目标
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            软删除的记录数
        
        Note:
            - 使用软删除：只标记为已删除，不真正删除数据库记录
            - 保留所有关联数据，可恢复
        """
        try:
            updated_count = (
                Target.objects
                .filter(id__in=target_ids)
                .update(deleted_at=timezone.now())
            )
            logger.debug(
                "批量软删除目标成功 - Count: %s, 更新记录: %s",
                len(target_ids),
                updated_count
            )
            return updated_count
        except Exception as e:
            logger.error(
                "批量软删除目标失败 - IDs: %s, 错误: %s",
                target_ids,
                e
            )
            raise
    
    def get_all(self):
        """
        获取所有目标
        
        Returns:
            QuerySet: 目标查询集
        """
        return Target.objects.prefetch_related('organizations').all()
    
    def get_or_create(self, name: str, target_type: str):
        """
        获取或创建目标
        
        Args:
            name: 目标名称
            target_type: 目标类型
        
        Returns:
            (Target对象, 是否新创建的布尔值)
        """
        return Target.objects.get_or_create(
            name=name,
            defaults={'type': target_type}
        )
    
    def hard_delete_by_ids(self, target_ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        根据 ID 列表硬删除目标（使用数据库级 CASCADE）
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            (删除的记录数, 删除详情字典)
        
        Strategy:
            使用数据库级 CASCADE 删除，性能最优
        
        Note:
            - 硬删除：从数据库中永久删除
            - 数据库自动处理所有外键级联删除
            - 不触发 Django 信号（pre_delete/post_delete）
        """
        try:
            batch_size = 1000  # 每批处理1000个目标
            total_deleted = 0
            
            logger.debug(f"开始批量删除 {len(target_ids)} 个目标（数据库 CASCADE）...")
            
            # 分批处理目标ID，避免单次删除过多
            for i in range(0, len(target_ids), batch_size):
                batch_ids = target_ids[i:i + batch_size]
                
                # 直接删除目标，数据库自动级联删除所有关联数据
                count, _ = Target.all_objects.filter(id__in=batch_ids).delete()
                total_deleted += count
                
                logger.debug(f"批次删除完成: {len(batch_ids)} 个目标，删除 {count} 条记录")
            
            # 由于使用数据库 CASCADE，无法获取详细统计
            deleted_details = {
                'targets': len(target_ids),
                'total': total_deleted,
                'note': 'Database CASCADE - detailed stats unavailable'
            }
            
            logger.debug(
                "批量硬删除成功（CASCADE）- 目标数: %s, 总删除记录: %s",
                len(target_ids),
                total_deleted
            )
            
            return total_deleted, deleted_details
        
        except Exception as e:
            logger.error(
                "批量硬删除失败（CASCADE）- 目标数: %s, 错误: %s",
                len(target_ids),
                str(e),
                exc_info=True
            )
            raise
    
    def update_last_scanned_at(self, target_id: int, scanned_at) -> bool:
        """
        更新目标的最后扫描时间
        
        Args:
            target_id: 目标 ID
            scanned_at: 扫描时间
        
        Returns:
            是否更新成功
        """
        try:
            updated = Target.objects.filter(id=target_id).update(last_scanned_at=scanned_at)
            return updated > 0
        except Exception as e:
            logger.error("更新最后扫描时间失败 - Target ID: %s, 错误: %s", target_id, e)
            return False
