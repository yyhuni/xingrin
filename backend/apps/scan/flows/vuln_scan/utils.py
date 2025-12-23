"""
Vuln Scan 共享工具函数
"""

import logging
import subprocess

logger = logging.getLogger(__name__)


def calculate_timeout_by_line_count(
    tool_config: dict,
    file_path: str,
    base_per_time: int = 1,
    min_timeout: int = 600,
) -> int:
    """
    根据文件行数自动计算超时时间

    Args:
        tool_config: 工具配置（保留参数，未来可能用于更复杂的计算）
        file_path: 输入文件路径
        base_per_time: 每行的基础时间（秒）
        min_timeout: 最小超时时间（秒），默认600秒（10分钟）

    Returns:
        int: 计算出的超时时间（秒），不低于 min_timeout
    """
    try:
        result = subprocess.run(
            ["wc", "-l", file_path],
            capture_output=True,
            text=True,
            check=True,
        )
        line_count = int(result.stdout.strip().split()[0])
        timeout = max(line_count * base_per_time, min_timeout)
        logger.info(
            "timeout 自动计算: 文件=%s, 行数=%d, 每行时间=%d秒, 最小值=%d秒, timeout=%d秒",
            file_path,
            line_count,
            base_per_time,
            min_timeout,
            timeout,
        )
        return timeout
    except Exception as e:
        logger.warning("wc -l 计算行数失败: %s，使用最小超时: %d秒", e, min_timeout)
        return min_timeout
