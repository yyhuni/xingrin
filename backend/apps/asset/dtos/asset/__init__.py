"""Asset DTOs - 数据传输对象"""

from .subdomain_dto import SubdomainDTO
from .ip_address_dto import IPAddressDTO
from .port_dto import PortDTO
from .website_dto import WebSiteDTO
from .directory_dto import DirectoryDTO
from .host_port_mapping_dto import HostPortMappingDTO
from .endpoint_dto import EndpointDTO
from .vulnerability_dto import VulnerabilityDTO

__all__ = [
    'SubdomainDTO',
    'IPAddressDTO',
    'PortDTO',
    'WebSiteDTO',
    'DirectoryDTO',
    'HostPortMappingDTO',
    'EndpointDTO',
    'VulnerabilityDTO',
]
