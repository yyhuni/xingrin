"""EndpointSnapshot DTO"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class EndpointSnapshotDTO:
    """
    端点快照 DTO
    
    注意：target_id 只用于传递数据和转换为资产 DTO，不会保存到快照表中。
    快照只属于 scan。
    """
    scan_id: int
    url: str
    host: str = ''  # 主机名（域名或IP地址）
    title: str = ''
    status_code: Optional[int] = None
    content_length: Optional[int] = None
    location: str = ''
    webserver: str = ''
    content_type: str = ''
    tech: List[str] = None
    body_preview: str = ''
    vhost: Optional[bool] = None
    matched_gf_patterns: List[str] = None
    target_id: Optional[int] = None  # 冗余字段，用于同步到资产表
    
    def __post_init__(self):
        if self.tech is None:
            self.tech = []
        if self.matched_gf_patterns is None:
            self.matched_gf_patterns = []
    
    def to_asset_dto(self):
        """
        转换为资产 DTO（用于同步到资产表）
        
        Returns:
            EndpointDTO: 资产表 DTO（移除 scan_id）
        """
        from apps.asset.dtos.asset import EndpointDTO
        
        if self.target_id is None:
            raise ValueError("target_id 不能为 None，无法同步到资产表")
        
        return EndpointDTO(
            target_id=self.target_id,
            url=self.url,
            host=self.host,
            title=self.title,
            status_code=self.status_code,
            content_length=self.content_length,
            webserver=self.webserver,
            body_preview=self.body_preview,
            content_type=self.content_type,
            tech=self.tech if self.tech else [],
            vhost=self.vhost,
            location=self.location,
            matched_gf_patterns=self.matched_gf_patterns if self.matched_gf_patterns else []
        )
