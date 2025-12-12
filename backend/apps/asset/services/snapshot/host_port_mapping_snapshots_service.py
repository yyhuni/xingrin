"""HostPortMapping Snapshots Service - 业务逻辑层"""

import logging
from typing import List, Iterator

from apps.asset.repositories.snapshot import DjangoHostPortMappingSnapshotRepository
from apps.asset.services.asset import HostPortMappingService
from apps.asset.dtos.snapshot import HostPortMappingSnapshotDTO

logger = logging.getLogger(__name__)


class HostPortMappingSnapshotsService:
    """HostPortMapping Snapshots Service - 统一管理快照和资产同步"""
    
    def __init__(self):
        self.snapshot_repo = DjangoHostPortMappingSnapshotRepository()
        self.asset_service = HostPortMappingService()
    
    def save_and_sync(self, items: List[HostPortMappingSnapshotDTO]) -> None:
        """
        保存主机端口关联快照并同步到资产表（统一入口）
        
        流程：
        1. 保存到快照表（完整记录，包含 scan_id）
        2. 同步到资产表（去重，不包含 scan_id）
        
        Args:
            items: 主机端口关联快照 DTO 列表（必须包含 target_id）
        
        Note:
            target_id 已经包含在 DTO 中，无需额外传参。
        """
        logger.debug("保存主机端口关联快照 - 数量: %d", len(items))
        
        if not items:
            logger.debug("快照数据为空，跳过保存")
            return
        
        # 检查 Scan 是否仍存在（防止删除后竞态写入）
        scan_id = items[0].scan_id
        from apps.scan.repositories import DjangoScanRepository
        if not DjangoScanRepository().exists(scan_id):
            logger.warning("Scan 已删除，跳过主机端口快照保存 - scan_id=%s, 数量=%d", scan_id, len(items))
            return
        
        try:
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
            
            logger.info("主机端口关联快照和资产数据保存成功 - 数量: %d", len(items))
            
        except Exception as e:
            logger.error(
                "保存主机端口关联快照失败 - 数量: %d, 错误: %s",
                len(items),
                str(e),
                exc_info=True
            )
            raise
    
    def get_ip_aggregation_by_scan(self, scan_id: int, search: str = None):
        return self.snapshot_repo.get_ip_aggregation_by_scan(scan_id, search=search)

    def get_all_ip_aggregation(self, search: str = None):
        """获取所有 IP 聚合数据"""
        return self.snapshot_repo.get_all_ip_aggregation(search=search)

    def iter_ips_by_scan(self, scan_id: int, batch_size: int = 1000) -> Iterator[str]:
        """流式获取某次扫描下的所有唯一 IP 地址。"""
        return self.snapshot_repo.get_ips_for_export(scan_id=scan_id, batch_size=batch_size)
