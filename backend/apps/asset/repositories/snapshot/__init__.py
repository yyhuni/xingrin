"""Snapshot Repositories - 数据访问层"""

from .subdomain_snapshot_repository import DjangoSubdomainSnapshotRepository
from .host_port_mapping_snapshot_repository import DjangoHostPortMappingSnapshotRepository
from .website_snapshot_repository import DjangoWebsiteSnapshotRepository
from .directory_snapshot_repository import DjangoDirectorySnapshotRepository
from .endpoint_snapshot_repository import DjangoEndpointSnapshotRepository
from .vulnerability_snapshot_repository import DjangoVulnerabilitySnapshotRepository

__all__ = [
    'DjangoSubdomainSnapshotRepository',
    'DjangoHostPortMappingSnapshotRepository', 
    'DjangoWebsiteSnapshotRepository',
    'DjangoDirectorySnapshotRepository',
    'DjangoEndpointSnapshotRepository',
    'DjangoVulnerabilitySnapshotRepository',
]
