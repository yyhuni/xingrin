"""IPAddress DTO"""

from dataclasses import dataclass


@dataclass
class IPAddressDTO:
    """
    IP地址数据传输对象
    
    只包含 IP 自身的信息，不包含关联关系。
    关联关系通过 SubdomainIPAssociationDTO 管理。
    """
    ip: str
    protocol_version: str = ''
    is_private: bool = False
    reverse_pointer: str = ''
