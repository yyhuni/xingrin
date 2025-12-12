from django.db import models


class ScanStatus(models.TextChoices):
    """扫描任务状态枚举"""
    CANCELLED = 'cancelled', '已取消'
    COMPLETED = 'completed', '已完成'
    FAILED = 'failed', '失败'
    INITIATED = 'initiated', '初始化'
    RUNNING = 'running', '运行中'


class VulnSeverity(models.TextChoices):
    """漏洞严重性枚举"""
    UNKNOWN = 'unknown', '未知'
    INFO = 'info', '信息'
    LOW = 'low', '低'
    MEDIUM = 'medium', '中'
    HIGH = 'high', '高'
    CRITICAL = 'critical', '危急'
