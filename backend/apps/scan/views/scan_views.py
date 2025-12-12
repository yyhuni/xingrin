from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, APIException
from rest_framework.filters import SearchFilter
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db.utils import DatabaseError, IntegrityError, OperationalError
import logging

logger = logging.getLogger(__name__)

from ..models import Scan, ScheduledScan
from ..serializers import (
    ScanSerializer, ScanHistorySerializer, QuickScanSerializer,
    ScheduledScanSerializer, CreateScheduledScanSerializer,
    UpdateScheduledScanSerializer, ToggleScheduledScanSerializer
)
from ..services.scan_service import ScanService
from ..services.scheduled_scan_service import ScheduledScanService
from ..repositories import ScheduledScanDTO
from apps.targets.services.target_service import TargetService
from apps.targets.services.organization_service import OrganizationService
from apps.engine.services.engine_service import EngineService
from apps.common.definitions import ScanStatus
from apps.common.pagination import BasePagination


class ScanViewSet(viewsets.ModelViewSet):
    """扫描任务视图集"""
    serializer_class = ScanSerializer
    pagination_class = BasePagination
    filter_backends = [SearchFilter]
    search_fields = ['target__name']  # 按目标名称搜索
    
    def get_queryset(self):
        """优化查询集，提升API性能
        
        查询优化策略：
        - select_related: 预加载 target 和 engine（一对一/多对一关系，使用 JOIN）
        - 移除 prefetch_related: 避免加载大量资产数据到内存
        - order_by: 按创建时间降序排列（最新创建的任务排在最前面）
        
        性能优化原理：
        - 列表页：使用缓存统计字段（cached_*_count），避免实时 COUNT 查询
        - 序列化器：严格验证缓存字段，确保数据一致性
        - 分页场景：每页只显示10条记录，查询高效
        - 避免大数据加载：不再预加载所有关联的资产数据
        """
        # 只保留必要的 select_related，移除所有 prefetch_related
        scan_service = ScanService()
        queryset = scan_service.get_all_scans(prefetch_relations=True)
        
        return queryset
    
    def get_serializer_class(self):
        """根据不同的 action 返回不同的序列化器
        
        - list action: 使用 ScanHistorySerializer（包含 summary 和 progress）
        - retrieve action: 使用 ScanHistorySerializer（包含 summary 和 progress）
        - 其他 action: 使用标准的 ScanSerializer
        """
        if self.action in ['list', 'retrieve']:
            return ScanHistorySerializer
        return ScanSerializer

    def destroy(self, request, *args, **kwargs):
        """
        删除单个扫描任务（两阶段删除）
        
        1. 软删除：立即对用户不可见
        2. 硬删除：后台异步执行
        """
        try:
            scan = self.get_object()
            scan_service = ScanService()
            result = scan_service.delete_scans_two_phase([scan.id])
            
            return Response({
                'message': f'已删除扫描任务: Scan #{scan.id}',
                'scanId': scan.id,
                'deletedCount': result['soft_deleted_count'],
                'deletedScans': result['scan_names'],
                'detail': {
                    'phase1': '软删除完成，用户已看不到数据',
                    'phase2': '硬删除任务已分发，将在后台执行'
                }
            }, status=status.HTTP_200_OK)
            
        except Scan.DoesNotExist:
            raise NotFound('扫描任务不存在')
        except ValueError as e:
            raise NotFound(str(e))
        except Exception as e:
            logger.exception("删除扫描任务时发生错误")
            raise APIException('服务器错误，请稍后重试')
    
    @action(detail=False, methods=['post'])
    def quick(self, request):
        """
        快速扫描接口
        
        功能：
        1. 接收目标列表和引擎配置
        2. 自动批量创建/获取目标
        3. 立即发起批量扫描
        
        请求参数：
        {
            "targets": [{"name": "example.com"}, {"name": "1.1.1.1"}],
            "engine_id": 1
        }
        """
        serializer = QuickScanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        targets_data = serializer.validated_data['targets']
        engine_id = serializer.validated_data.get('engine_id')
        
        try:
            # 1. 批量创建/获取目标
            target_service = TargetService()
            batch_result = target_service.batch_create_targets(
                targets_data=targets_data,
                organization_id=None  # 快速扫描不关联组织
            )
            
            # 收集所有目标对象（包括新创建和已存在的）
            # batch_create_targets 返回的是统计信息，我们需要获取目标对象列表
            # 这里重新查询刚刚创建/获取的目标
            target_names = [t['name'] for t in targets_data]
            targets = target_service.get_targets_by_names(target_names)
            
            if not targets:
                return Response(
                    {'error': '没有有效的目标可供扫描'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 2. 获取扫描引擎
            engine_service = EngineService()
            engine = engine_service.get_engine(engine_id)
            if not engine:
                raise ValidationError(f'扫描引擎 ID {engine_id} 不存在')
            
            # 3. 批量发起扫描
            scan_service = ScanService()
            created_scans = scan_service.create_scans(
                targets=targets,
                engine=engine
            )
            
            # 序列化返回结果
            scan_serializer = ScanSerializer(created_scans, many=True)
            
            return Response({
                'message': f'快速扫描已启动：{len(created_scans)} 个任务',
                'target_stats': {
                    'created': batch_result['created_count'],
                    'failed': batch_result['failed_count']
                },
                'scans': scan_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("快速扫描启动失败")
            return Response(
                {'error': '服务器内部错误，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def initiate(self, request):
        """
        发起扫描任务
        
        请求参数:
        - organization_id: 组织ID (int, 可选)
        - target_id: 目标ID (int, 可选)
        - engine_id: 扫描引擎ID (int, 必填)
        
        注意: organization_id 和 target_id 二选一
        
        返回:
        - 扫描任务详情（单个或多个）
        """
        # 获取请求数据
        organization_id = request.data.get('organization_id')
        target_id = request.data.get('target_id')
        engine_id = request.data.get('engine_id')
        
        try:
            # 步骤1：准备扫描所需的数据（验证参数、查询资源、返回目标列表和引擎）
            scan_service = ScanService()
            targets, engine = scan_service.prepare_initiate_scan(
                organization_id=organization_id,
                target_id=target_id,
                engine_id=engine_id
            )
            
            # 步骤2：批量创建扫描记录并分发扫描任务
            created_scans = scan_service.create_scans(
                targets=targets,
                engine=engine
            )
            
            # 序列化返回结果
            scan_serializer = ScanSerializer(created_scans, many=True)
            
            return Response(
                {
                    'message': f'已成功发起 {len(created_scans)} 个扫描任务',
                    'count': len(created_scans),
                    'scans': scan_serializer.data
                },
                status=status.HTTP_201_CREATED
            )
            
        except ObjectDoesNotExist as e:
            # 资源不存在错误（由 service 层抛出）
            error_msg = str(e)
            return Response(
                {'error': error_msg},
                status=status.HTTP_404_NOT_FOUND
            )
        
        except ValidationError as e:
            # 参数验证错误（由 service 层抛出）
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except (DatabaseError, IntegrityError, OperationalError):
            # 数据库错误
            return Response(
                {'error': '数据库错误，请稍后重试'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

    # 所有快照相关的 action 和 export 已迁移到 asset/views.py 中的快照 ViewSet
    # GET /api/scans/{id}/subdomains/ -> SubdomainSnapshotViewSet
    # GET /api/scans/{id}/subdomains/export/ -> SubdomainSnapshotViewSet.export
    # GET /api/scans/{id}/websites/ -> WebsiteSnapshotViewSet
    # GET /api/scans/{id}/websites/export/ -> WebsiteSnapshotViewSet.export
    # GET /api/scans/{id}/directories/ -> DirectorySnapshotViewSet
    # GET /api/scans/{id}/directories/export/ -> DirectorySnapshotViewSet.export
    # GET /api/scans/{id}/endpoints/ -> EndpointSnapshotViewSet
    # GET /api/scans/{id}/endpoints/export/ -> EndpointSnapshotViewSet.export
    # GET /api/scans/{id}/ip-addresses/ -> HostPortMappingSnapshotViewSet
    # GET /api/scans/{id}/ip-addresses/export/ -> HostPortMappingSnapshotViewSet.export
    # GET /api/scans/{id}/vulnerabilities/ -> VulnerabilitySnapshotViewSet

    @action(detail=False, methods=['post', 'delete'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """
        批量删除扫描记录
        
        请求参数:
        - ids: 扫描ID列表 (list[int], 必填)
        
        示例请求:
        POST /api/scans/bulk-delete/
        {
            "ids": [1, 2, 3]
        }
        
        返回:
        - message: 成功消息
        - deletedCount: 实际删除的记录数
        
        注意:
        - 使用级联删除，会同时删除关联的子域名、端点等数据
        - 只删除存在的记录，不存在的ID会被忽略
        """
        ids = request.data.get('ids', [])
        
        # 参数验证
        if not ids:
            return Response(
                {'error': '缺少必填参数: ids'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not isinstance(ids, list):
            return Response(
                {'error': 'ids 必须是数组'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not all(isinstance(i, int) for i in ids):
            return Response(
                {'error': 'ids 数组中的所有元素必须是整数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 使用 Service 层批量删除（两阶段删除）
            scan_service = ScanService()
            result = scan_service.delete_scans_two_phase(ids)
            
            return Response({
                'message': f"已删除 {result['soft_deleted_count']} 个扫描任务",
                'deletedCount': result['soft_deleted_count'],
                'deletedScans': result['scan_names'],
                'detail': {
                    'phase1': '软删除完成，用户已看不到数据',
                    'phase2': '硬删除任务已分发，将在后台执行'
                }
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            # 未找到记录
            raise NotFound(str(e))
            
        except Exception as e:
            logger.exception("批量删除扫描任务时发生错误")
            raise APIException('服务器错误，请稍后重试')
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        获取扫描统计数据
        
        返回扫描任务的汇总统计信息，用于仪表板和扫描历史页面。
        使用缓存字段聚合查询，性能优异。
        
        返回:
        - total: 总扫描次数
        - running: 运行中的扫描数量
        - completed: 已完成的扫描数量
        - failed: 失败的扫描数量
        - totalVulns: 总共发现的漏洞数量
        - totalSubdomains: 总共发现的子域名数量
        - totalEndpoints: 总共发现的端点数量
        - totalAssets: 总资产数
        """
        try:
            # 使用 Service 层获取统计数据
            scan_service = ScanService()
            stats = scan_service.get_statistics()
            
            return Response({
                'total': stats['total'],
                'running': stats['running'],
                'completed': stats['completed'],
                'failed': stats['failed'],
                'totalVulns': stats['total_vulns'],
                'totalSubdomains': stats['total_subdomains'],
                'totalEndpoints': stats['total_endpoints'],
                'totalWebsites': stats['total_websites'],
                'totalAssets': stats['total_assets'],
            })
        
        except (DatabaseError, OperationalError):
            return Response(
                {'error': '数据库错误，请稍后重试'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
    
    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):  # pylint: disable=unused-argument
        """
        停止扫描任务
        
        URL: POST /api/scans/{id}/stop/
        
        功能:
        - 终止正在运行或初始化的扫描任务
        - 更新扫描状态为 CANCELLED
        
        状态限制:
        - 只能停止 RUNNING 或 INITIATED 状态的扫描
        - 已完成、失败或取消的扫描无法停止
        
        返回:
        - message: 成功消息
        - revokedTaskCount: 取消的 Flow Run 数量
        """
        try:
            # 使用 Service 层处理停止逻辑
            scan_service = ScanService()
            success, revoked_count = scan_service.stop_scan(scan_id=pk)
            
            if not success:
                # 检查是否是状态不允许的问题
                scan = scan_service.get_scan(scan_id=pk, prefetch_relations=False)
                if scan and scan.status not in [ScanStatus.RUNNING, ScanStatus.INITIATED]:
                    return Response(
                        {
                            'error': f'无法停止扫描：当前状态为 {ScanStatus(scan.status).label}',
                            'detail': '只能停止运行中或初始化状态的扫描'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # 其他失败原因
                return Response(
                    {'error': '停止扫描失败'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            return Response(
                {
                    'message': f'扫描已停止，已撤销 {revoked_count} 个任务',
                    'revokedTaskCount': revoked_count
                },
                status=status.HTTP_200_OK
            )
        
        except ObjectDoesNotExist:
            return Response(
                {'error': f'扫描 ID {pk} 不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        except (DatabaseError, IntegrityError, OperationalError):
            return Response(
                {'error': '数据库错误，请稍后重试'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
