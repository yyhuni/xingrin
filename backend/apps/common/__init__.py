"""
通用工具模块

提供各种共享的工具类和函数
"""

from .normalizer import normalize_domain, normalize_ip, normalize_cidr, normalize_target
from .validators import validate_domain, validate_ip, validate_cidr, detect_target_type

__all__ = [
    # 规范化工具
    'normalize_domain',
    'normalize_ip',
    'normalize_cidr',
    'normalize_target',
    
    # 验证器
    'validate_domain',
    'validate_ip',
    'validate_cidr',
    'detect_target_type',
]

