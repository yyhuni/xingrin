import logging
from typing import Tuple, Iterator

from apps.asset.models.asset_models import Directory
from apps.asset.repositories import DjangoDirectoryRepository

logger = logging.getLogger(__name__)


class DirectoryService:
    """目录业务逻辑层"""
    
    def __init__(self, repository=None):
        """
        初始化目录服务
        
        Args:
            repository: 目录仓储实例（用于依赖注入）
        """
        self.repo = repository or DjangoDirectoryRepository()
    
    # ==================== 创建操作 ====================
    
    def bulk_create_ignore_conflicts(self, directory_dtos: list) -> None:
        """
        批量创建目录记录，忽略冲突（用于扫描任务）
        
        Args:
            directory_dtos: DirectoryDTO 列表
        """
        return self.repo.bulk_create_ignore_conflicts(directory_dtos)
    
    # ==================== 查询操作 ====================

    def get_all(self):
        """
        获取所有目录
        
        Returns:
            QuerySet: 目录查询集
        """
        logger.debug("获取所有目录")
        return self.repo.get_all()
    
    def get_directories_by_target(self, target_id: int):
        logger.debug("获取目标下所有目录 - Target ID: %d", target_id)
        return self.repo.get_by_target(target_id)

    def iter_directory_urls_by_target(self, target_id: int, chunk_size: int = 1000) -> Iterator[str]:
        """流式获取目标下的所有目录 URL，用于导出大批量数据。"""
        logger.debug("流式导出目标下目录 URL - Target ID: %d", target_id)
        return self.repo.get_urls_for_export(target_id=target_id, batch_size=chunk_size)


__all__ = ['DirectoryService']
