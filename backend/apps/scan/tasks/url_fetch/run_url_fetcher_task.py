"""
执行 URL 获取工具任务

负责运行单个 URL 获取工具（waymore、katana 等）。

注意：
- 输入文件（domains_file 或 sites_file）和命令的构建在 Flow 层完成
- 任务内部只负责执行已经构建好的命令并校验 / 统计结果
"""

import logging
from pathlib import Path
from prefect import task
from apps.scan.utils import execute_and_wait

logger = logging.getLogger(__name__)


@task(
    name='run_url_fetcher',
    retries=0,  # 不重试，工具本身会处理
    log_prints=True
)
def run_url_fetcher_task(
    tool_name: str,
    command: str,
    timeout: int,
    output_file: str
) -> dict:
    """
    执行单个 URL 获取工具
    
    Args:
        tool_name: 工具名称
        command: 完整的命令字符串（由 Flow 层使用命令构建器生成）
        timeout: 命令执行超时时间（秒）
        output_file: 输出文件完整路径
        
    Returns:
        dict: {
            'tool': str,  # 工具名称
            'output_file': str,  # 输出文件路径
            'url_count': int,  # 发现的 URL 数量
            'target_count': int,  # 处理的目标数量（占位，始终为 1）
            'success': bool
        }
    """
    output_file_path = Path(output_file)
    log_file = str(output_file_path.with_suffix('.log'))

    try:
        logger.info("开始执行 URL 获取工具 %s", tool_name)

        # 使用通用命令执行器
        result = execute_and_wait(
            tool_name=tool_name,
            command=command,
            timeout=timeout,
            log_file=log_file
        )

        # 验证输出文件是否生成
        if not output_file_path.exists():
            logger.warning(
                "URL 获取工具 %s 未生成结果文件: %s (returncode: %d)",
                tool_name, str(output_file_path), result['returncode']
            )
            return {
                'tool': tool_name,
                'output_file': output_file,
                'url_count': 0,
                'target_count': 0,
                'success': False
            }

        # 检查文件大小
        file_size = output_file_path.stat().st_size
        if file_size == 0:
            logger.warning("URL 获取工具 %s 生成的结果文件为空: %s", tool_name, output_file_path)
            return {
                'tool': tool_name,
                'output_file': output_file,
                'url_count': 0,
                'target_count': 0,
                'success': False
            }

        # 统计 URL 数量（不在此处去重，全局去重交由 merge_and_deduplicate_urls_task 处理）
        final_count = 0
        with open(output_file, 'r') as f:
            final_count = sum(1 for line in f if line.strip())

        logger.info(
            "✓ URL 获取工具 %s 完成 - 结果文件: %s (URL 数量: %d)",
            tool_name, str(output_file_path), final_count
        )

        return {
            'tool': tool_name,
            'output_file': output_file,
            'url_count': final_count,
            'target_count': 1,
            'success': final_count > 0
        }

    except RuntimeError:
        # 直接向上抛出（execute_and_wait 已记录详细日志）
        raise
    except Exception as e:
        error_msg = f"URL 获取工具 {tool_name} 执行异常: {e}"
        logger.error(error_msg, exc_info=True)
        raise
