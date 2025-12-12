"""
Endpoint 服务层

处理 URL/端点相关的业务逻辑
"""

import logging
from typing import List, Optional, Dict, Any, Iterator

from apps.asset.dtos.asset import EndpointDTO
from apps.asset.repositories.asset import DjangoEndpointRepository

logger = logging.getLogger(__name__)


class EndpointService:
    """
    Endpoint 服务类
    
    提供 Endpoint（URL/端点）相关的业务逻辑
    """
    
    def __init__(self):
        """初始化 Endpoint 服务"""
        self.repo = DjangoEndpointRepository()
    
    def bulk_create_endpoints(
        self,
        endpoints: List[EndpointDTO],
        ignore_conflicts: bool = True
    ) -> int:
        """
        批量创建端点记录
        
        Args:
            endpoints: 端点数据列表
            ignore_conflicts: 是否忽略冲突（去重）
            
        Returns:
            int: 创建的记录数
        """
        if not endpoints:
            return 0
        
        try:
            if ignore_conflicts:
                return self.repo.bulk_create_ignore_conflicts(endpoints)
            else:
                # 如果需要非忽略冲突的版本，可以在 repository 中添加
                return self.repo.bulk_create_ignore_conflicts(endpoints)
        except Exception as e:
            logger.error(f"批量创建端点失败: {e}")
            raise
    
    def get_endpoints_by_website(
        self,
        website_id: int,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        获取网站下的端点列表
        
        Args:
            website_id: 网站 ID
            limit: 返回数量限制
            
        Returns:
            List[Dict]: 端点列表
        """
        endpoints_dto = self.repo.get_by_website(website_id)
        
        if limit:
            endpoints_dto = endpoints_dto[:limit]
        
        endpoints = []
        for dto in endpoints_dto:
            endpoints.append({
                'url': dto.url,
                'title': dto.title,
                'status_code': dto.status_code,
                'content_length': dto.content_length,
                'webserver': dto.webserver
            })
        
        return endpoints
    
    def get_endpoints_by_target(
        self,
        target_id: int,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        获取目标下的端点列表
        
        Args:
            target_id: 目标 ID
            limit: 返回数量限制
            
        Returns:
            List[Dict]: 端点列表
        """
        endpoints_dto = self.repo.get_by_target(target_id)
        
        if limit:
            endpoints_dto = endpoints_dto[:limit]
        
        endpoints = []
        for dto in endpoints_dto:
            endpoints.append({
                'url': dto.url,
                'title': dto.title,
                'status_code': dto.status_code,
                'content_length': dto.content_length,
                'webserver': dto.webserver
            })
        
        return endpoints
    
    def count_endpoints_by_target(self, target_id: int) -> int:
        """
        统计目标下的端点数量
        
        Args:
            target_id: 目标 ID
            
        Returns:
            int: 端点数量
        """
        return self.repo.count_by_target(target_id)
    
    def get_queryset_by_target(self, target_id: int):
        return self.repo.get_queryset_by_target(target_id)

    def get_all(self):
        """获取所有端点（全局查询）"""
        return self.repo.get_all()
    
    def iter_endpoint_urls_by_target(self, target_id: int, chunk_size: int = 1000) -> Iterator[str]:
        """流式获取目标下的所有端点 URL，用于导出。"""
        queryset = self.repo.get_queryset_by_target(target_id)
        for url in queryset.values_list('url', flat=True).iterator(chunk_size=chunk_size):
            yield url
    
    def count_endpoints_by_website(self, website_id: int) -> int:
        """
        统计网站下的端点数量
        
        Args:
            website_id: 网站 ID
            
        Returns:
            int: 端点数量
        """
        return self.repo.count_by_website(website_id)
    
    def soft_delete_endpoints(self, endpoint_ids: List[int]) -> int:
        """
        软删除端点
        
        Args:
            endpoint_ids: 端点 ID 列表
            
        Returns:
            int: 更新的数量
        """
        return self.repo.soft_delete_by_ids(endpoint_ids)
    
    def hard_delete_endpoints(self, endpoint_ids: List[int]) -> tuple:
        """
        硬删除端点
        
        Args:
            endpoint_ids: 端点 ID 列表
            
        Returns:
            tuple: (删除总数, 详细信息)
        """
        return self.repo.hard_delete_by_ids(endpoint_ids)
