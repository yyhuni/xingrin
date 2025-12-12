"""Asset DTOs - 数据传输对象"""

# 资产模块 DTOs
from .asset import (
    SubdomainDTO,
    WebSiteDTO,
    IPAddressDTO,
    DirectoryDTO,
    PortDTO,
    EndpointDTO,
)

# 快照模块 DTOs
from .snapshot import (
    SubdomainSnapshotDTO,
)

__all__ = [
    # 资产模块
    'SubdomainDTO',
    'WebSiteDTO',
    'IPAddressDTO',
    'DirectoryDTO',
    'PortDTO',
    'EndpointDTO',
    # 快照模块
    'SubdomainSnapshotDTO',
]
