"""通用文件 hash 计算与校验工具

提供 SHA-256 哈希计算和校验功能，用于：
- 字典文件上传时计算 hash
- Worker 侧本地缓存校验
"""

import hashlib
import logging
from pathlib import Path
from typing import Optional, BinaryIO

logger = logging.getLogger(__name__)

# 默认分块大小：64KB（兼顾内存和性能）
DEFAULT_CHUNK_SIZE = 65536


def calc_file_sha256(file_path: str, chunk_size: int = DEFAULT_CHUNK_SIZE) -> str:
    """计算文件的 SHA-256 哈希值

    Args:
        file_path: 文件绝对路径
        chunk_size: 分块读取大小（字节），默认 64KB

    Returns:
        str: SHA-256 十六进制字符串（64 字符）

    Raises:
        FileNotFoundError: 文件不存在
        OSError: 文件读取失败
    """
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def calc_stream_sha256(stream: BinaryIO, chunk_size: int = DEFAULT_CHUNK_SIZE) -> str:
    """从二进制流计算 SHA-256（用于边写边算）

    Args:
        stream: 可读取的二进制流（如 UploadedFile.chunks()）
        chunk_size: 分块大小

    Returns:
        str: SHA-256 十六进制字符串
    """
    hasher = hashlib.sha256()
    for chunk in iter(lambda: stream.read(chunk_size), b""):
        hasher.update(chunk)
    return hasher.hexdigest()


def safe_calc_file_sha256(file_path: str) -> Optional[str]:
    """安全计算文件 SHA-256（异常时返回 None）

    Args:
        file_path: 文件绝对路径

    Returns:
        str | None: SHA-256 十六进制字符串，或 None（文件不存在/读取失败）
    """
    try:
        return calc_file_sha256(file_path)
    except FileNotFoundError:
        logger.warning("计算 hash 失败：文件不存在 - %s", file_path)
        return None
    except OSError as exc:
        logger.warning("计算 hash 失败：读取错误 - %s: %s", file_path, exc)
        return None


def is_file_hash_match(file_path: str, expected_hash: str) -> bool:
    """校验文件 hash 是否与期望值匹配

    Args:
        file_path: 文件绝对路径
        expected_hash: 期望的 SHA-256 十六进制字符串

    Returns:
        bool: True 表示匹配，False 表示不匹配或计算失败
    """
    if not expected_hash:
        # 期望值为空，视为"无法校验"，返回 False 让调用方决定是否重新下载
        return False

    actual_hash = safe_calc_file_sha256(file_path)
    if actual_hash is None:
        return False

    return actual_hash.lower() == expected_hash.lower()


__all__ = [
    "calc_file_sha256",
    "calc_stream_sha256",
    "safe_calc_file_sha256",
    "is_file_hash_match",
]
