"""通知系统类型定义"""

from django.db import models


class NotificationLevel(models.TextChoices):
    """通知级别"""
    LOW = 'low', '低'
    MEDIUM = 'medium', '中'
    HIGH = 'high', '高'
    CRITICAL = 'critical', '严重'


class NotificationCategory(models.TextChoices):
    """通知分类"""
    SCAN = 'scan', '扫描任务'
    VULNERABILITY = 'vulnerability', '漏洞发现'
    ASSET = 'asset', '资产发现'
    SYSTEM = 'system', '系统消息'
