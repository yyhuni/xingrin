from apps.common.prefect_django_setup import setup_django_for_prefect

import logging
from typing import Dict, Tuple

from prefect import flow

from apps.scan.handlers.scan_flow_handlers import (
    on_scan_flow_running,
    on_scan_flow_completed,
    on_scan_flow_failed,
)
from apps.scan.configs.command_templates import get_command_template
from .endpoints_vuln_scan_flow import endpoints_vuln_scan_flow


logger = logging.getLogger(__name__)


def _classify_vuln_tools(enabled_tools: Dict[str, dict]) -> Tuple[Dict[str, dict], Dict[str, dict]]:
    """根据命令模板中的 input_type 对漏洞扫描工具进行分类。

    当前支持：
    - endpoints_file: 以端点列表文件为输入（例如 Dalfox XSS）
    预留：
    - 其他 input_type 将被归类到 other_tools，暂不处理。
    """
    endpoints_tools: Dict[str, dict] = {}
    other_tools: Dict[str, dict] = {}

    for tool_name, tool_config in enabled_tools.items():
        template = get_command_template("vuln_scan", tool_name) or {}
        input_type = template.get("input_type", "endpoints_file")

        if input_type == "endpoints_file":
            endpoints_tools[tool_name] = tool_config
        else:
            other_tools[tool_name] = tool_config

    return endpoints_tools, other_tools


@flow(
    name="vuln_scan",
    log_prints=True,
    on_running=[on_scan_flow_running],
    on_completion=[on_scan_flow_completed],
    on_failure=[on_scan_flow_failed],
)
def vuln_scan_flow(
    scan_id: int,
    target_name: str,
    target_id: int,
    scan_workspace_dir: str,
    enabled_tools: Dict[str, dict],
) -> dict:
    """漏洞扫描主 Flow：串行编排各类漏洞扫描子 Flow。

    支持工具：
    - dalfox_xss: XSS 漏洞扫描（流式保存）
    - nuclei: 通用漏洞扫描（流式保存，支持模板 commit hash 同步）
    """
    try:
        if scan_id is None:
            raise ValueError("scan_id 不能为空")
        if not target_name:
            raise ValueError("target_name 不能为空")
        if target_id is None:
            raise ValueError("target_id 不能为空")
        if not scan_workspace_dir:
            raise ValueError("scan_workspace_dir 不能为空")
        if not enabled_tools:
            raise ValueError("enabled_tools 不能为空")

        # Step 1: 分类工具
        endpoints_tools, other_tools = _classify_vuln_tools(enabled_tools)

        logger.info(
            "漏洞扫描工具分类 - endpoints_file: %s, 其他: %s",
            list(endpoints_tools.keys()) or "无",
            list(other_tools.keys()) or "无",
        )

        if other_tools:
            logger.warning(
                "存在暂不支持输入类型的漏洞扫描工具，将被忽略: %s",
                list(other_tools.keys()),
            )

        if not endpoints_tools:
            raise ValueError("漏洞扫描需要至少启用一个以 endpoints_file 为输入的工具（如 dalfox_xss、nuclei）。")

        # Step 2: 执行 Endpoint 漏洞扫描子 Flow（串行）
        endpoint_result = endpoints_vuln_scan_flow(
            scan_id=scan_id,
            target_name=target_name,
            target_id=target_id,
            scan_workspace_dir=scan_workspace_dir,
            enabled_tools=endpoints_tools,
        )

        # 目前只有一个子 Flow，直接返回其结果
        return endpoint_result

    except Exception as e:
        logger.exception("漏洞扫描主 Flow 失败: %s", e)
        raise
