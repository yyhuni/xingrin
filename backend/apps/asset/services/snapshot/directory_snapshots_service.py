"""Directory Snapshots Service - 业务逻辑层"""

import logging
from typing import List, Iterator

from apps.asset.repositories.snapshot import DjangoDirectorySnapshotRepository
from apps.asset.services.asset import DirectoryService
from apps.asset.dtos.snapshot import DirectorySnapshotDTO

logger = logging.getLogger(__name__)


class DirectorySnapshotsService:
    """目录快照服务 - 统一管理快照和资产同步"""
    
    def __init__(self):
        self.snapshot_repo = DjangoDirectorySnapshotRepository()
        self.asset_service = DirectoryService()
    
    def save_and_sync(self, items: List[DirectorySnapshotDTO]) -> None:
        """
        保存目录快照并同步到资产表（统一入口）
        
        流程：
        1. 保存到快照表（完整记录，包含 scan_id）
        2. 同步到资产表（去重，不包含 scan_id）
        
        Args:
            items: 目录快照 DTO 列表（必须包含 website_id）
        
        Raises:
            ValueError: 如果 items 中的 website_id 为 None
            Exception: 数据库操作失败
        """
        if not items:
            return
        
        # 检查 Scan 是否仍存在（防止删除后竞态写入）
        scan_id = items[0].scan_id
        from apps.scan.repositories import DjangoScanRepository
        if not DjangoScanRepository().exists(scan_id):
            logger.warning("Scan 已删除，跳过目录快照保存 - scan_id=%s, 数量=%d", scan_id, len(items))
            return
        
        try:
            logger.debug("保存目录快照并同步到资产表 - 数量: %d", len(items))
            
            # 步骤 1: 保存到快照表
            logger.debug("步骤 1: 保存到快照表")
            self.snapshot_repo.save_snapshots(items)
            
            # 步骤 2: 转换为资产 DTO 并保存到资产表
            # 注意：去重是通过数据库的 UNIQUE 约束 + ignore_conflicts 实现的
            # - 新记录：插入资产表
            # - 已存在的记录：自动跳过
            logger.debug("步骤 2: 同步到资产表（通过 Service 层）")
            asset_items = [item.to_asset_dto() for item in items]
            
            self.asset_service.bulk_create_ignore_conflicts(asset_items)
            
            logger.info("目录快照和资产数据保存成功 - 数量: %d", len(items))
            
        except Exception as e:
            logger.error(
                "保存目录快照失败 - 数量: %d, 错误: %s",
                len(items),
                str(e),
                exc_info=True
            )
            raise
    
    def get_by_scan(self, scan_id: int):
        return self.snapshot_repo.get_by_scan(scan_id)

    def get_all(self):
        """获取所有目录快照"""
        return self.snapshot_repo.get_all()

    def iter_directory_urls_by_scan(self, scan_id: int, chunk_size: int = 1000) -> Iterator[str]:
        """流式获取某次扫描下的所有目录 URL。"""
        queryset = self.snapshot_repo.get_by_scan(scan_id)
        for snapshot in queryset.iterator(chunk_size=chunk_size):
            yield snapshot.url
