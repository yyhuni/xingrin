"""Port DTO"""

from dataclasses import dataclass


@dataclass
class PortDTO:
    """端口数据传输对象"""
    ip_address_id: int
    number: int
    service_name: str = ''
    target_id: int = None
    scan_id: int = None
