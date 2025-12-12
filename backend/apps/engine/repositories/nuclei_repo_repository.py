"""Nuclei 模板仓库 Repository 层

本模块包含两个 Repository 类，负责数据访问：

1. NucleiTemplateRepository
   - 职责：ORM 操作，按 ID 查询仓库配置
   - 被 Service 层调用，不直接被 View 调用

2. TemplateFileRepository
   - 职责：文件系统操作，读取模板目录树和文件内容（只读）
   - 按仓库的 local_path 构建，一个仓库对应一个实例

调用链路：
    View → Service → Repository → Model/FileSystem
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional

from apps.common.decorators import auto_ensure_db_connection
from apps.engine.models import NucleiTemplateRepo


@auto_ensure_db_connection
class NucleiTemplateRepository:
    """Nuclei 模板仓库 ORM Repository

    负责与 NucleiTemplateRepo 模型交互，提供按 ID 查询功能。
    CRUD 操作由 DRF ModelViewSet 默认实现，这里只保留 Service 需要的查询方法。
    """

    def get_by_id(self, repo_id: int) -> Optional[NucleiTemplateRepo]:
        """根据 ID 获取仓库对象

        Args:
            repo_id: 仓库 ID

        Returns:
            NucleiTemplateRepo 对象，不存在返回 None
        """
        try:
            return NucleiTemplateRepo.objects.get(id=repo_id)
        except NucleiTemplateRepo.DoesNotExist:
            return None


class TemplateFileRepository:
    """模板文件系统 Repository（只读）

    负责读取指定根目录下的 Nuclei 模板文件。
    每个仓库克隆到本地后，用这个类来读取目录树和文件内容。

    Attributes:
        root: 仓库本地根目录路径（即 git clone 的目标目录）
    """

    def __init__(self, root: Path) -> None:
        """初始化文件系统 Repository

        Args:
            root: 仓库本地根目录路径（会自动转换为绝对路径）
        """
        # 确保存储的是绝对路径
        self.root = root.resolve()

    def get_tree(self) -> List[Dict]:
        """获取模板目录树结构

        遍历 root 目录，构建树形结构，只包含：
        - 文件夹节点
        - .yaml / .yml 文件节点

        Returns:
            树形结构列表，格式如下：
            [
                {
                    "type": "folder",
                    "name": "nuclei-templates",
                    "path": "",
                    "children": [
                        {"type": "folder", "name": "http", "path": "http", "children": [...]},
                        {"type": "file", "name": "example.yaml", "path": "http/example.yaml"}
                    ]
                }
            ]
        """
        # self.root 在 __init__ 中已确保是绝对路径
        root_dir = self.root

        # 根节点
        root_node: Dict = {
            "type": "folder",
            "name": root_dir.name or "root",
            "path": "",
            "children": [],
        }

        # 目录不存在时返回空树
        if not root_dir.exists() or not root_dir.is_dir():
            return [root_node]

        # 用于快速查找父节点
        path_to_node: Dict[Path, Dict] = {root_dir: root_node}

        # 遍历目录树
        for dirpath, dirnames, filenames in os.walk(root_dir):
            current_dir = Path(dirpath)
            parent_node = path_to_node.get(current_dir)
            if parent_node is None:
                continue

            # 添加子目录节点（按名称排序）
            for dirname in sorted(dirnames):
                child_fs_path = current_dir / dirname
                rel = child_fs_path.relative_to(root_dir)
                api_path = rel.as_posix()  # 使用 POSIX 风格路径（前端友好）

                node: Dict = {
                    "type": "folder",
                    "name": dirname,
                    "path": api_path,
                    "children": [],
                }
                parent_node.setdefault("children", []).append(node)
                path_to_node[child_fs_path] = node

            # 添加模板文件节点（仅 .yaml / .yml，按名称排序）
            for filename in sorted(filenames):
                if not (filename.endswith(".yaml") or filename.endswith(".yml")):
                    continue

                file_fs_path = current_dir / filename
                rel = file_fs_path.relative_to(root_dir)
                api_path = rel.as_posix()

                file_node: Dict = {
                    "type": "file",
                    "name": filename,
                    "path": api_path,
                }
                parent_node.setdefault("children", []).append(file_node)

        return [root_node]

    def get_file_content(self, rel_path: str) -> Optional[Dict]:
        """根据相对路径获取模板文件内容

        Args:
            rel_path: 相对于 root 的路径，如 "http/cves/CVE-2021-1234.yaml"

        Returns:
            成功时返回：
            {
                "path": "http/cves/CVE-2021-1234.yaml",
                "name": "CVE-2021-1234.yaml",
                "content": "id: CVE-2021-1234\ninfo:\n  name: ..."
            }
            失败时返回 None（路径无效、文件不存在、读取失败等）
        """
        # 清理路径
        rel_path = (rel_path or "").strip().lstrip("/")
        if not rel_path:
            return None

        # self.root 在 __init__ 中已确保是绝对路径
        base_dir = self.root
        # 拼接后 resolve() 确保解析 .. 等相对路径符号（防止目录遍历攻击）
        target_path = (base_dir / rel_path).resolve()

        # 防止目录遍历攻击：确保目标路径在 base_dir 内
        try:
            target_path.relative_to(base_dir)
        except ValueError:
            return None

        # 检查文件是否存在
        if not target_path.is_file():
            return None

        # 读取文件内容
        try:
            content = target_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return None

        return {
            "path": rel_path,
            "name": target_path.name,
            "content": content,
        }


__all__ = ["NucleiTemplateRepository", "TemplateFileRepository"]
