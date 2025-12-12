"""域名、IP、端口和目标验证工具函数"""
import ipaddress
import logging
import validators

logger = logging.getLogger(__name__)


def validate_domain(domain: str) -> None:
    """
    验证域名格式（使用 validators 库）
    
    Args:
        domain: 域名字符串（应该已经规范化）
        
    Raises:
        ValueError: 域名格式无效
    """
    if not domain:
        raise ValueError("域名不能为空")
    
    # 使用 validators 库验证域名格式
    # 支持国际化域名（IDN）和各种边界情况
    if not validators.domain(domain):
        raise ValueError(f"域名格式无效: {domain}")


def validate_ip(ip: str) -> None:
    """
    验证 IP 地址格式（支持 IPv4 和 IPv6）
    
    Args:
        ip: IP 地址字符串（应该已经规范化）
        
    Raises:
        ValueError: IP 地址格式无效
    """
    if not ip:
        raise ValueError("IP 地址不能为空")
    
    try:
        ipaddress.ip_address(ip)
    except ValueError:
        raise ValueError(f"IP 地址格式无效: {ip}")


def validate_cidr(cidr: str) -> None:
    """
    验证 CIDR 格式（支持 IPv4 和 IPv6）
    
    Args:
        cidr: CIDR 字符串（应该已经规范化）
        
    Raises:
        ValueError: CIDR 格式无效
    """
    if not cidr:
        raise ValueError("CIDR 不能为空")
    
    try:
        ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        raise ValueError(f"CIDR 格式无效: {cidr}")


def detect_target_type(name: str) -> str:
    """
    检测目标类型（不做规范化，只验证）
    
    Args:
        name: 目标名称（应该已经规范化）
        
    Returns:
        str: 目标类型 ('domain', 'ip', 'cidr') - 使用 Target.TargetType 枚举值
        
    Raises:
        ValueError: 如果无法识别目标类型
    """
    # 在函数内部导入模型，避免 AppRegistryNotReady 错误
    from apps.targets.models import Target

    if not name:
        raise ValueError("目标名称不能为空")
    
    # 检查是否是 CIDR 格式（包含 /）
    if '/' in name:
        validate_cidr(name)
        return Target.TargetType.CIDR
    
    # 检查是否是 IP 地址
    try:
        validate_ip(name)
        return Target.TargetType.IP
    except ValueError:
        pass
    
    # 检查是否是合法域名
    try:
        validate_domain(name)
        return Target.TargetType.DOMAIN
    except ValueError:
        pass
    
    # 无法识别的格式
    raise ValueError(f"无法识别的目标格式: {name}，必须是域名、IP地址或CIDR范围")


def validate_port(port: any) -> tuple[bool, int | None]:
    """
    验证并转换端口号
    
    Args:
        port: 待验证的端口号（可能是字符串、整数或其他类型）
    
    Returns:
        tuple: (is_valid, port_number)
            - is_valid: 端口是否有效
            - port_number: 有效时为整数端口号，无效时为 None
    
    验证规则：
        1. 必须能转换为整数
        2. 必须在 1-65535 范围内
    
    示例：
        >>> is_valid, port_num = validate_port(8080)
        >>> is_valid, port_num
        (True, 8080)
        
        >>> is_valid, port_num = validate_port("invalid")
        >>> is_valid, port_num
        (False, None)
    """
    try:
        port_num = int(port)
        if 1 <= port_num <= 65535:
            return True, port_num
        else:
            logger.warning("端口号超出有效范围 (1-65535): %d", port_num)
            return False, None
    except (ValueError, TypeError):
        logger.warning("端口号格式错误，无法转换为整数: %s", port)
        return False, None
