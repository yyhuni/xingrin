"""Nuclei 模板仓库序列化器

用于 DRF ModelViewSet 的 CRUD 操作，将 NucleiTemplateRepo 模型序列化为 JSON。

字段说明：
- id: 仓库 ID（只读，自动生成）
- name: 仓库名称，用于前端展示
- repo_url: Git 仓库地址，如 https://github.com/projectdiscovery/nuclei-templates.git
- local_path: 本地克隆路径（只读，由后端自动生成）
- last_synced_at: 最后同步时间（只读）
- created_at: 创建时间（只读）
- updated_at: 更新时间（只读）
"""

from __future__ import annotations

from rest_framework import serializers

from apps.engine.models import NucleiTemplateRepo


class NucleiTemplateRepoSerializer(serializers.ModelSerializer):
    """Nuclei 模板仓库序列化器

    用于仓库的 CRUD API 响应。
    """

    class Meta:
        model = NucleiTemplateRepo
        fields = [
            "id",           # 仓库 ID（只读）
            "name",         # 仓库名称
            "repo_url",     # Git 仓库地址
            "local_path",   # 本地克隆路径（只读）
            "commit_hash",  # 最后同步的 commit hash（只读）
            "last_synced_at",  # 最后同步时间（只读）
            "created_at",   # 创建时间（只读）
            "updated_at",   # 更新时间（只读）
        ]
        read_only_fields = [
            "id",
            "local_path",      # 由后端根据 name 自动生成
            "commit_hash",     # 由 refresh 操作更新
            "last_synced_at",  # 由 refresh 操作更新
            "created_at",
            "updated_at",
        ]


__all__ = ["NucleiTemplateRepoSerializer"]
