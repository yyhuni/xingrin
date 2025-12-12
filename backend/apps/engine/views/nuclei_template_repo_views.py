"""Nuclei 模板仓库 View 层（HTTP 接口）

本模块提供 Nuclei 多仓库管理的 REST API，基于 DRF ModelViewSet。

API 列表：
==========

仓库 CRUD（ModelViewSet 默认实现）：
- GET    /api/nuclei/repos/              获取仓库列表
- POST   /api/nuclei/repos/              创建仓库
- GET    /api/nuclei/repos/{id}/         获取仓库详情
- PUT    /api/nuclei/repos/{id}/         更新仓库
- DELETE /api/nuclei/repos/{id}/         删除仓库

自定义 Action：
- POST   /api/nuclei/repos/{id}/refresh/           手动 Git 同步（clone/pull）
- GET    /api/nuclei/repos/{id}/templates/tree/    获取当前本地模板目录树（不自动同步）
- GET    /api/nuclei/repos/{id}/templates/content/ 获取单个模板内容（只读）

调用链路：
    HTTP Request → View → Service → Repository → Model/FileSystem
"""

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.engine.models import NucleiTemplateRepo
from apps.engine.serializers import NucleiTemplateRepoSerializer
from apps.engine.services import NucleiTemplateRepoService


logger = logging.getLogger(__name__)


class NucleiTemplateRepoViewSet(viewsets.ModelViewSet):
    """Nuclei 模板 Git 仓库 ViewSet

    继承 ModelViewSet，自动获得 CRUD 能力：
    - list: 获取仓库列表
    - create: 创建仓库
    - retrieve: 获取仓库详情
    - update: 更新仓库
    - destroy: 删除仓库

    额外提供三个自定义 Action（见下方方法）。

    Attributes:
        queryset: 默认查询集，按创建时间倒序
        serializer_class: 序列化器类
        service: Service 层实例，处理业务逻辑
    """

    # DRF ModelViewSet 配置
    queryset = NucleiTemplateRepo.objects.all().order_by("-created_at")
    serializer_class = NucleiTemplateRepoSerializer

    def __init__(self, *args, **kwargs) -> None:  # type: ignore[override]
        """初始化 ViewSet，创建 Service 实例"""
        super().__init__(*args, **kwargs)
        self.service = NucleiTemplateRepoService()

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        """创建仓库时初始化本地路径目录

        设计原则：第一次创建仓库就确定好 local_path，后续所有 Git 拉取和模板读取
        都复用这个固定目录，避免运行时才临时决定路径。
        """
        instance = serializer.save()
        # 初始化并持久化 local_path，同时在文件系统中创建对应目录
        self.service.ensure_local_path(instance)

    def perform_destroy(self, instance: NucleiTemplateRepo) -> None:  # type: ignore[override]
        """删除仓库时同时清理本地目录

        前端在 /tools/nuclei/ 点击删除时：
        - 这里会先尝试删除 instance.local_path 对应的目录
        - 然后调用父类逻辑删除数据库记录
        """
        # 清理本地目录（最佳努力，不影响主流程）
        self.service.remove_local_path_dir(instance)
        super().perform_destroy(instance)

    # ==================== 自定义 Action: Git 同步 ====================

    @action(detail=True, methods=["post"], url_path="refresh")
    def refresh(self, request: Request, pk: str | None = None) -> Response:
        """手动触发 Git 同步

        POST /api/nuclei/repos/{id}/refresh/

        执行 git clone（首次）或 git pull（后续）。
        同步成功后更新 last_synced_at。

        Returns:
            200: {"message": "刷新成功", "result": {...}}
            400: {"message": "无效的仓库 ID"} 或 {"message": "仓库不存在"}
            500: {"message": "刷新仓库失败"}
        """
        # 解析仓库 ID
        try:
            repo_id = int(pk) if pk is not None else None
        except (TypeError, ValueError):
            return Response({"message": "无效的仓库 ID"}, status=status.HTTP_400_BAD_REQUEST)

        # 调用 Service 层
        try:
            result = self.service.refresh_repo(repo_id)
        except ValidationError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            logger.error("刷新 Nuclei 模板仓库失败: %s", exc, exc_info=True)
            return Response({"message": "刷新仓库失败"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"message": "刷新成功", "result": result}, status=status.HTTP_200_OK)

    # ==================== 自定义 Action: 模板只读浏览 ====================

    @action(detail=True, methods=["get"], url_path="templates/tree")
    def templates_tree(self, request: Request, pk: str | None = None) -> Response:
        """获取模板目录树

        GET /api/nuclei/repos/{id}/templates/tree/

        只读取当前本地仓库目录，不主动触发 Git 同步。
        如需拉取远端最新内容，请先调用 POST /api/nuclei/repos/{id}/refresh/。

        返回的树形结构包含所有文件夹和 .yaml/.yml 文件。

        Returns:
            200: {"roots": [{type, name, path, children}, ...]}
            400: {"message": "无效的仓库 ID"} 或 {"message": "仓库不存在"}
            500: {"message": "获取模板目录树失败"}
        """
        # 解析仓库 ID
        try:
            repo_id = int(pk) if pk is not None else None
        except (TypeError, ValueError):
            return Response({"message": "无效的仓库 ID"}, status=status.HTTP_400_BAD_REQUEST)

        # 调用 Service 层，仅从当前本地目录读取目录树
        try:
            roots = self.service.get_template_tree(repo_id)
        except ValidationError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            logger.error("获取 Nuclei 模板目录树失败: %s", exc, exc_info=True)
            return Response({"message": "获取模板目录树失败"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"roots": roots})

    @action(detail=True, methods=["get"], url_path="templates/content")
    def templates_content(self, request: Request, pk: str | None = None) -> Response:
        """获取单个模板文件内容

        GET /api/nuclei/repos/{id}/templates/content/?path=http/example.yaml

        Query Parameters:
            path: 模板相对路径，如 "http/cves/CVE-2021-1234.yaml"

        Returns:
            200: {"path": "...", "name": "...", "content": "..."}
            400: {"message": "无效的仓库 ID"} 或 {"message": "缺少 path 参数"}
            404: {"message": "模板不存在或无法读取"}
            500: {"message": "获取模板内容失败"}
        """
        # 解析仓库 ID
        try:
            repo_id = int(pk) if pk is not None else None
        except (TypeError, ValueError):
            return Response({"message": "无效的仓库 ID"}, status=status.HTTP_400_BAD_REQUEST)

        # 解析 path 参数
        rel_path = (request.query_params.get("path", "") or "").strip()
        if not rel_path:
            return Response({"message": "缺少 path 参数"}, status=status.HTTP_400_BAD_REQUEST)

        # 调用 Service 层
        try:
            result = self.service.get_template_content(repo_id, rel_path)
        except ValidationError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            logger.error("获取 Nuclei 模板内容失败: %s", exc, exc_info=True)
            return Response({"message": "获取模板内容失败"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 文件不存在
        if result is None:
            return Response({"message": "模板不存在或无法读取"}, status=status.HTTP_404_NOT_FOUND)
        return Response(result)
