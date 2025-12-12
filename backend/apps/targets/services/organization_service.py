"""
Organization 业务逻辑服务层（Service）

负责组织相关的业务逻辑处理
"""

import logging
from typing import List, Tuple, Dict

from ..models import Organization
from ..repositories.django_organization_repository import DjangoOrganizationRepository

logger = logging.getLogger(__name__)


class OrganizationService:
    """Organization 业务逻辑服务"""
    
    def __init__(self):
        """初始化服务，注入 Repository 依赖"""
        self.repo = DjangoOrganizationRepository()
    
    # ==================== 查询操作 ====================
    
    def get_organization(self, organization_id: int) -> Organization | None:
        """
        获取组织
        
        Args:
            organization_id: 组织 ID
        
        Returns:
            Organization 对象或 None
        """
        return self.repo.get_by_id(organization_id)
    
    
    def get_all(self):
        """
        获取所有组织
        
        Returns:
            QuerySet: 组织查询集
        """
        return self.repo.get_all()
    
    def get_all_with_stats(self):
        """
        获取所有组织（带统计信息）
        
        Returns:
            QuerySet: 带统计信息的组织查询集
        """
        return self.repo.get_all_with_stats()
    
    # ==================== 创建操作 ====================
    
    def bulk_add_targets(self, organization_id: int, targets: List) -> None:
        """
        批量添加目标到组织
        
        Args:
            organization_id: 组织 ID
            targets: Target 对象列表
        """
        logger.debug("批量关联目标到组织 - Org ID: %s, Targets: %s", organization_id, len(targets))
        self.repo.bulk_add_targets(organization_id, targets)

    # ==================== 删除操作 ====================
    
    def delete_organizations_two_phase(self, organization_ids: List[int]) -> Dict:
        """
        两阶段删除组织（业务方法）
        
        Args:
            organization_ids: 组织 ID 列表
        
        Returns:
            {
                'soft_deleted_count': int,
                'hard_delete_scheduled': bool
            }
        
        Raises:
            ValueError: 未找到要删除的组织
        
        Note:
            - 阶段 1：软删除（立即），用户立即看不到数据
            - 阶段 2：硬删除（后台），真正删除数据和中间表
        """
        
        # 0. 先获取组织名称（用于返回给前端）
        org_names = [name for _, name in self.repo.get_names_by_ids(organization_ids)]
        
        # 1. 软删除（如果 ID 不存在，update 返回 0）
        soft_count = self.soft_delete_organizations(organization_ids)
        
        # 2. 检查是否有记录被删除
        if soft_count == 0:
            raise ValueError("未找到要删除的组织")
        
        logger.info(f"✓ 软删除完成: {soft_count} 个组织")
        
        # 3. 使用 task_distributor 分发硬删除任务到 Worker
        try:
            from apps.engine.services.task_distributor import get_task_distributor
            
            distributor = get_task_distributor()
            success, message, container_id = distributor.execute_delete_task(
                task_type='organizations',
                ids=organization_ids
            )
            
            if success:
                logger.info(f"✓ 硬删除任务已分发 - Container: {container_id}")
            else:
                logger.warning(f"硬删除任务分发失败: {message}")
            
        except Exception as e:
            logger.error(f"❌ 分发删除任务失败: {e}", exc_info=True)
            logger.warning("硬删除可能未成功提交，请检查 Worker 状态")
        
        return {
            'soft_deleted_count': soft_count,
            'organization_names': org_names,
            'hard_delete_scheduled': True
        }
    
    def soft_delete_organizations(self, organization_ids: List[int]) -> int:
        """
        软删除组织
        
        Args:
            organization_ids: 组织 ID 列表
        
        Returns:
            软删除的记录数
        
        Note:
            - 返回值是实际更新的记录数，不是传入的 ID 数量
            - 如果某些 ID 不存在，返回值会小于传入的 ID 数量
        """
        logger.info("软删除 %d 个组织", len(organization_ids))
        
        try:
            deleted_count = self.repo.soft_delete_by_ids(organization_ids)
            logger.info("✓ 软删除成功 - 数量: %d", deleted_count)
            return deleted_count
        except Exception as e:
            logger.error("软删除失败: %s", e)
            raise
    
    def hard_delete_organizations(self, organization_ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        硬删除组织（真正删除数据，使用 Django CASCADE）
        
        Args:
            organization_ids: 组织 ID 列表
        
        Returns:
            (删除的记录数, 删除详情字典)
        
        Note:
            - 从数据库中永久删除
            - Django CASCADE 自动删除 organization_targets 中间表记录
            - 不会删除关联的 Target（多对多）
        """
        logger.info("硬删除 %d 个组织", len(organization_ids))
        
        try:
            deleted_count, deleted_details = self.repo.hard_delete_by_ids(organization_ids)
            logger.info("✓ 硬删除成功 - 数量: %d, 删除记录数: %d", len(organization_ids), deleted_count)
            return deleted_count, deleted_details
        except Exception as e:
            logger.error("❌ 硬删除失败 - IDs: %s, 错误: %s", organization_ids, e)
            raise
