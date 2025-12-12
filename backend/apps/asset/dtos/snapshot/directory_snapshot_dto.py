"""Directory Snapshot DTO"""

from dataclasses import dataclass
from typing import Optional
from apps.asset.dtos.asset import DirectoryDTO


@dataclass
class DirectorySnapshotDTO:
    """
    目录快照数据传输对象
    
    用于保存扫描过程中发现的目录信息到快照表
    
    注意：website_id 和 target_id 只用于传递数据和转换为资产 DTO，不会保存到快照表中。
    快照只属于 scan。
    """
    scan_id: int
    website_id: int  # 仅用于传递数据，不保存到数据库
    target_id: int  # 仅用于传递数据，不保存到数据库
    url: str
    status: Optional[int] = None
    content_length: Optional[int] = None
    words: Optional[int] = None
    lines: Optional[int] = None
    content_type: str = ''
    duration: Optional[int] = None
    
    def to_asset_dto(self) -> DirectoryDTO:
        """
        转换为资产 DTO（用于同步到资产表）
        
        注意：去除 scan_id 字段，因为资产表不需要
        
        Returns:
            DirectoryDTO: 资产表 DTO
        """
        return DirectoryDTO(
            website_id=self.website_id,
            target_id=self.target_id,
            url=self.url,
            status=self.status,
            content_length=self.content_length,
            words=self.words,
            lines=self.lines,
            content_type=self.content_type,
            duration=self.duration
        )
