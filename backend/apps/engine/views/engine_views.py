"""
扫描引擎 Views
"""
from rest_framework import viewsets

from apps.engine.serializers import ScanEngineSerializer
from apps.engine.services import EngineService


class ScanEngineViewSet(viewsets.ModelViewSet):
    """
    扫描引擎 ViewSet
    
    自动提供完整的 CRUD 操作：
    - GET /api/engines/ - 获取引擎列表
    - POST /api/engines/ - 创建新引擎
    - GET /api/engines/{id}/ - 获取引擎详情
    - PUT /api/engines/{id}/ - 更新引擎
    - PATCH /api/engines/{id}/ - 部分更新引擎
    - DELETE /api/engines/{id}/ - 删除引擎
    """
    
    serializer_class = ScanEngineSerializer

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.engine_service = EngineService()

    def get_queryset(self):
        """通过服务层获取查询集"""
        return self.engine_service.get_all_engines()
