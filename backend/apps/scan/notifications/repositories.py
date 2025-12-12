import logging
from typing import TypedDict
from django.utils import timezone

from apps.common.decorators import auto_ensure_db_connection
from .models import Notification, NotificationSettings


logger = logging.getLogger(__name__)


class NotificationSettingsData(TypedDict):
    """通知设置数据结构"""
    discord_enabled: bool
    discord_webhook_url: str
    categories: dict[str, bool]


@auto_ensure_db_connection
class NotificationSettingsRepository:
    """通知设置仓储层"""
    
    def get_settings(self) -> NotificationSettings:
        """获取通知设置单例"""
        return NotificationSettings.get_instance()
    
    def update_settings(
        self,
        discord_enabled: bool,
        discord_webhook_url: str,
        categories: dict[str, bool]
    ) -> NotificationSettings:
        """更新通知设置"""
        settings = NotificationSettings.get_instance()
        settings.discord_enabled = discord_enabled
        settings.discord_webhook_url = discord_webhook_url
        settings.categories = categories
        settings.save()
        return settings
    
    def is_category_enabled(self, category: str) -> bool:
        """检查指定分类是否启用"""
        settings = self.get_settings()
        return settings.is_category_enabled(category)


@auto_ensure_db_connection
class DjangoNotificationRepository:
    def get_filtered(self, level: str | None = None, unread: bool | None = None):
        queryset = Notification.objects.all()

        if level:
            queryset = queryset.filter(level=level)

        if unread is True:
            queryset = queryset.filter(is_read=False)
        elif unread is False:
            queryset = queryset.filter(is_read=True)

        return queryset.order_by("-created_at")

    def get_unread_count(self) -> int:
        return Notification.objects.filter(is_read=False).count()

    def mark_all_as_read(self) -> int:
        updated = Notification.objects.filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now(),
        )
        return updated

    def create(self, title: str, message: str, level: str, category: str = 'system') -> Notification:
        return Notification.objects.create(
            category=category,
            level=level,
            title=title,
            message=message,
        )
