"""
定时扫描任务视图集

独立文件，避免 views.py 文件过大
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from django.core.exceptions import ValidationError
import logging

from ..models import ScheduledScan
from ..serializers import (
    ScheduledScanSerializer, CreateScheduledScanSerializer,
    UpdateScheduledScanSerializer, ToggleScheduledScanSerializer
)
from ..services.scheduled_scan_service import ScheduledScanService
from ..repositories import ScheduledScanDTO
from apps.common.pagination import BasePagination


logger = logging.getLogger(__name__)


class ScheduledScanViewSet(viewsets.ModelViewSet):
    """
    定时扫描任务视图集
    
    API 端点：
    - GET    /scheduled-scans/           获取定时扫描列表
    - POST   /scheduled-scans/           创建定时扫描
    - GET    /scheduled-scans/{id}/      获取定时扫描详情
    - PUT    /scheduled-scans/{id}/      更新定时扫描
    - DELETE /scheduled-scans/{id}/      删除定时扫描
    - POST   /scheduled-scans/{id}/toggle/   切换启用状态
    """
    
    queryset = ScheduledScan.objects.all().order_by('-created_at')
    serializer_class = ScheduledScanSerializer
    pagination_class = BasePagination
    filter_backends = [SearchFilter]
    search_fields = ['name']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.service = ScheduledScanService()
    
    def get_serializer_class(self):
        """根据 action 返回不同的序列化器"""
        if self.action == 'create':
            return CreateScheduledScanSerializer
        elif self.action in ['update', 'partial_update']:
            return UpdateScheduledScanSerializer
        elif self.action == 'toggle':
            return ToggleScheduledScanSerializer
        return ScheduledScanSerializer
    
    def create(self, request, *args, **kwargs):
        """创建定时扫描任务"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            data = serializer.validated_data
            dto = ScheduledScanDTO(
                name=data['name'],
                engine_id=data['engine_id'],
                organization_id=data.get('organization_id'),
                target_id=data.get('target_id'),
                cron_expression=data.get('cron_expression', '0 2 * * *'),
                is_enabled=data.get('is_enabled', True),
            )
            
            scheduled_scan = self.service.create(dto)
            response_serializer = ScheduledScanSerializer(scheduled_scan)
            
            return Response(
                {
                    'message': f'创建定时扫描任务成功: {scheduled_scan.name}',
                    'scheduled_scan': response_serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        """更新定时扫描任务"""
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            data = serializer.validated_data
            dto = ScheduledScanDTO(
                name=data.get('name'),
                engine_id=data.get('engine_id'),
                organization_id=data.get('organization_id'),
                target_id=data.get('target_id'),
                cron_expression=data.get('cron_expression'),
                is_enabled=data.get('is_enabled'),
            )
            
            scheduled_scan = self.service.update(instance.id, dto)
            response_serializer = ScheduledScanSerializer(scheduled_scan)
            
            return Response({
                'message': f'更新定时扫描任务成功: {scheduled_scan.name}',
                'scheduled_scan': response_serializer.data
            })
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        """删除定时扫描任务"""
        instance = self.get_object()
        name = instance.name
        
        if self.service.delete(instance.id):
            return Response({
                'message': f'删除定时扫描任务成功: {name}',
                'id': instance.id
            })
        return Response({'error': '删除失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """切换定时扫描任务的启用状态"""
        serializer = ToggleScheduledScanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        is_enabled = serializer.validated_data['is_enabled']
        
        if self.service.toggle_enabled(int(pk), is_enabled):
            scheduled_scan = self.get_object()
            response_serializer = ScheduledScanSerializer(scheduled_scan)
            
            status_text = '启用' if is_enabled else '禁用'
            return Response({
                'message': f'已{status_text}定时扫描任务',
                'scheduled_scan': response_serializer.data
            })
        
        return Response(
            {'error': f'定时扫描任务 ID {pk} 不存在或操作失败'},
            status=status.HTTP_404_NOT_FOUND
        )
    
