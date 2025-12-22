"""Directory DTO"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class DirectoryDTO:
    """目录数据传输对象"""
    target_id: int
    url: str
    status: Optional[int] = None
    content_length: Optional[int] = None
    words: Optional[int] = None
    lines: Optional[int] = None
    content_type: str = ''
    duration: Optional[int] = None
