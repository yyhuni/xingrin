"""Wordlist 数据访问层 Django ORM 实现

基于 Django ORM 的 Wordlist Repository 实现类
"""

import logging

from apps.engine.models import Wordlist
from apps.common.decorators import auto_ensure_db_connection


logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoWordlistRepository:
    """基于 Django ORM 的 Wordlist 数据访问层实现"""

    def get_queryset(self):
        """获取字典查询集"""
        return Wordlist.objects.all().order_by("-created_at")

    def get_by_id(self, wordlist_id: int) -> Wordlist | None:
        """根据 ID 获取字典"""
        try:
            return Wordlist.objects.get(id=wordlist_id)
        except Wordlist.DoesNotExist:
            logger.warning("Wordlist 不存在 - ID: %s", wordlist_id)
            return None

    def get_by_name(self, name: str) -> Wordlist | None:
        try:
            return Wordlist.objects.get(name=name)
        except Wordlist.DoesNotExist:
            logger.warning("Wordlist 不存在 - 名称: %s", name)
            return None

    def create(self, **kwargs) -> Wordlist:
        """创建字典记录"""
        return Wordlist.objects.create(**kwargs)

    def delete(self, wordlist_id: int) -> bool:
        """删除字典记录"""
        wordlist = self.get_by_id(wordlist_id)
        if not wordlist:
            return False
        wordlist.delete()
        return True


__all__ = ["DjangoWordlistRepository"]
