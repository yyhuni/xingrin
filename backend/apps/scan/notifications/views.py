"""
通知系统视图 - REST API 和测试接口
"""

import logging
from typing import Any
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.pagination import BasePagination
from .models import Notification
from .serializers import NotificationSerializer
from .types import NotificationLevel
from .services import NotificationService, NotificationSettingsService

logger = logging.getLogger(__name__)


def notifications_test(request):
    """
    测试通知推送
    """
    try:
        from .services import create_notification
        from django.http import JsonResponse

        level_param = request.GET.get('level', NotificationLevel.LOW)
        try:
            level_choice = NotificationLevel(level_param)
        except ValueError:
            level_choice = NotificationLevel.LOW

        title = request.GET.get('title') or "测试通知"
        message = request.GET.get('message') or "这是一条测试通知消息"

        # 创建测试通知
        notification = create_notification(
            title=title,
            message=message,
            level=level_choice
        )
        
        return JsonResponse({
            'success': True,
            'message': '测试通知已发送',
            'notification_id': notification.id
        })
        
    except Exception as e:
        logger.error(f"发送测试通知失败: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


def build_api_response(
    data: Any = None,
    *,
    message: str = '操作成功',
    code: str = '200',
    state: str = 'success',
    status_code: int = status.HTTP_200_OK
) -> Response:
    """构建统一的 API 响应格式
    
    Args:
        data: 响应数据体（可选）
        message: 响应消息
        code: 响应代码
        state: 响应状态（success/error）
        status_code: HTTP 状态码
        
    Returns:
        DRF Response 对象
    """
    payload = {
        'code': code,
        'state': state,
        'message': message,
    }
    if data is not None:
        payload['data'] = data
    return Response(payload, status=status_code)


def _parse_bool(value: str | None) -> bool | None:
    """解析字符串为布尔值
    
    Args:
        value: 字符串值，支持 '1', 'true', 'yes' 为 True；'0', 'false', 'no' 为 False
        
    Returns:
        布尔值，或 None（如果无法解析）
    """
    if value is None:
        return None
    value = str(value).strip().lower()
    if value in {'1', 'true', 'yes'}:
        return True
    if value in {'0', 'false', 'no'}:
        return False
    return None



class NotificationCollectionView(APIView):
    """通知列表
    
    支持的方法：
    - GET: 获取通知列表（支持分页和过滤）
    """
    pagination_class = BasePagination

    def get(self, request: Request) -> Response:
        """
        获取通知列表
        
        URL: GET /api/notifications/?page=1&pageSize=20&level=info&unread=true
        
        查询参数:
        - page: 页码（默认 1）
        - pageSize: 每页数量（默认 10，最大 1000）
        - level: 通知级别过滤（low/medium/high）
        - unread: 是否未读（true/false）
        
        返回:
        - results: 通知列表
        - total: 总记录数
        - page: 当前页码
        - page_size: 每页大小
        - total_pages: 总页数
        """
        service = NotificationService()

        # 按级别过滤
        level_param = request.query_params.get('level')
        level_filter = level_param if level_param in NotificationLevel.values else None

        # 按已读状态过滤
        # unread=true: 仅未读  unread=false: 仅已读  unread=None: 全部
        unread_param = _parse_bool(request.query_params.get('unread'))

        queryset = service.get_notifications(level=level_filter, unread=unread_param)
        
        # 使用通用分页器
        paginator = self.pagination_class()
        page_obj = paginator.paginate_queryset(queryset, request)
        serializer = NotificationSerializer(page_obj, many=True)
        return paginator.get_paginated_response(serializer.data)


class NotificationUnreadCountView(APIView):
    """获取未读通知数量
    
    URL: GET /api/notifications/unread-count/
    
    功能:
    - 返回当前未读通知的数量
    
    返回:
    - count: 未读通知数量
    """

    def get(self, request: Request) -> Response:
        """获取未读通知数量"""
        service = NotificationService()
        count = service.get_unread_count()
        return build_api_response({'count': count}, message='获取未读数量成功')


class NotificationMarkAllAsReadView(APIView):
    """标记全部通知为已读
    
    URL: POST /api/notifications/mark-all-as-read/
    
    功能:
    - 将所有未读通知标记为已读
    - 更新 read_at 时间戳
    
    返回:
    - updated: 更新的通知数量
    """

    def post(self, request: Request) -> Response:
        """标记全部通知为已读"""
        service = NotificationService()
        updated = service.mark_all_as_read()
        return build_api_response({'updated': updated}, message='全部标记已读成功')


class NotificationSettingsView(APIView):
    """通知设置 API
    
    URL: /api/settings/notifications/
    
    支持的方法：
    - GET: 获取当前通知设置
    - PUT: 更新通知设置
    """
    
    def get(self, request: Request) -> Response:
        """获取通知设置"""
        service = NotificationSettingsService()
        settings = service.get_settings()
        return Response(settings)
    
    def put(self, request: Request) -> Response:
        """更新通知设置"""
        service = NotificationSettingsService()
        settings = service.update_settings(request.data)
        return Response({'message': '已保存通知设置', **settings})


# ============================================
# Worker 回调 API
# ============================================

@api_view(['POST'])
@permission_classes([AllowAny])  # Worker 容器无认证，可考虑添加 Token 验证
def notification_callback(request):
    """
    接收 Worker 的通知推送请求
    
    Worker 容器无法直接访问 Redis，通过此 API 回调让 Server 推送 WebSocket。
    
    POST /api/callbacks/notification/
    {
        "id": 1,
        "category": "scan",
        "title": "扫描开始",
        "message": "...",
        "level": "info",
        "created_at": "2025-01-01T00:00:00"
    }
    """
    try:
        data = request.data
        
        # 验证必要字段
        required_fields = ['id', 'category', 'title', 'message', 'level', 'created_at']
        for field in required_fields:
            if field not in data:
                return Response(
                    {'error': f'缺少字段: {field}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # 推送到 WebSocket
        _push_notification_to_websocket(data)
        
        logger.debug(f"回调通知推送成功 - ID: {data['id']}, Title: {data['title']}")
        return Response({'status': 'ok'})
        
    except Exception as e:
        logger.error(f"回调通知处理失败: {e}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def _push_notification_to_websocket(data: dict):
    """推送通知到 WebSocket（Server 端使用）"""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("Channel Layer 未配置，跳过 WebSocket 推送")
        return
    
    # 构造通知数据
    ws_data = {
        'type': 'notification.message',
        'id': data['id'],
        'category': data['category'],
        'title': data['title'],
        'message': data['message'],
        'level': data['level'],
        'created_at': data['created_at']
    }
    
    # 发送到通知组
    async_to_sync(channel_layer.group_send)(
        'notifications',
        ws_data
    )
