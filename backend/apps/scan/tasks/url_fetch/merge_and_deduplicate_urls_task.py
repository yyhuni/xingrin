"""
合并并去重 URL 任务

合并多个工具的输出文件，去重并验证 URL 格式
性能优化：使用系统命令处理大文件
"""

import logging
import uuid
import subprocess
from pathlib import Path
from datetime import datetime
from prefect import task
from typing import List

logger = logging.getLogger(__name__)


@task(
    name='merge_and_deduplicate_urls',
    retries=1,
    log_prints=True
)
def merge_and_deduplicate_urls_task(
    result_files: List[str],
    result_dir: str
) -> str:
    """
    合并扫描结果并去重（高性能流式处理）
    
    流程：
    1. 使用 LC_ALL=C sort -u 直接处理多文件
    2. 排序去重一步完成
    3. 返回去重后的 URL 文件路径
    
    Args:
        result_files: 结果文件路径列表
        result_dir: 结果目录
    
    Returns:
        str: 去重后的 URL 文件路径
    
    Raises:
        RuntimeError: 处理失败
    """
    logger.info("开始合并并去重 %d 个结果文件（系统命令优化）", len(result_files))

    result_path = Path(result_dir)

    # 验证文件存在性
    valid_files = []
    for file_path_str in result_files:
        file_path = Path(file_path_str)
        if file_path.exists():
            valid_files.append(str(file_path))
        else:
            logger.warning("结果文件不存在: %s", file_path)

    if not valid_files:
        raise RuntimeError("所有结果文件都不存在")

    # 生成输出文件路径
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    short_uuid = uuid.uuid4().hex[:4]
    merged_file = result_path / f"merged_{timestamp}_{short_uuid}.txt"

    try:
        # 使用系统命令一步完成: 排序去重
        cmd = f"LC_ALL=C sort -u {' '.join(valid_files)} -o {merged_file}"
        logger.debug("执行命令: %s", cmd)

        # 按输入文件总行数动态计算超时时间
        total_lines = 0
        for file_path in valid_files:
            try:
                line_count_proc = subprocess.run(
                    ["wc", "-l", file_path],
                    check=True,
                    capture_output=True,
                    text=True,
                )
                total_lines += int(line_count_proc.stdout.strip().split()[0])
            except (subprocess.CalledProcessError, ValueError, IndexError):
                continue

        timeout = 3600
        if total_lines > 0:
            # 按行数线性计算：每行约 0.1 秒
            base_per_line = 0.1
            est = int(total_lines * base_per_line)
            timeout = max(600, est)

        logger.info(
            "URL 合并去重 timeout 自动计算: 输入总行数=%d, timeout=%d秒",
            total_lines,
            timeout,
        )

        result = subprocess.run(
            cmd,
            shell=True,
            check=True,
            timeout=timeout
        )

        logger.debug("✓ 合并去重完成")

        # 统计结果
        if not merged_file.exists():
            raise RuntimeError("合并文件未被创建")

        # 优先使用 wc -l 统计行数，大文件性能更好
        try:
            line_count_proc = subprocess.run(
                ["wc", "-l", str(merged_file)],
                check=True,
                capture_output=True,
                text=True,
            )
            unique_count = int(line_count_proc.stdout.strip().split()[0])
        except (subprocess.CalledProcessError, ValueError, IndexError) as e:
            logger.warning(
                "wc -l 统计失败（文件: %s），降级为 Python 逐行统计 - 错误: %s",
                merged_file,
                e,
            )
            unique_count = 0
            with open(merged_file, "r", encoding="utf-8") as file_obj:
                for _ in file_obj:
                    unique_count += 1

        if unique_count == 0:
            raise RuntimeError("未找到任何有效 URL")

        file_size = merged_file.stat().st_size

        logger.info(
            "✓ 合并去重完成 - 去重后: %d 个 URL, 文件大小: %.2f KB",
            unique_count,
            file_size / 1024,
        )

        return str(merged_file)

    except subprocess.TimeoutExpired:
        error_msg = "合并去重超时（>60分钟），请检查数据量或系统资源"
        logger.warning(error_msg)  # 超时是可预期的
        raise RuntimeError(error_msg)

    except subprocess.CalledProcessError as e:
        error_msg = f"系统命令执行失败: {e.stderr if e.stderr else str(e)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from e

    except IOError as e:
        error_msg = f"文件读写失败: {e}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from e

    except Exception as e:
        error_msg = f"合并去重失败: {e}"
        logger.error(error_msg, exc_info=True)
        raise
