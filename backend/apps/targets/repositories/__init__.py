"""
Target Repositories 模块

提供 Target 和 Organization 数据访问层
"""

from .django_target_repository import DjangoTargetRepository
from .django_organization_repository import DjangoOrganizationRepository

__all__ = [
    'DjangoTargetRepository',
    'DjangoOrganizationRepository',
]
