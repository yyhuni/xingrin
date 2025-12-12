"""
Scan Repositories 模块

提供 Scan 模型的数据访问层实现
其他模型的 Repository 应从各自的 app 导入
"""

# Django ORM 实现
from .django_scan_repository import DjangoScanRepository
from .scheduled_scan_repository import DjangoScheduledScanRepository, ScheduledScanDTO

# 为了向后兼容，保留 ScanRepository 别名
ScanRepository = DjangoScanRepository

__all__ = [
    # 实现类
    'DjangoScanRepository',
    'DjangoScheduledScanRepository',
    'ScheduledScanDTO',
    # 向后兼容别名
    'ScanRepository',
]

