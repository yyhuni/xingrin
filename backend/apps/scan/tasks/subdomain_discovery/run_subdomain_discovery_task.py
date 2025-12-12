"""
运行扫描工具任务

负责运行单个子域名扫描工具（amass、subfinder 等）
"""

import logging
from pathlib import Path
from prefect import task
from apps.scan.utils import execute_and_wait

logger = logging.getLogger(__name__)


@task(
    name='run_subdomain_discovery',
    retries=0,  # 显式禁用重试
    log_prints=True
)
def run_subdomain_discovery_task(
    tool: str,
    command: str,
    timeout: int,
    output_file: str
) -> str:
    """
    运行单个子域名发现工具
    
    Args:
        tool: 子域名发现工具名称（用于日志）
        command: 完整的扫描命令（已由 Flow 层使用命令构建器生成）
        timeout: 命令执行超时时间（秒）
        output_file: 输出文件完整路径（由 Flow 层生成，包含目录和文件名）
    
    Returns:
        str: 结果文件路径
    
    Raises:
        ValueError: 参数验证失败
        RuntimeError: 扫描执行失败
    
    Note:
        - 扫描结果通过工具的 -o 参数写入结果文件
        - 使用通用的 run_scan_command 函数执行扫描
        - 日志文件统一随 workspace 管理，默认保留 7 天自动清理
        - 文件命名格式：{tool}_{timestamp}_{uuid4}.txt
        - 示例：subfinder_20250116_142200_a3f2.txt, subfinder_20250116_142200_a3f2.log
    """
    # 准备路径
    output_file_path = Path(output_file)
    log_file = str(output_file_path.with_suffix('.log'))
    
    # 使用通用的扫描命令执行器
    try:
        result = execute_and_wait(
            tool_name=tool,
            command=command,
            timeout=timeout,
            log_file=log_file  # 明确指定日志文件路径
        )
        
        # 验证输出文件是否生成
        if not output_file_path.exists():
            logger.warning(
                "扫描工具 %s 未生成结果文件: %s (returncode: %d)",
                tool, str(output_file_path), result['returncode']  # 强制转换为字符串
            )
            return ""
        
        # 检查文件大小
        file_size = output_file_path.stat().st_size
        if file_size == 0:
            logger.warning("扫描工具 %s 生成的结果文件为空: %s", tool, output_file_path)
            return ""  # 空文件视为无效结果，与未生成文件的行为一致
        
        logger.info(
            "✓ 扫描完成: %s - 结果文件: %s (%.2f KB)",
            tool, str(output_file_path), file_size / 1024  # 使用绝对路径
        )
        
        # 返回结果文件路径
        return str(output_file_path)
        
    except RuntimeError:
        # 直接向上抛出（已在 execute_and_wait 中记录日志）
        raise
    except Exception as e:
        error_msg = f"扫描工具 {tool} 执行异常: {e}"
        logger.error(error_msg, exc_info=True)
        raise
