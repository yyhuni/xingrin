"""
扫描统计服务

职责：
- 获取扫描统计数据
- 数据聚合查询
"""

import logging
from django.db.utils import DatabaseError, OperationalError

from apps.scan.repositories import DjangoScanRepository

logger = logging.getLogger(__name__)


class ScanStatsService:
    """
    扫描统计服务
    
    职责：
    - 统计数据查询
    - 数据聚合
    """
    
    def __init__(self):
        """
        初始化服务
        """
        self.scan_repo = DjangoScanRepository()
    
    def get_statistics(self) -> dict:
        """
        获取扫描任务统计数据
        
        Returns:
            统计数据字典
        
        Raises:
            DatabaseError: 数据库错误
        
        Note:
            使用 Repository 层的聚合查询，性能优异
        """
        try:
            statistics = self.scan_repo.get_statistics()
            logger.debug("获取扫描统计数据成功 - 总数: %d", statistics['total'])
            return statistics
        except (DatabaseError, OperationalError) as e:
            logger.exception("数据库错误：获取扫描统计数据失败")
            raise


# 导出接口
__all__ = ['ScanStatsService']
