"""Subdomain DTO"""

from dataclasses import dataclass


@dataclass
class SubdomainDTO:
    """
    子域名 DTO（纯资产表）
    
    用于传递子域名资产数据，只包含资产本身的信息。
    扫描相关信息存储在快照表中。
    """
    name: str
    target_id: int  # 必填：子域名必须属于某个目标
