"""Nuclei 模板 Worker 侧工具函数

提供 Worker 侧确保本地模板与 Server 版本一致的功能。

使用 Git commit hash 做版本校验：
- 从数据库获取 Server 的 commit_hash
- 检查本地仓库的 commit hash 是否一致
- 不一致则 git fetch + git checkout 到指定 commit

调用示例：
    template_path = ensure_nuclei_templates_local("nuclei-templates")
    # 返回本地模板目录路径，可直接用于 nuclei -t 参数
"""

import logging
import subprocess
from pathlib import Path
from typing import Optional

from django.conf import settings

from apps.engine.models import NucleiTemplateRepo

logger = logging.getLogger(__name__)


def get_local_commit_hash(local_path: Path) -> Optional[str]:
    """获取本地 Git 仓库的当前 commit hash

    Args:
        local_path: 本地仓库路径

    Returns:
        commit hash 字符串，失败返回 None
    """
    if not (local_path / ".git").is_dir():
        return None

    result = subprocess.run(
        ["git", "-C", str(local_path), "rev-parse", "HEAD"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode == 0:
        return result.stdout.strip()
    return None


def git_clone(repo_url: str, local_path: Path) -> bool:
    """Git clone 仓库

    Args:
        repo_url: 仓库 URL
        local_path: 本地路径

    Returns:
        是否成功
    """
    logger.info("正在 clone 模板仓库: %s -> %s", repo_url, local_path)
    result = subprocess.run(
        ["git", "clone", "--depth", "1", repo_url, str(local_path)],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        logger.error("git clone 失败: %s", result.stderr.strip())
        return False
    return True


def git_fetch_and_checkout(local_path: Path, commit_hash: str) -> bool:
    """Git fetch 并 checkout 到指定 commit

    Args:
        local_path: 本地仓库路径
        commit_hash: 目标 commit hash

    Returns:
        是否成功
    """
    logger.info("正在同步模板到 commit: %s", commit_hash[:8])

    # 先 unshallow（如果是浅克隆）
    subprocess.run(
        ["git", "-C", str(local_path), "fetch", "--unshallow"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # fetch origin
    fetch_result = subprocess.run(
        ["git", "-C", str(local_path), "fetch", "origin"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if fetch_result.returncode != 0:
        logger.error("git fetch 失败: %s", fetch_result.stderr.strip())
        return False

    # checkout 到指定 commit
    checkout_result = subprocess.run(
        ["git", "-C", str(local_path), "checkout", commit_hash],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if checkout_result.returncode != 0:
        logger.error("git checkout 失败: %s", checkout_result.stderr.strip())
        return False

    return True


def ensure_nuclei_templates_local(repo_name: str) -> str:
    """确保 Worker 本地模板与 Server 版本一致

    根据仓库名称查询数据库，获取 repo_url 和 commit_hash，
    然后确保本地仓库存在且版本与 Server 一致。

    Args:
        repo_name: 模板仓库名称，对应 NucleiTemplateRepo.name

    Returns:
        本地模板目录的绝对路径

    Raises:
        ValueError: 仓库不存在
        RuntimeError: Git 操作失败
    """
    # 从数据库查询仓库记录
    repo = NucleiTemplateRepo.objects.filter(name=repo_name).first()
    if not repo:
        raise ValueError(f"未找到模板仓库: {repo_name}，请先在「Nuclei 模板」中添加并同步")

    repo_url = repo.repo_url
    expected_hash = repo.commit_hash

    if not repo_url:
        raise ValueError(f"模板仓库 {repo_name} 缺少 repo_url")

    # 本地存储路径
    base_dir = getattr(settings, "NUCLEI_TEMPLATES_REPOS_BASE_DIR", "/opt/xingrin/nuclei-repos")
    local_path = Path(base_dir) / repo_name.replace(" ", "-").lower()
    local_path.mkdir(parents=True, exist_ok=True)

    # 检查本地是否有 .git 目录
    if not (local_path / ".git").is_dir():
        # 首次：git clone
        if not git_clone(repo_url, local_path):
            raise RuntimeError(f"无法 clone 模板仓库: {repo_name}")
    else:
        # 已有仓库：检查 commit hash
        local_hash = get_local_commit_hash(local_path)

        if expected_hash and local_hash != expected_hash:
            # commit 不一致：同步到 Server 版本
            logger.info(
                "本地模板版本不一致: local=%s, server=%s",
                (local_hash or "N/A")[:8],
                expected_hash[:8],
            )
            if not git_fetch_and_checkout(local_path, expected_hash):
                raise RuntimeError(f"无法同步模板仓库到指定版本: {repo_name}")
        elif not expected_hash:
            # Server 没有 commit_hash（未同步过），保持本地版本
            logger.warning("模板仓库 %s 在 Server 端未同步，使用本地版本", repo_name)
        else:
            logger.info("本地模板版本一致: %s", local_hash[:8] if local_hash else "N/A")

    return str(local_path)


__all__ = ["ensure_nuclei_templates_local"]
