import logging
from typing import Tuple, List

from apps.asset.repositories import DjangoWebSiteRepository
from apps.asset.dtos import WebSiteDTO

logger = logging.getLogger(__name__)


class WebSiteService:
    """网站业务逻辑层"""
    
    def __init__(self, repository=None):
        """
        初始化网站服务
        
        Args:
            repository: 网站仓储实例（用于依赖注入）
        """
        self.repo = repository or DjangoWebSiteRepository()
    
    # ==================== 创建操作 ====================
    
    def bulk_create_ignore_conflicts(self, website_dtos: List[WebSiteDTO]) -> None:
        """
        批量创建网站记录，忽略冲突（用于扫描任务）
        
        Args:
            website_dtos: WebSiteDTO 列表
        
        Note:
            使用 ignore_conflicts 策略，重复记录会被跳过
        """
        logger.debug("批量创建网站 - 数量: %d", len(website_dtos))
        return self.repo.bulk_create_ignore_conflicts(website_dtos)
    
    # ==================== 查询操作 ====================
    
    def get_by_url(self, url: str, target_id: int) -> int:
        """
        根据 URL 和 target_id 查找网站 ID
        
        Args:
            url: 网站 URL
            target_id: 目标 ID
            
        Returns:
            int: 网站 ID，如果不存在返回 None
        """
        return self.repo.get_by_url(url=url, target_id=target_id)
    
    # ==================== 查询操作 ====================

    def get_all(self):
        """
        获取所有网站
        
        Returns:
            QuerySet: 网站查询集
        """
        logger.debug("获取所有网站")
        return self.repo.get_all()
    
    def get_websites_by_target(self, target_id: int):
        return self.repo.get_by_target(target_id)
    
    def count_websites_by_scan(self, scan_id: int) -> int:
        """
        统计扫描下的网站数量
        
        Args:
            scan_id: 扫描 ID
        
        Returns:
            int: 网站数量
        """
        logger.debug("统计扫描下网站数量 - Scan ID: %d", scan_id)
        return self.repo.count_by_scan(scan_id)
    
    def iter_website_urls_by_target(self, target_id: int, chunk_size: int = 1000):
        """流式获取目标下的所有站点 URL（内存优化，委托给 Repository 层）"""
        logger.debug(
            "流式获取目标下所有站点 URL - Target ID: %d, 批次大小: %d",
            target_id,
            chunk_size,
        )
        # 通过仓储层统一访问数据库，避免 Service 直接依赖 ORM
        return self.repo.get_urls_for_export(target_id=target_id, batch_size=chunk_size)


__all__ = ['WebSiteService']
