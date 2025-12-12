"""执行漏洞扫描工具任务

负责运行单个漏洞扫描工具（目前主要是 Dalfox XSS）。

注意：
- 命令构建在 Flow 层完成，这里只负责执行已经构建好的命令
- 使用通用 execute_and_wait 统一管理超时和日志
"""

import logging
from typing import Dict

from prefect import task

from apps.scan.utils import execute_and_wait

logger = logging.getLogger(__name__)


@task(
    name="run_vuln_tool",
    retries=0,
    log_prints=True,
)
def run_vuln_tool_task(
    tool_name: str,
    command: str,
    timeout: int,
    log_file: str | None = None,
) -> Dict[str, object]:
    """执行单个漏洞扫描工具。

    Args:
        tool_name: 工具名称（如 "dalfox_xss"）
        command: 完整命令字符串（由 Flow 层构建）
        timeout: 命令执行超时时间（秒）
        log_file: 日志文件路径

    Returns:
        dict: execute_and_wait 的返回结果字典，并附加 tool 字段。
    """
    try:
        logger.info("开始执行漏洞扫描工具 %s", tool_name)

        result = execute_and_wait(
            tool_name=tool_name,
            command=command,
            timeout=timeout,
            log_file=log_file,
        )

        # 保持与 execute_and_wait 一致的字段，并额外附加工具名
        return {
            "tool": tool_name,
            **result,
        }

    except RuntimeError:
        # execute_and_wait 已经记录详细日志，这里直接向上抛出
        raise
    except Exception as e:
        error_msg = f"漏洞扫描工具 {tool_name} 执行异常: {e}"
        logger.error(error_msg, exc_info=True)
        raise
