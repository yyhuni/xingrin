"""通知服务 - 支持数据库存储和 WebSocket 实时推送"""

import logging
import time
import requests
import urllib3
from .models import Notification, NotificationSettings
from .types import NotificationLevel, NotificationCategory
from .repositories import DjangoNotificationRepository, NotificationSettingsRepository

# 禁用自签名证书的 SSL 警告（远程 Worker 回调场景）
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


# ============================================================
# 外部推送渠道抽象
# ============================================================

# Discord Embed 颜色映射（使用字符串 key，因为 model 字段存储的是字符串）
DISCORD_COLORS = {
    'low': 0x3498db,       # 蓝色
    'medium': 0xf39c12,    # 橙色
    'high': 0xe74c3c,      # 红色
    'critical': 0x9b59b6,  # 紫色
}

# 分类 emoji（使用字符串 key）
CATEGORY_EMOJI = {
    'scan': '🔍',
    'vulnerability': '⚠️',
    'asset': '🌐',
    'system': '⚙️',
}


def push_to_external_channels(notification: Notification) -> None:
    """
    推送通知到外部渠道（Discord、Slack 等）
    
    根据用户设置决定推送到哪些渠道。
    目前支持：Discord
    未来可扩展：Slack、Telegram、Email 等
    
    Args:
        notification: 通知对象
    """
    settings = NotificationSettings.get_instance()
    
    # 检查分类是否启用
    if not settings.is_category_enabled(notification.category):
        logger.debug(f"分类 {notification.category} 未启用外部推送")
        return
    
    # Discord 渠道
    if settings.discord_enabled and settings.discord_webhook_url:
        try:
            _send_discord(notification, settings.discord_webhook_url)
        except Exception as e:
            logger.warning(f"Discord 推送失败: {e}")
    
    # 未来扩展：Slack
    # if settings.slack_enabled and settings.slack_webhook_url:
    #     _send_slack(notification, settings.slack_webhook_url)
    
    # 未来扩展：Telegram
    # if settings.telegram_enabled and settings.telegram_bot_token:
    #     _send_telegram(notification, settings.telegram_chat_id)


def _send_discord(notification: Notification, webhook_url: str) -> bool:
    """发送到 Discord Webhook"""
    try:
        color = DISCORD_COLORS.get(notification.level, 0x95a5a6)
        emoji = CATEGORY_EMOJI.get(notification.category, '📢')
        
        embed = {
            'title': f"{emoji} {notification.title}",
            'description': notification.message,
            'color': color,
            'footer': {
                'text': f"级别: {notification.get_level_display()} | 分类: {notification.get_category_display()}"
            },
            'timestamp': notification.created_at.isoformat(),
        }
        
        response = requests.post(
            webhook_url,
            json={'embeds': [embed]},
            timeout=10
        )
        
        if response.status_code in (200, 204):
            logger.info(f"Discord 通知发送成功 - {notification.title}")
            return True
        else:
            logger.warning(f"Discord 发送失败 - 状态码: {response.status_code}")
            return False
            
    except requests.RequestException as e:
        logger.error(f"Discord 网络错误: {e}")
        return False


# ============================================================
# 设置服务
# ============================================================

class NotificationSettingsService:
    """通知设置服务"""
    
    def __init__(self, repository: NotificationSettingsRepository | None = None):
        self.repo = repository or NotificationSettingsRepository()
    
    def get_settings(self) -> dict:
        """获取通知设置（前端格式）"""
        settings = self.repo.get_settings()
        return {
            'discord': {
                'enabled': settings.discord_enabled,
                'webhookUrl': settings.discord_webhook_url,
            },
            'categories': settings.categories,
        }
    
    def update_settings(self, data: dict) -> dict:
        """更新通知设置
        
        注意：DRF CamelCaseJSONParser 会将前端的 webhookUrl 转换为 webhook_url
        """
        discord_data = data.get('discord', {})
        categories = data.get('categories', {})
        
        # CamelCaseJSONParser 转换后的字段名是 webhook_url
        webhook_url = discord_data.get('webhook_url', '')
        
        settings = self.repo.update_settings(
            discord_enabled=discord_data.get('enabled', False),
            discord_webhook_url=webhook_url,
            categories=categories,
        )
        
        return {
            'discord': {
                'enabled': settings.discord_enabled,
                'webhookUrl': settings.discord_webhook_url,
            },
            'categories': settings.categories,
        }


class NotificationService:
    """通知业务服务，封装常用查询与更新操作"""

    def __init__(self, repository: DjangoNotificationRepository | None = None):
        self.repo = repository or DjangoNotificationRepository()

    def get_notifications(self, level: str | None = None, unread: bool | None = None):
        return self.repo.get_filtered(level=level, unread=unread)

    def get_unread_count(self) -> int:
        return self.repo.get_unread_count()

    def mark_all_as_read(self) -> int:
        return self.repo.mark_all_as_read()


