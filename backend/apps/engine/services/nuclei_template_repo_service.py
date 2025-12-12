"""Nuclei 模板仓库业务 Service 层

本模块封装 Nuclei 多仓库的核心业务逻辑：

1. Git 同步（refresh_repo）
   - 首次调用：git clone --depth 1
   - 后续调用：git pull --ff-only
   - 自动更新 last_synced_at 和 local_path

2. 模板只读浏览
   - get_template_tree: 获取目录树结构
   - get_template_content: 获取单个模板文件内容

注意：仓库的 CRUD 操作由 DRF ModelViewSet 默认实现，不在 Service 层处理。

调用链路：
    View.refresh() → Service.refresh_repo() → subprocess(git)
    View.templates_tree() → Service.get_template_tree() → Repository.get_tree()
    View.templates_content() → Service.get_template_content() → Repository.get_file_content()

配置项（settings.py）：
    NUCLEI_TEMPLATES_REPOS_BASE_DIR: 仓库本地存储根目录，默认 /opt/xingrin/nuclei-repos
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.engine.repositories import NucleiTemplateRepository, TemplateFileRepository


logger = logging.getLogger(__name__)


class NucleiTemplateRepoService:
    """Nuclei 多仓库业务 Service

    负责 Git 同步和模板只读浏览逻辑。
    通过依赖注入 Repository，方便单元测试。

    Attributes:
        repo: NucleiTemplateRepository 实例，用于 ORM 操作
    """

    def __init__(self, repository: NucleiTemplateRepository | None = None) -> None:
        """初始化 Service

        Args:
            repository: 可选，注入 NucleiTemplateRepository 实例（用于测试）
        """
        self.repo = repository or NucleiTemplateRepository()

    # ==================== 内部辅助方法 ====================

    def _get_repo_obj(self, repo_id: int):
        """获取仓库对象

        Args:
            repo_id: 仓库 ID

        Returns:
            NucleiTemplateRepo 对象

        Raises:
            ValidationError: 仓库不存在时抛出
        """
        obj = self.repo.get_by_id(repo_id)
        if not obj:
            raise ValidationError("仓库不存在")
        return obj

    def _get_base_dir(self) -> Path:
        """获取仓库本地存储根目录

        从 settings.NUCLEI_TEMPLATES_REPOS_BASE_DIR 读取，默认 /opt/xingrin/nuclei-repos。
        如果目录不存在会自动创建。

        Returns:
            根目录 Path 对象
        """
        base_dir = getattr(settings, "NUCLEI_TEMPLATES_REPOS_BASE_DIR", "/opt/xingrin/nuclei-repos")
        path = Path(base_dir).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    def remove_local_path_dir(self, repo_obj) -> None:
        """删除与仓库关联的本地目录（如果存在）

        只会删除位于 NUCLEI_TEMPLATES_REPOS_BASE_DIR 下的目录，避免误删其它路径。

        Args:
            repo_obj: NucleiTemplateRepo 实例
        """
        raw = (getattr(repo_obj, "local_path", "") or "").strip()
        if not raw:
            return

        base_dir = self._get_base_dir()
        path = Path(raw).expanduser().resolve()

        # 仅允许删除 base_dir 下的子目录
        try:
            path.relative_to(base_dir)
        except ValueError:
            return

        if not path.exists() or not path.is_dir():
            return

        try:
            shutil.rmtree(path)
        except OSError:
            # 删除失败时记录日志但不阻塞主流程
            logger.warning("删除 nuclei 本地目录失败: %s", path, exc_info=True)

    def ensure_local_path(self, repo_obj) -> Path:
        """确保仓库的本地路径存在并返回 Path

        规则：
        - 如果 repo.local_path 已有值：
          - 展开 ~ 并 resolve() 为绝对路径
        - 如果尚未设置：
          - 使用 baseDir/nameSlug 生成目录，例如：
            /opt/xingrin/nuclei-repos/di-san-fang-mo-ban
          - 如果 name 不可 slugify，则退化为 repo-<id>

        任何情况下都会保证目标目录已创建。

        Args:
            repo_obj: NucleiTemplateRepo 实例

        Returns:
            本地目录的绝对 Path
        """
        from django.utils.text import slugify

        # 已有 local_path，直接规范化为绝对路径
        if getattr(repo_obj, "local_path", None):
            path = Path(repo_obj.local_path).expanduser().resolve()
        else:
            base_dir = self._get_base_dir()
            # 根据仓库名称生成 slug，避免中文/空格等问题
            raw_name = (repo_obj.name or "").strip()
            slug = slugify(raw_name) if raw_name else ""
            if not slug:
                slug = f"repo-{repo_obj.id}"
            path = (base_dir / slug).resolve()
            repo_obj.local_path = str(path)
            repo_obj.save(update_fields=["local_path"])

        path.mkdir(parents=True, exist_ok=True)
        return path

    # ==================== Git 同步 ====================

    def refresh_repo(self, repo_id: int) -> Dict[str, Any]:
        """同步仓库（Git clone 或 pull）

        根据 local_path 是否存在 .git 目录判断：
        - 不存在：执行 git clone --depth 1（浅克隆，节省空间）
        - 存在：执行 git pull --ff-only（快进合并）

        同步成功后会更新数据库中的 last_synced_at 和 local_path。

        Args:
            repo_id: 仓库 ID

        Returns:
            {
                "repoId": 1,
                "action": "clone" | "pull",
                "localPath": "/opt/xingrin/nuclei-repos/my-templates",
                "stdout": "...",
                "stderr": "..."
            }

        Raises:
            ValidationError: 仓库不存在
            RuntimeError: Git 命令执行失败
        """
        import subprocess

        obj = self._get_repo_obj(repo_id)

        # 确保本地路径已生成并为绝对路径
        local_path = self.ensure_local_path(obj)

        git_dir = local_path / ".git"
        cmd: List[str]
        action: str

        # 判断是 clone 还是 pull
        if git_dir.is_dir():
            # 已有仓库，执行 pull
            cmd = ["git", "-C", str(local_path), "pull", "--ff-only"]
            action = "pull"
        else:
            # 新仓库，执行 clone
            if local_path.exists() and not local_path.is_dir():
                raise RuntimeError(f"本地路径已存在且不是目录: {local_path}")
            # --depth 1 浅克隆，只获取最新提交，节省空间和时间
            cmd = ["git", "clone", "--depth", "1", obj.repo_url, str(local_path)]
            action = "clone"

        # 执行 Git 命令
        result = subprocess.run(
            cmd,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        # 检查执行结果
        if result.returncode != 0:
            logger.warning("nuclei 模板仓库 %s git %s 失败: %s", obj.id, action, result.stderr.strip())
            raise RuntimeError("Git 同步失败")

        # 获取当前 commit hash
        commit_result = subprocess.run(
            ["git", "-C", str(local_path), "rev-parse", "HEAD"],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        commit_hash = commit_result.stdout.strip() if commit_result.returncode == 0 else ""

        # 同步成功，更新数据库（包含 commit_hash）
        obj.last_synced_at = timezone.now()
        obj.local_path = str(local_path)
        obj.commit_hash = commit_hash
        obj.save(update_fields=["last_synced_at", "local_path", "commit_hash"])

        logger.info(
            "nuclei 模板仓库 %s git %s 成功, commit=%s",
            obj.id, action, commit_hash[:8] if commit_hash else "N/A"
        )

        return {
            "repoId": obj.id,
            "action": action,
            "localPath": str(local_path),
            "commitHash": commit_hash,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }

    # ==================== 模板树与内容（只读） ====================

    def _get_fs_repo(self, repo_id: int) -> TemplateFileRepository:
        """获取文件系统 Repository 实例

        Args:
            repo_id: 仓库 ID

        Returns:
            TemplateFileRepository 实例

        Raises:
            ValidationError: 仓库不存在
        """
        obj = self._get_repo_obj(repo_id)
        # 确保本地路径已生成并为绝对路径
        root = self.ensure_local_path(obj)
        # 传入绝对路径给 Repository
        return TemplateFileRepository(root=root)

    def get_template_tree(self, repo_id: int) -> List[Dict[str, Any]]:
        """获取仓库的模板目录树

        Args:
            repo_id: 仓库 ID

        Returns:
            目录树结构，详见 TemplateFileRepository.get_tree()
        """
        fs_repo = self._get_fs_repo(repo_id)
        return fs_repo.get_tree()

    def get_template_content(self, repo_id: int, rel_path: str) -> Optional[Dict[str, Any]]:
        """获取单个模板文件内容

        Args:
            repo_id: 仓库 ID
            rel_path: 相对路径，如 "http/cves/CVE-2021-1234.yaml"

        Returns:
            文件内容，详见 TemplateFileRepository.get_file_content()
            文件不存在或读取失败返回 None
        """
        fs_repo = self._get_fs_repo(repo_id)
        return fs_repo.get_file_content(rel_path)


__all__ = ["NucleiTemplateRepoService"]
