"""
Target 业务逻辑服务层（Service）

负责目标相关的业务逻辑处理
"""

import logging
from typing import List, Tuple, Dict, Any, Optional

from django.db import transaction

from ..models import Target
from ..repositories.django_target_repository import DjangoTargetRepository

logger = logging.getLogger(__name__)


class TargetService:
    """Target 业务逻辑服务"""
    
    def __init__(self):
        """初始化服务，注入 Repository 依赖"""
        self.repo = DjangoTargetRepository()
    
    # ==================== 查询方法 ====================
    
    def count_existing_ids(self, target_ids: List[int]) -> int:
        """
        统计给定 ID 列表中实际存在的目标数量
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            存在的目标数量
        """
        return self.repo.count_by_ids(target_ids)
    
    # ==================== 查询操作 ====================
    
    def get_target(self, target_id: int) -> Target | None:
        """
        获取目标
        
        Args:
            target_id: 目标 ID
        
        Returns:
            Target 对象或 None
        """
        return self.repo.get_by_id(target_id)
    
    def get_by_id(self, target_id: int) -> Target | None:
        """
        根据 ID 获取目标（get_target 别名）
        
        Args:
            target_id: 目标 ID
        
        Returns:
            Target 对象或 None
        """
        return self.repo.get_by_id(target_id)
    
    
    def get_all(self):
        """
        获取所有目标
        
        Returns:
            QuerySet: 目标查询集
        """
        return self.repo.get_all()
    
    def get_targets_by_names(self, names: List[str]) -> List[Target]:
        """
        根据名称批量获取目标
        
        Args:
            names: 目标名称列表
            
        Returns:
            Target 对象列表
        """
        return self.repo.get_by_names(names)

    def update_last_scanned_at(self, target_id: int) -> bool:
        """
        更新目标的最后扫描时间
        
        Args:
            target_id: 目标 ID
        
        Returns:
            是否更新成功
        """
        from django.utils import timezone
        return self.repo.update_last_scanned_at(target_id, timezone.now())
    
    # ==================== 创建操作 ====================
    
    def create_or_get_target(
        self, 
        name: str, 
        target_type: str
    ) -> Tuple[Target, bool]:
        """
        创建或获取目标
        
        Args:
            name: 目标名称
            target_type: 目标类型
        
        Returns:
            (Target对象, 是否新创建)
        """
        logger.debug("创建或获取目标 - Name: %s, Type: %s", name, target_type)
        target, created = self.repo.get_or_create(name, target_type)
        
        if created:
            logger.info("创建新目标 - ID: %s, Name: %s", target.id, name)
        else:
            logger.debug("目标已存在 - ID: %s, Name: %s", target.id, name)
        
        return target, created
    
    def batch_create_targets(
        self,
        targets_data: List[Dict[str, Any]],
        organization_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        批量创建目标（高性能优化版）
        
        Args:
            targets_data: 目标数据列表，每个元素包含 name 字段
            organization_id: 可选，关联到指定组织的 ID
        
        Returns:
            {
                'created_count': int,  # 成功处理的总数（包括复用）
                'failed_count': int,
                'failed_targets': List[Dict],
                'message': str
            }
        
        Performance:
            使用 bulk_create 替代逐个创建，大幅减少数据库交互次数。
            1000个目标：~100ms (优化前 ~2s)
        """
        from apps.asset.services.asset.subdomain_service import SubdomainService
        from apps.asset.dtos import SubdomainDTO
        from apps.targets.models import Target
        from apps.common.normalizer import normalize_target
        from apps.common.validators import detect_target_type
        from .organization_service import OrganizationService
        
        # 1. 预处理数据：规范化 + 类型检测
        # 使用字典去重，key为规范化后的名称
        valid_targets_map = {}  # {name: type}
        failed_targets = []
        
        for data in targets_data:
            name = data.get('name')
            if not name:
                continue
                
            try:
                norm_name = normalize_target(name)
                t_type = detect_target_type(norm_name)
                valid_targets_map[norm_name] = t_type
            except ValueError as e:
                failed_targets.append({'name': name, 'reason': str(e)})

        if not valid_targets_map:
            return {
                'created_count': 0,
                'failed_count': len(failed_targets),
                'failed_targets': failed_targets,
                'message': "没有有效的目标"
            }

        # 验证组织是否存在
        if organization_id:
            org_service = OrganizationService()
            organization = org_service.get_organization(organization_id)
            if not organization:
                raise ValueError(f'组织 ID {organization_id} 不存在')

        with transaction.atomic():
            # 2. 批量创建 Target (使用 Repository)
            target_objs = [
                Target(name=name, type=t_type) 
                for name, t_type in valid_targets_map.items()
            ]
            self.repo.bulk_create_ignore_conflicts(target_objs)
            
            # 3. 重新查询获取所有涉及的 Target 对象（含 ID）(使用 Repository)
            all_targets = self.repo.get_by_names(list(valid_targets_map.keys()))
            
            # 4. 处理关联组织 (使用 OrganizationService)
            if organization_id:
                org_service = OrganizationService()
                org_service.bulk_add_targets(organization_id, all_targets)

            # 5. 处理 Subdomain 创建 (使用 SubdomainService)
            domain_targets = [t for t in all_targets if t.type == Target.TargetType.DOMAIN]
            if domain_targets:
                subdomain_dtos = [
                    SubdomainDTO(name=t.name, target_id=t.id)
                    for t in domain_targets
                ]
                subdomain_service = SubdomainService()
                subdomain_service.bulk_create_ignore_conflicts(subdomain_dtos)
        
        success_count = len(all_targets)
        
        logger.info(
            "批量创建目标完成 (Bulk) - 成功处理: %d, 失败: %d",
            success_count, len(failed_targets)
        )
        
        return {
            'created_count': success_count,
            'failed_count': len(failed_targets),
            'failed_targets': failed_targets,
            'message': f"成功处理 {success_count} 个目标"
        }
    
    # ==================== 删除操作 ====================
    
    def delete_targets_two_phase(self, target_ids: List[int]) -> Dict:
        """
        两阶段删除目标（业务方法）
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            {
                'soft_deleted_count': int,
                'hard_delete_scheduled': bool
            }
        
        Raises:
            ValueError: 未找到要删除的目标
        
        Note:
            - 阶段 1：软删除（立即），用户立即看不到数据
            - 阶段 2：硬删除（后台），真正删除数据和关联
        """
        
        # 0. 先获取目标名称（用于返回给前端）
        target_names = [name for _, name in self.repo.get_names_by_ids(target_ids)]
        
        # 1. 软删除（如果 ID 不存在，update 返回 0）
        soft_count = self.soft_delete_targets(target_ids)
        
        # 2. 检查是否有记录被删除
        if soft_count == 0:
            raise ValueError("未找到要删除的目标")
        
        logger.info(f"✓ 软删除完成: {soft_count} 个目标")
        
        # 3. 使用 task_distributor 分发硬删除任务到 Worker
        try:
            from apps.engine.services.task_distributor import get_task_distributor
            
            distributor = get_task_distributor()
            success, message, container_id = distributor.execute_delete_task(
                task_type='targets',
                ids=target_ids
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
            'target_names': target_names,
            'hard_delete_scheduled': True
        }
    
    def soft_delete_targets(self, target_ids: List[int]) -> int:
        """
        软删除目标
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            软删除的记录数
        
        Note:
            - 返回值是实际更新的记录数，不是传入的 ID 数量
            - 如果某些 ID 不存在，返回值会小于传入的 ID 数量
        """
        logger.info("软删除 %d 个目标", len(target_ids))
        
        try:
            deleted_count = self.repo.soft_delete_by_ids(target_ids)
            logger.info("✓ 软删除成功 - 数量: %d", deleted_count)
            return deleted_count
        except Exception as e:
            logger.error("软删除失败: %s", e)
            raise
    
    def hard_delete_targets(self, target_ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        硬删除目标（真正删除数据）- 使用数据库级 CASCADE
        
        Args:
            target_ids: 目标 ID 列表
        
        Returns:
            (删除的记录数, 删除详情字典)
        
        Strategy:
            使用数据库级 CASCADE 删除，性能最优
        
        Note:
            - 硬删除：从数据库中永久删除
            - 数据库自动级联删除所有关联数据
            - 不触发 Django 信号（pre_delete/post_delete）
        """
        logger.debug("准备硬删除目标（CASCADE）- Count: %s, IDs: %s", len(target_ids), target_ids)
        
        deleted_count, details = self.repo.hard_delete_by_ids(target_ids)
        
        logger.info(
            "硬删除目标成功（CASCADE）- Count: %s, 删除记录数: %s",
            len(target_ids),
            deleted_count
        )
        
        return deleted_count, details
