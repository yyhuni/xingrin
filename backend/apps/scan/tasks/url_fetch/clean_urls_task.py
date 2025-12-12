"""
URL 清理任务

使用 uro 工具清理合并后的 URL 列表：
- 去除重复和相似的 URL
- 根据扩展名过滤（whitelist/blacklist）
- 智能过滤无效 URL
"""

import logging
import subprocess
from pathlib import Path
from datetime import datetime
from prefect import task
from typing import Optional

from apps.scan.utils import execute_and_wait

logger = logging.getLogger(__name__)


@task(
    name='clean_urls_with_uro',
    retries=1,
    log_prints=True
)
def clean_urls_task(
    input_file: str,
    output_dir: str,
    timeout: int = 60,
    whitelist: Optional[list] = None,
    blacklist: Optional[list] = None,
    filters: Optional[list] = None
) -> dict:
    """
    使用 uro 清理 URL 列表
    
    Args:
        input_file: 输入的 URL 文件路径
        output_dir: 输出目录
        timeout: 超时时间（秒）
        whitelist: 只保留指定扩展名的 URL
        blacklist: 排除指定扩展名的 URL
        filters: 额外的过滤规则
        
    Returns:
        dict: {
            'success': bool,
            'output_file': str,
            'input_count': int,
            'output_count': int,
            'removed_count': int
        }
    """
    input_path = Path(input_file)
    output_path = Path(output_dir)
    
    # 1. 验证输入文件
    if not input_path.exists():
        logger.error("输入文件不存在: %s", input_file)
        return {
            'success': False,
            'output_file': input_file,
            'input_count': 0,
            'output_count': 0,
            'removed_count': 0,
            'error': '输入文件不存在'
        }
    
    # 2. 统计输入 URL 数量
    try:
        result = subprocess.run(
            ['wc', '-l', str(input_path)],
            capture_output=True,
            text=True,
            check=True
        )
        input_count = int(result.stdout.strip().split()[0])
    except Exception as e:
        logger.warning("统计输入文件行数失败: %s", e)
        input_count = 0
        with open(input_path, 'r') as f:
            input_count = sum(1 for line in f if line.strip())
    
    if input_count == 0:
        logger.warning("输入文件为空，跳过 uro 清理")
        return {
            'success': True,
            'output_file': input_file,
            'input_count': 0,
            'output_count': 0,
            'removed_count': 0
        }
    
    logger.info("开始 uro 清理 - 输入 URL 数: %d", input_count)
    
    # 3. 生成输出文件路径
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = output_path / f"urls_cleaned_{timestamp}.txt"
    
    # 4. 构建 uro 命令
    cmd_parts = ['uro', '-i', str(input_path), '-o', str(output_file)]
    
    if whitelist:
        cmd_parts.extend(['-w'] + [str(w) for w in whitelist])
    
    if blacklist:
        cmd_parts.extend(['-b'] + [str(b) for b in blacklist])
    
    if filters:
        cmd_parts.extend(['-f'] + [str(f) for f in filters])
    
    # 5. 构建命令字符串
    command = ' '.join(cmd_parts)
    log_file = str(output_path / f"uro_{timestamp}.log")
    
    logger.debug("uro 命令: %s", command)
    
    # 6. 使用 execute_and_wait 执行（会自动发送通知）
    try:
        result = execute_and_wait(
            tool_name='uro',
            command=command,
            timeout=timeout,
            log_file=log_file
        )
        
        if result['returncode'] != 0:
            logger.warning(
                "uro 返回非零状态码: %d",
                result['returncode']
            )
            # uro 可能正常完成但返回非零，检查输出文件
            if not output_file.exists():
                return {
                    'success': False,
                    'output_file': input_file,
                    'input_count': input_count,
                    'output_count': input_count,
                    'removed_count': 0,
                    'error': f'uro 执行失败 (returncode: {result["returncode"]})'
                }
                
    except RuntimeError as e:
        # execute_and_wait 超时或执行失败会抛出 RuntimeError
        logger.error("uro 执行失败: %s", e)
        return {
            'success': False,
            'output_file': input_file,
            'input_count': input_count,
            'output_count': input_count,
            'removed_count': 0,
            'error': str(e)
        }
    except Exception as e:
        logger.error("uro 执行异常: %s", e)
        return {
            'success': False,
            'output_file': input_file,
            'input_count': input_count,
            'output_count': input_count,
            'removed_count': 0,
            'error': str(e)
        }
    
    # 7. 统计清理后的 URL 数量
    output_count = 0
    if output_file.exists():
        try:
            result = subprocess.run(
                ['wc', '-l', str(output_file)],
                capture_output=True,
                text=True,
                check=True
            )
            output_count = int(result.stdout.strip().split()[0])
        except Exception:
            with open(output_file, 'r') as f:
                output_count = sum(1 for line in f if line.strip())
    else:
        logger.warning("uro 未生成输出文件，使用原始文件")
        return {
            'success': False,
            'output_file': input_file,
            'input_count': input_count,
            'output_count': input_count,
            'removed_count': 0,
            'error': '未生成输出文件'
        }
    
    removed_count = input_count - output_count
    
    logger.info(
        "✓ uro 清理完成 - 输入: %d, 输出: %d, 移除: %d (%.1f%%)",
        input_count, output_count, removed_count,
        (removed_count / input_count * 100) if input_count > 0 else 0
    )
    
    return {
        'success': True,
        'output_file': str(output_file),
        'input_count': input_count,
        'output_count': output_count,
        'removed_count': removed_count
    }