def create_notification(
    title: str,
    message: str,
    level: NotificationLevel = NotificationLevel.LOW,
    category: NotificationCategory = NotificationCategory.SYSTEM
) -> Notification:
    """
    创建通知记录并实时推送
    
    增强的重试机制：
    - 最多重试 3 次
    - 每次重试前强制关闭并重建数据库连接
    - 重试间隔：1秒 → 2秒 → 3秒
    - 针对连接错误进行特殊处理
    
    Args:
        title: 通知标题
        message: 通知消息
        level: 通知级别
        category: 通知分类
        
    Returns:
        Notification: 创建的通知对象
        
    Raises:
        Exception: 重试3次后仍然失败
    """
    from django.db import connection
    from psycopg2 import OperationalError, InterfaceError

    repo = DjangoNotificationRepository()

    max_retries = 3
    last_exception = None
    
    for attempt in range(1, max_retries + 1):
        try:
            # 强制关闭旧连接并重建（每次尝试都重建）
            if attempt > 1:
                logger.debug(f"重试创建通知 ({attempt}/{max_retries}) - {title}")
            
            connection.close()
            connection.ensure_connection()
            
            # 测试连接是否真的可用
            connection.cursor().execute("SELECT 1")
            
            # 1. 写入数据库（通过仓储层统一访问 ORM）
            notification = repo.create(
                title=title,
                message=message,
                level=level,
                category=category,
            )
            
            # 2. WebSocket 实时推送（推送失败不影响通知创建）
            try:
                _push_to_websocket(notification)
            except Exception as push_error:
                logger.warning(f"WebSocket 推送失败，但通知已创建 - {title}: {push_error}")
            
            # 3. 外部渠道推送（Discord/Slack 等，推送失败不影响通知创建）
            try:
                push_to_external_channels(notification)
            except Exception as external_error:
                logger.warning(f"外部渠道推送失败，但通知已创建 - {title}: {external_error}")
            
            if attempt > 1:
                logger.info(f"✓ 通知创建成功（重试 {attempt-1} 次后） - {title}")
            else:
                logger.debug(f"通知已创建并推送 - {title}")
            
            return notification
            
        except (OperationalError, InterfaceError) as e:
            # 数据库连接错误，需要重试
            last_exception = e
            error_msg = str(e)
            logger.warning(
                f"数据库连接错误 ({attempt}/{max_retries}) - {title}: {error_msg[:100]}"
            )
            
            if attempt < max_retries:
                # 指数退避：1秒、2秒、3秒
                sleep_time = attempt
                logger.debug(f"等待 {sleep_time} 秒后重试...")
                time.sleep(sleep_time)
            else:
                logger.error(
                    f"创建通知失败 - 数据库连接问题（已重试 {max_retries} 次） - {title}: {error_msg}"
                )
                
        except Exception as e:
            # 其他错误，不重试直接抛出
            last_exception = e
            error_str = str(e).lower()
            
            if 'connection' in error_str or 'closed' in error_str:
                logger.error(f"创建通知失败 - 连接相关错误 - {title}: {e}")
            else:
                logger.error(f"创建通知失败 - {title}: {e}")
            
            # 非连接错误，直接抛出不重试
            raise
    
    # 所有重试都失败了
    error_msg = f"创建通知失败 - 已重试 {max_retries} 次仍然失败 - {title}"
    logger.error(error_msg)
    raise RuntimeError(error_msg) from last_exception


def _push_to_websocket(notification: Notification) -> None:
    """
    推送通知到 WebSocket 客户端
    
    - 在 Server 容器中：直接通过 Channel Layer 推送
    - 在 Worker 容器中：通过 API 回调让 Server 推送（因为 Worker 无法访问 Redis）
    """
    import os
    
    # 检测是否在 Worker 容器中（有 SERVER_URL 环境变量）
    server_url = os.environ.get("SERVER_URL")
    
    if server_url:
        # Worker 容器：通过 API 回调
        _push_via_api_callback(notification, server_url)
    else:
        # Server 容器：直接推送
        _push_via_channel_layer(notification)


def _push_via_api_callback(notification: Notification, server_url: str) -> None:
    """
    通过 HTTP 回调推送通知（Worker → Server 跨容器通信）
    
    注意：这不是同进程内的 service 调用 view，而是 Worker 容器
    通过 HTTP 请求 Server 容器的 /api/callbacks/notification/ 接口。
    Worker 无法直接访问 Redis，需要由 Server 代为推送 WebSocket。
    """
    import requests
    
    try:
        callback_url = f"{server_url}/api/callbacks/notification/"
        data = {
            'id': notification.id,
            'category': notification.category,
            'title': notification.title,
            'message': notification.message,
            'level': notification.level,
            'created_at': notification.created_at.isoformat()
        }
        
        # verify=False: 远程 Worker 回调 Server 时可能使用自签名证书
        resp = requests.post(callback_url, json=data, timeout=5, verify=False)
        resp.raise_for_status()
        
        logger.debug(f"通知回调推送成功 - ID: {notification.id}")
        
    except Exception as e:
        logger.warning(f"通知回调推送失败 - ID: {notification.id}: {e}")


def _push_via_channel_layer(notification: Notification) -> None:
    """通过 Channel Layer 直接推送通知（Server 容器使用）"""
    try:
        logger.debug(f"开始推送通知到 WebSocket - ID: {notification.id}")
        
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        
        # 获取 Channel Layer
        channel_layer = get_channel_layer()
        
        if channel_layer is None:
            logger.warning("Channel Layer 未配置，跳过 WebSocket 推送")
            return
        
        # 构造通知数据
        data = {
            'type': 'notification.message',  # 对应 Consumer 的 notification_message 方法
            'id': notification.id,
            'category': notification.category,
            'title': notification.title,
            'message': notification.message,
            'level': notification.level,
            'created_at': notification.created_at.isoformat()
        }
        
        # 发送到通知组（所有连接的客户端）
        async_to_sync(channel_layer.group_send)(
            'notifications',  # 组名
            data
        )
        
        logger.debug(f"通知推送成功 - ID: {notification.id}")
        
    except ImportError as e:
        logger.warning(f"Channels 模块未安装，跳过 WebSocket 推送: {e}")
    except Exception as e:
        logger.warning(f"WebSocket 推送失败 - ID: {notification.id}: {e}", exc_info=True)
