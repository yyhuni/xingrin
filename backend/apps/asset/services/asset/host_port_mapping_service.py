"""HostPortMapping Service - 业务逻辑层"""

import logging
from typing import List, Iterator

from apps.asset.repositories.asset import DjangoHostPortMappingRepository
from apps.asset.dtos.asset import HostPortMappingDTO

logger = logging.getLogger(__name__)


class HostPortMappingService:
    """主机端口映射服务 - 负责主机端口映射数据的业务逻辑"""
    
    def __init__(self):
        self.repo = DjangoHostPortMappingRepository()
    
    def bulk_create_ignore_conflicts(self, items: List[HostPortMappingDTO]) -> int:
        """
        批量创建主机端口映射（忽略冲突）
        
        Args:
            items: 主机端口映射 DTO 列表
        
        Returns:
            int: 实际创建的记录数
        
        Note:
            使用数据库唯一约束 + ignore_conflicts 自动去重
        """
        try:
            logger.debug("Service: 准备批量创建主机端口映射 - 数量: %d", len(items))
            
            created_count = self.repo.bulk_create_ignore_conflicts(items)
            
            logger.info("Service: 主机端口映射创建成功 - 数量: %d", created_count)
            
            return created_count
            
        except Exception as e:
            logger.error(
                "Service: 批量创建主机端口映射失败 - 数量: %d, 错误: %s",
                len(items),
                str(e),
                exc_info=True
            )
            raise

    def iter_host_port_by_target(self, target_id: int, batch_size: int = 1000):
        return self.repo.get_for_export(target_id=target_id, batch_size=batch_size)

    def get_ip_aggregation_by_target(self, target_id: int, search: str = None):
        return self.repo.get_ip_aggregation_by_target(target_id, search=search)

    def get_all_ip_aggregation(self, search: str = None):
        """获取所有 IP 聚合数据（全局查询）"""
        return self.repo.get_all_ip_aggregation(search=search)

    def iter_ips_by_target(self, target_id: int, batch_size: int = 1000) -> Iterator[str]:
        """流式获取目标下的所有唯一 IP 地址。"""
        return self.repo.get_ips_for_export(target_id=target_id, batch_size=batch_size)
