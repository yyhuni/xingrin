"""信号接收器 - 处理通知相关的信号

监听各种信号并发送相应的通知。
"""

import logging
from django.dispatch import receiver

from apps.common.signals import vulnerabilities_saved, worker_delete_failed
from apps.scan.notifications import create_notification, NotificationLevel, NotificationCategory

logger = logging.getLogger(__name__)


@receiver(vulnerabilities_saved)
def on_vulnerabilities_saved(sender, items, scan_id, target_id, **kwargs):
    """漏洞保存完成后的通知处理
    
    为每个漏洞发送详细通知
    """
    if not items:
        return
    
    # 获取目标名称
    target_name = "未知目标"
    if target_id:
        try:
            from apps.targets.models import Target
            target = Target.objects.filter(id=target_id).first()
            if target:
                target_name = target.name
        except Exception:
            pass
    
    # 严重程度映射
    severity_level_map = {
        'critical': NotificationLevel.CRITICAL,
        'high': NotificationLevel.HIGH,
        'medium': NotificationLevel.MEDIUM,
        'low': NotificationLevel.LOW,
    }
    
    for vuln in items:
        try:
            severity = vuln.severity or 'unknown'
            
            # 构建漏洞详情消息
            message = f"漏洞：{vuln.vuln_type}\n"
            message += f"程度：{severity}\n"
            message += f"目标：{target_name}\n"
            message += f"URL：{vuln.url}"
            if vuln.source:
                message += f"\n来源：{vuln.source}"
            if vuln.description:
                message += f"\n描述：{vuln.description}"
            
            # 根据漏洞严重程度设置通知级别
            level = severity_level_map.get(severity.lower(), NotificationLevel.MEDIUM)
            
            create_notification(
                title=f"{vuln.vuln_type}",
                message=message,
                level=level,
                category=NotificationCategory.VULNERABILITY
            )
            
        except Exception as e:
            logger.error("发送漏洞通知失败 - url=%s: %s", vuln.url, e, exc_info=True)
    
    logger.info("漏洞通知已发送 - scan_id=%s, 数量=%d", scan_id, len(items))


@receiver(worker_delete_failed)
def on_worker_delete_failed(sender, worker_name, message, **kwargs):
    """Worker 删除失败时的通知处理"""
    create_notification(
        title="Worker 删除警告",
        message=f"节点 {worker_name} 已从数据库删除，但远程卸载失败: {message}",
        level=NotificationLevel.MEDIUM,
        category=NotificationCategory.SYSTEM
    )
    logger.warning("Worker 删除失败通知已发送 - worker=%s, message=%s", worker_name, message)
