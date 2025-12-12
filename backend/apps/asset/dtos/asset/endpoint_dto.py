"""Endpoint DTO"""

from dataclasses import dataclass
from typing import Optional, List


@dataclass
class EndpointDTO:
    """端点 DTO - 资产表数据传输对象"""
    target_id: int
    url: str
    host: Optional[str] = None
    title: Optional[str] = None
    status_code: Optional[int] = None
    content_length: Optional[int] = None
    webserver: Optional[str] = None
    body_preview: Optional[str] = None
    content_type: Optional[str] = None
    tech: Optional[List[str]] = None
    vhost: Optional[bool] = None
    location: Optional[str] = None
    matched_gf_patterns: Optional[List[str]] = None
    
    def __post_init__(self):
        if self.tech is None:
            self.tech = []
        if self.matched_gf_patterns is None:
            self.matched_gf_patterns = []
