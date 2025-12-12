"""EndpointSnapshot Repository - Django ORM 实现"""

import logging
from typing import List

from apps.asset.models.snapshot_models import EndpointSnapshot
from apps.asset.dtos.snapshot import EndpointSnapshotDTO
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoEndpointSnapshotRepository:
    """端点快照 Repository - 负责端点快照表的数据访问"""

    def save_snapshots(self, items: List[EndpointSnapshotDTO]) -> None:
        """
        保存端点快照
        
        Args:
            items: 端点快照 DTO 列表
        
        Note:
            - 保存完整的快照数据
            - 基于唯一约束 (scan + url) 自动去重
        """
        try:
            logger.debug("准备保存端点快照 - 数量: %d", len(items))
            
            if not items:
                logger.debug("端点快照为空，跳过保存")
                return
                
            # 构建快照对象
            snapshots = []
            for item in items:
                snapshots.append(EndpointSnapshot(
                    scan_id=item.scan_id,
                    url=item.url,
                    title=item.title,
                    status_code=item.status_code,
                    content_length=item.content_length,
                    location=item.location,
                    webserver=item.webserver,
                    content_type=item.content_type,
                    tech=item.tech if item.tech else [],
                    body_preview=item.body_preview,
                    vhost=item.vhost,
                    matched_gf_patterns=item.matched_gf_patterns if item.matched_gf_patterns else []
                ))
            
            # 批量创建（忽略冲突，基于唯一约束去重）
            EndpointSnapshot.objects.bulk_create(
                snapshots, 
                ignore_conflicts=True
            )
            
            logger.debug("端点快照保存成功 - 数量: %d", len(snapshots))
            
        except Exception as e:
            logger.error(
                "保存端点快照失败 - 数量: %d, 错误: %s",
                len(items),
                str(e),
                exc_info=True
            )
            raise
    
    def get_by_scan(self, scan_id: int):
        return EndpointSnapshot.objects.filter(scan_id=scan_id).order_by('-discovered_at')

    def get_all(self):
        return EndpointSnapshot.objects.all().order_by('-discovered_at')
