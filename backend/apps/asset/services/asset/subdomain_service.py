import logging
from typing import Tuple, List, Dict

from apps.asset.repositories import DjangoSubdomainRepository
from apps.asset.dtos import SubdomainDTO

logger = logging.getLogger(__name__)


class SubdomainService:
    """子域名业务逻辑层"""
    
    def __init__(self, repository=None):
        """
        初始化子域名服务
        
        Args:
            repository: 子域名仓储实例（用于依赖注入）
        """
        self.repo = repository or DjangoSubdomainRepository()
    
    # ==================== 查询操作 ====================
    
    def get_all(self):
        """
        获取所有子域名
        
        Returns:
            QuerySet: 子域名查询集
        """
        logger.debug("获取所有子域名")
        return self.repo.get_all()
    
    # ==================== 创建操作 ====================
    
    def get_or_create(self, name: str, target_id: int) -> Tuple[any, bool]:
        """
        获取或创建子域名
        
        Args:
            name: 子域名名称
            target_id: 目标 ID
        
        Returns:
            (Subdomain对象, 是否新创建)
        """
        logger.debug("获取或创建子域名 - Name: %s, Target ID: %d", name, target_id)
        return self.repo.get_or_create(name, target_id)

    def bulk_create_ignore_conflicts(self, items: List[SubdomainDTO]) -> None:
        """
        批量创建子域名，忽略冲突
        
        Args:
            items: 子域名 DTO 列表
        
        Note:
            使用 ignore_conflicts 策略，重复记录会被跳过
        """
        logger.debug("批量创建子域名 - 数量: %d", len(items))
        return self.repo.bulk_create_ignore_conflicts(items)
    
    def get_by_names_and_target_id(self, names: set, target_id: int) -> dict:
        """
        根据域名列表和目标ID批量查询子域名
        
        Args:
            names: 域名集合
            target_id: 目标 ID
        
        Returns:
            dict: {域名: Subdomain对象}
        """
        logger.debug("批量查询子域名 - 数量: %d, Target ID: %d", len(names), target_id)
        return self.repo.get_by_names_and_target_id(names, target_id)
    
    def get_subdomain_names_by_target(self, target_id: int) -> List[str]:
        """
        获取目标下的所有子域名名称
        
        Args:
            target_id: 目标 ID
        
        Returns:
            List[str]: 子域名名称列表
        """
        logger.debug("获取目标下所有子域名 - Target ID: %d", target_id)
        # 通过仓储层统一访问数据库，内部已使用 iterator() 做流式查询
        return list(self.repo.get_domains_for_export(target_id=target_id))
    
    def get_subdomains_by_target(self, target_id: int):
        return self.repo.get_by_target(target_id)
    
    def count_subdomains_by_target(self, target_id: int) -> int:
        """
        统计目标下的子域名数量
        
        Args:
            target_id: 目标 ID
        
        Returns:
            int: 子域名数量
        """
        logger.debug("统计目标下子域名数量 - Target ID: %d", target_id)
        return self.repo.count_by_target(target_id)
    
    def iter_subdomain_names_by_target(self, target_id: int, chunk_size: int = 1000):
        """
        流式获取目标下的所有子域名名称（内存优化）
        
        Args:
            target_id: 目标 ID
            chunk_size: 批次大小
        
        Yields:
            str: 子域名名称
        """
        logger.debug("流式获取目标下所有子域名 - Target ID: %d, 批次大小: %d", target_id, chunk_size)
        # 通过仓储层统一访问数据库，内部已使用 iterator() 做流式查询
        return self.repo.get_domains_for_export(target_id=target_id, batch_size=chunk_size)


__all__ = ['SubdomainService']
