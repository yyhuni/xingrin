"""WebSite DTO"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class WebSiteDTO:
    """网站数据传输对象"""
    target_id: int
    url: str
    host: str
    title: str = ''
    status_code: Optional[int] = None
    content_length: Optional[int] = None
    location: str = ''
    webserver: str = ''
    content_type: str = ''
    tech: List[str] = None
    body_preview: str = ''
    vhost: Optional[bool] = None
    created_at: str = None
    
    def __post_init__(self):
        if self.tech is None:
            self.tech = []
