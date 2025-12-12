"""HostPortMapping DTO"""

from dataclasses import dataclass


@dataclass
class HostPortMappingDTO:
    """主机端口映射 DTO（资产表）"""
    target_id: int
    host: str
    ip: str
    port: int
