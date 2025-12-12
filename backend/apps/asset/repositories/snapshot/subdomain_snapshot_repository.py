"""Django ORM 实现的 SubdomainSnapshot Repository"""

import logging
from typing import List

from apps.asset.models.snapshot_models import SubdomainSnapshot
from apps.asset.dtos import SubdomainSnapshotDTO
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoSubdomainSnapshotRepository:
    """子域名快照 Repository - 负责子域名快照表的数据访问"""

    def save_subdomain_snapshots(self, items: List[SubdomainSnapshotDTO]) -> None:
        """
        保存子域名快照
        
        Args:
            items: 子域名快照 DTO 列表
        
        Note:
            - 保存完整的快照数据
            - 基于唯一约束自动去重（忽略冲突）
        """
        try:
            logger.debug("准备保存子域名快照 - 数量: %d", len(items))
            
            if not items:
                logger.debug("子域名快照为空，跳过保存")
                return
                
            # 构建快照对象
            snapshots = []
            for item in items:
                snapshots.append(SubdomainSnapshot(
                    scan_id=item.scan_id,
                    name=item.name,
                ))
            
            # 批量创建（忽略冲突，基于唯一约束去重）
            SubdomainSnapshot.objects.bulk_create(snapshots, ignore_conflicts=True)
            
            logger.debug("子域名快照保存成功 - 数量: %d", len(snapshots))
            
        except Exception as e:
            logger.error(
                "保存子域名快照失败 - 数量: %d, 错误: %s",
                len(items),
                str(e),
                exc_info=True
            )
            raise
    
    def get_by_scan(self, scan_id: int):
        return SubdomainSnapshot.objects.filter(scan_id=scan_id).order_by('-discovered_at')

    def get_all(self):
        return SubdomainSnapshot.objects.all().order_by('-discovered_at')
