"""
ScanEngine 数据访问层 Django ORM 实现

基于 Django ORM 的 ScanEngine Repository 实现类
"""

import logging

from ..models import ScanEngine
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoEngineRepository:
    """基于 Django ORM 的 ScanEngine 数据访问层实现"""
    
    def get_all(self):
        """获取所有扫描引擎查询集"""
        return ScanEngine.objects.all().order_by('-created_at')  # type: ignore
    
    def get_by_id(self, engine_id: int) -> ScanEngine | None:
        """
        根据 ID 获取扫描引擎
        
        Args:
            engine_id: 引擎 ID
        
        Returns:
            ScanEngine 对象或 None
        """
        try:
            return ScanEngine.objects.get(id=engine_id)  # type: ignore
        except ScanEngine.DoesNotExist:  # type: ignore
            logger.warning("ScanEngine 不存在 - Engine ID: %s", engine_id)
            return None


__all__ = ['DjangoEngineRepository']
