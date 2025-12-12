"""WebsiteSnapshot DTO"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class WebsiteSnapshotDTO:
    """
    网站快照 DTO
    
    注意：target_id 只用于传递数据和转换为资产 DTO，不会保存到快照表中。
    快照只属于 scan，target 信息通过 scan.target 获取。
    """
    scan_id: int
    target_id: int  # 仅用于传递数据，不保存到数据库
    url: str
    host: str
    title: str = ''
    status: Optional[int] = None
    content_length: Optional[int] = None
    location: str = ''
    web_server: str = ''
    content_type: str = ''
    tech: List[str] = None
    body_preview: str = ''
    vhost: Optional[bool] = None
    
    def __post_init__(self):
        if self.tech is None:
            self.tech = []
    
    def to_asset_dto(self):
        """
        转换为资产 DTO（用于同步到资产表）
        
        Returns:
            WebSiteDTO: 资产表 DTO（移除 scan_id）
        """
        from apps.asset.dtos.asset import WebSiteDTO
        
        return WebSiteDTO(
            target_id=self.target_id,
            url=self.url,
            host=self.host,
            title=self.title,
            status_code=self.status,
            content_length=self.content_length,
            location=self.location,
            webserver=self.web_server,
            content_type=self.content_type,
            tech=self.tech if self.tech else [],
            body_preview=self.body_preview,
            vhost=self.vhost
        )
