"""字典文件本地缓存与校验工具

提供 worker 侧的字典文件下载和 hash 校验功能，用于：
- 目录扫描 (directory_scan_flow)
- 子域名爆破 (subdomain_discovery_flow)
"""

import logging
import os
from pathlib import Path
from urllib import request as urllib_request
from urllib import parse as urllib_parse

from django.conf import settings

from apps.common.hash_utils import is_file_hash_match
from apps.engine.services import WordlistService

logger = logging.getLogger(__name__)


def ensure_wordlist_local(wordlist_name: str) -> str:
    """确保本地存在指定字典文件，并返回本地路径

    流程：
    1. 从 DB 查询 Wordlist 记录
    2. 计算本地缓存路径
    3. 如果本地文件存在且 hash 匹配，直接返回路径
    4. 否则从后端 API 下载最新文件

    Args:
        wordlist_name: 字典名称（对应 Wordlist.name）

    Returns:
        str: 本地字典文件绝对路径

    Raises:
        ValueError: 字典不存在或参数无效
        RuntimeError: 下载失败
    """
    if not wordlist_name:
        raise ValueError("wordlist_name 不能为空")

    service = WordlistService()
    wordlist = service.get_wordlist_by_name(wordlist_name)
    if not wordlist:
        raise ValueError(f"未找到名称为 '{wordlist_name}' 的字典，请在「字典管理」中先创建")

    # 计算本地缓存路径
    backend_path = Path(wordlist.file_path)
    base_dir = getattr(settings, 'WORDLISTS_BASE_PATH', '/opt/xingrin/wordlists')
    storage_dir = Path(base_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    local_path = storage_dir / backend_path.name

    # 获取期望的 hash（可能为空，表示老数据）
    expected_hash = getattr(wordlist, 'file_hash', '') or ''

    # 如果本地文件存在，进行 hash 校验
    if local_path.exists():
        if expected_hash:
            # 有 hash，进行校验
            if is_file_hash_match(str(local_path), expected_hash):
                logger.info("本地字典文件有效（hash 匹配）: %s", local_path)
                return str(local_path)
            else:
                logger.info("本地字典文件 hash 不匹配，将重新下载: %s", local_path)
        else:
            # 无 hash（老数据），保持旧逻辑：直接复用
            logger.info("本地已存在字典文件（无 hash 校验）: %s", local_path)
            return str(local_path)

    # 从后端下载字典
    # 优先使用 SERVER_URL 环境变量（动态容器中传递），否则使用 settings 配置
    server_url = os.getenv('SERVER_URL', '').strip()
    if server_url:
        api_base = f"{server_url.rstrip('/')}/api"
    else:
        public_host = getattr(settings, 'PUBLIC_HOST', '').strip()
        if not public_host:
            raise RuntimeError(
                "无法确定 Django API 地址：请配置 SERVER_URL 或 PUBLIC_HOST 环境变量"
            )
        server_port = getattr(settings, 'SERVER_PORT', '8888')
        api_base = f"http://{public_host}:{server_port}/api"
    query = urllib_parse.urlencode({'wordlist': wordlist_name})
    download_url = f"{api_base.rstrip('/')}/wordlists/download/?{query}"

    logger.info("从后端下载字典: %s -> %s", download_url, local_path)

    try:
        with urllib_request.urlopen(download_url) as resp:
            if resp.status != 200:
                raise RuntimeError(f"下载字典失败，HTTP {resp.status}")
            data = resp.read()
    except Exception as exc:
        logger.error("下载字典失败: %s", exc)
        raise RuntimeError(f"下载字典失败: {exc}") from exc

    with open(local_path, 'wb') as f:
        f.write(data)

    logger.info("字典下载完成并保存到: %s", local_path)
    return str(local_path)


__all__ = ["ensure_wordlist_local"]
