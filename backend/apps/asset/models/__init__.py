# 导入所有模型，确保Django能发现它们

# 业务模型
from .asset_models import (
    Subdomain,
    WebSite,
    Endpoint,
    Directory,
    HostPortMapping,
    Vulnerability,
)

# 快照模型
from .snapshot_models import (
    SubdomainSnapshot,
    WebsiteSnapshot,
    DirectorySnapshot,
    HostPortMappingSnapshot,
    EndpointSnapshot,
    VulnerabilitySnapshot,
)

# 统计模型
from .statistics_models import AssetStatistics, StatisticsHistory

# 导出所有模型供外部导入
__all__ = [
    # 业务模型
    'Subdomain',
    'WebSite', 
    'Endpoint',
    'Directory',
    'HostPortMapping',
    'Vulnerability',
    # 快照模型
    'SubdomainSnapshot',
    'WebsiteSnapshot', 
    'DirectorySnapshot',
    'HostPortMappingSnapshot',
    'EndpointSnapshot',
    'VulnerabilitySnapshot',
    # 统计模型
    'AssetStatistics',
    'StatisticsHistory',
]
