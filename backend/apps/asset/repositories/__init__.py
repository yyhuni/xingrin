"""Asset Repositories - 数据访问层"""

# 资产模块 Repositories
from .asset import (
    DjangoSubdomainRepository,
    DjangoWebSiteRepository,
    DjangoDirectoryRepository,
    DjangoHostPortMappingRepository,
    DjangoEndpointRepository,
)

# 快照模块 Repositories
from .snapshot import (
    DjangoSubdomainSnapshotRepository,
    DjangoHostPortMappingSnapshotRepository,
    DjangoWebsiteSnapshotRepository,
    DjangoDirectorySnapshotRepository,
    DjangoEndpointSnapshotRepository,
)

# 统计模块 Repository
from .statistics_repository import AssetStatisticsRepository

__all__ = [
    # 资产模块
    'DjangoSubdomainRepository',
    'DjangoWebSiteRepository',
    'DjangoDirectoryRepository',
    'DjangoHostPortMappingRepository',
    'DjangoEndpointRepository',
    # 快照模块
    'DjangoSubdomainSnapshotRepository',
    'DjangoHostPortMappingSnapshotRepository',
    'DjangoWebsiteSnapshotRepository',
    'DjangoDirectorySnapshotRepository',
    'DjangoEndpointSnapshotRepository',
    # 统计模块
    'AssetStatisticsRepository',
]


