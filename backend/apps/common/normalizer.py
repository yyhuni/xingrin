import re

# 预编译正则表达式，避免每次调用时重新编译
IP_PATTERN = re.compile(r'^[\d.:]+$')


def normalize_domain(domain: str) -> str:
    """
    规范化域名
    - 去除首尾空格
    - 转换为小写
    - 移除末尾的点
    
    Args:
        domain: 原始域名
        
    Returns:
        规范化后的域名
        
    Raises:
        ValueError: 域名为空或只包含空格
    """
    if not domain or not domain.strip():
        raise ValueError("域名不能为空")
    
    normalized = domain.strip().lower()
    
    # 移除末尾的点
    if normalized.endswith('.'):
        normalized = normalized.rstrip('.')
    
    return normalized


def normalize_ip(ip: str) -> str:
    """
    规范化 IP 地址
    - 去除首尾空格
    - IP 地址不转小写（保持原样）
    
    Args:
        ip: 原始 IP 地址
        
    Returns:
        规范化后的 IP 地址
        
    Raises:
        ValueError: IP 地址为空或只包含空格
    """
    if not ip or not ip.strip():
        raise ValueError("IP 地址不能为空")
    
    return ip.strip()


def normalize_cidr(cidr: str) -> str:
    """
    规范化 CIDR
    - 去除首尾空格
    - CIDR 不转小写（保持原样）
    
    Args:
        cidr: 原始 CIDR
        
    Returns:
        规范化后的 CIDR
        
    Raises:
        ValueError: CIDR 为空或只包含空格
    """
    if not cidr or not cidr.strip():
        raise ValueError("CIDR 不能为空")
    
    return cidr.strip()


def normalize_target(target: str) -> str:
    """
    规范化目标名称（统一入口）
    根据目标格式自动选择合适的规范化函数
    
    Args:
        target: 原始目标名称
        
    Returns:
        规范化后的目标名称
        
    Raises:
        ValueError: 目标为空或只包含空格
    """
    if not target or not target.strip():
        raise ValueError("目标名称不能为空")
    
    # 先去除首尾空格
    trimmed = target.strip()
    
    # 如果包含 /，按 CIDR 处理
    if '/' in trimmed:
        return normalize_cidr(trimmed)
    
    # 如果是纯数字、点、冒号组成，按 IP 处理
    if IP_PATTERN.match(trimmed):
        return normalize_ip(trimmed)
    
    # 否则按域名处理
    return normalize_domain(trimmed)
