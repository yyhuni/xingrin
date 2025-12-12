"""
ScanEngine 业务逻辑服务层（Service）

负责扫描引擎相关的业务逻辑处理
"""

import logging

from ..models import ScanEngine
from ..repositories import DjangoEngineRepository

logger = logging.getLogger(__name__)


class EngineService:
    """ScanEngine 业务逻辑服务"""
    
    def __init__(self):
        """初始化服务，注入 Repository 依赖"""
        self.repo = DjangoEngineRepository()
    
    def get_engine(self, engine_id: int) -> ScanEngine | None:
        """
        获取扫描引擎
        
        Args:
            engine_id: 引擎 ID
        
        Returns:
            ScanEngine 对象或 None
        """
        return self.repo.get_by_id(engine_id)
    
    def get_all_engines(self):
        """获取所有扫描引擎查询集"""
        return self.repo.get_all()


__all__ = ['EngineService']
