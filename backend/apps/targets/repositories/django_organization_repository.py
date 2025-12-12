"""
Organization Django ORM 仓储实现

使用 Django ORM 实现组织数据访问
"""

import logging
from typing import List, Tuple, Dict
from django.db.models import Count
from django.utils import timezone

from ..models import Organization, Target
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoOrganizationRepository:
    """Organization Django ORM 仓储实现"""
    
    def bulk_add_targets(self, organization_id: int, targets: List[Target]) -> None:
        """
        批量添加目标到组织
        
        Args:
            organization_id: 组织 ID
            targets: Target 对象列表
        """
        if not targets:
            return
            
        # 使用 through model 批量插入，避免 N 次 add()
        ThroughModel = Organization.targets.through
        relations = [
            ThroughModel(organization_id=organization_id, target_id=t.id)
            for t in targets
        ]
        
        try:
            # 使用 ignore_conflicts 忽略已存在的关联
            ThroughModel.objects.bulk_create(relations, ignore_conflicts=True)
        except Exception as e:
            logger.error(f"批量关联目标失败: {e}")
            raise

    def get_by_id(self, organization_id: int) -> Organization | None:
        """
        根据 ID 获取组织
        
        Args:
            organization_id: 组织 ID
        
        Returns:
            Organization 对象或 None
        """
        try:
            return Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            logger.warning("组织不存在 - Organization ID: %s", organization_id)
            return None
    
    def get_names_by_ids(self, organization_ids: List[int]) -> List[Tuple[int, str]]:
        """
        根据 ID 列表获取组织的 ID 和名称
        
        Args:
            organization_ids: 组织 ID 列表
        
        Returns:
            [(id, name), ...] 元组列表
        """
        return list(
            Organization.objects
            .filter(id__in=organization_ids)
            .values_list('id', 'name')
        )
    
    def soft_delete_by_ids(self, organization_ids: List[int]) -> int:
        """
        根据 ID 列表批量软删除组织
        
        Args:
            organization_ids: 组织 ID 列表
        
        Returns:
            软删除的记录数
        
        Note:
            - 使用软删除：只标记为已删除，不真正删除数据库记录
            - 保留所有关联数据，可恢复
            - 不会影响关联的目标（多对多关系保持不变）
        """
        try:
            updated_count = (
                Organization.objects
                .filter(id__in=organization_ids)
                .update(deleted_at=timezone.now())
            )
            logger.debug(
                "批量软删除组织成功 - Count: %s, 更新记录: %s",
                len(organization_ids),
                updated_count
            )
            return updated_count
        except Exception as e:
            logger.error(
                "批量软删除组织失败 - IDs: %s, 错误: %s",
                organization_ids,
                e
            )
            raise
    
    def get_targets(self, organization_id: int) -> List[Target]:
        """
        获取组织下的所有目标
        
        Args:
            organization_id: 组织 ID
        
        Returns:
            Target 对象列表
        """
        organization = self.get_by_id(organization_id)
        if not organization:
            return []
        return list(organization.targets.all())
    
    def get_all(self):
        """
        获取所有组织
        
        Returns:
            QuerySet: 组织查询集
        """
        return Organization.objects.all()
    
    def get_all_with_stats(self):
        """
        获取所有组织并预计算目标数量
        
        Returns:
            QuerySet: 带统计信息的组织查询集
        """
        return (
            Organization.objects
            .annotate(target_count=Count('targets'))
            .order_by('-created_at')
        )
    
    def get_by_ids(self, organization_ids: List[int]) -> List[Organization]:
        """
        根据 ID 列表获取组织（只返回未删除的）
        
        Args:
            organization_ids: 组织 ID 列表
        
        Returns:
            Organization 对象列表
        """
        return list(Organization.objects.filter(id__in=organization_ids))
    
    def hard_delete_by_ids(self, organization_ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        根据 ID 列表硬删除组织（真正删除数据）
        
        Args:
            organization_ids: 组织 ID 列表
        
        Returns:
            (删除的记录数, 删除详情字典)
        
        Note:
            - 硬删除：从数据库中永久删除
            - 使用 Django CASCADE 自动删除中间表 organization_targets 的关联记录
            - 不会删除关联的 Target（多对多关系）
            - ⚠️ 不可恢复
            - @auto_ensure_db_connection 自动重试数据库连接失败
        """
        try:
            # 使用 all_objects 管理器，可以删除已软删除的记录
            deleted_count, deleted_details = (
                Organization.all_objects
                .filter(id__in=organization_ids)
                .delete()
            )
            
            logger.debug(
                "硬删除组织成功 - Count: %s, 删除记录数: %s, 详情: %s",
                len(organization_ids),
                deleted_count,
                deleted_details
            )
            
            return deleted_count, deleted_details
            
        except Exception as e:
            logger.error(
                "硬删除组织失败 - IDs: %s, 错误: %s",
                organization_ids,
                e
            )
            raise
    
