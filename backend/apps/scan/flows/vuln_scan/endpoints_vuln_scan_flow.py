from apps.common.prefect_django_setup import setup_django_for_prefect

import logging
from datetime import datetime
from pathlib import Path
from typing import Dict

from prefect import flow

from apps.scan.handlers.scan_flow_handlers import (
    on_scan_flow_running,
    on_scan_flow_completed,
    on_scan_flow_failed,
)
from apps.scan.utils import build_scan_command, ensure_nuclei_templates_local
from apps.scan.tasks.vuln_scan import (
    export_endpoints_task,
    run_vuln_tool_task,
    run_and_stream_save_dalfox_vulns_task,
    run_and_stream_save_nuclei_vulns_task,
)
from .utils import calculate_timeout_by_line_count


logger = logging.getLogger(__name__)


def _setup_vuln_scan_directory(scan_workspace_dir: str) -> Path:
    vuln_scan_dir = Path(scan_workspace_dir) / "vuln_scan"
    vuln_scan_dir.mkdir(parents=True, exist_ok=True)
    return vuln_scan_dir


@flow(
    name="endpoints_vuln_scan_flow",
    log_prints=True,
)
def endpoints_vuln_scan_flow(
    scan_id: int,
    target_name: str,
    target_id: int,
    scan_workspace_dir: str,
    enabled_tools: Dict[str, dict],
) -> dict:
    """基于 Endpoint 的漏洞扫描 Flow（串行执行 Dalfox 等工具）。"""
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

        vuln_scan_dir = _setup_vuln_scan_directory(scan_workspace_dir)
        endpoints_file = vuln_scan_dir / "input_endpoints.txt"

        # Step 1: 导出 Endpoint URL
        export_result = export_endpoints_task(
            target_id=target_id,
            output_file=str(endpoints_file),
            target_name=target_name,  # 传入 target_name 用于生成默认端点
        )
        total_endpoints = export_result.get("total_count", 0)

        if total_endpoints == 0 or not endpoints_file.exists() or endpoints_file.stat().st_size == 0:
            logger.warning("目标下没有可用 Endpoint，跳过漏洞扫描")
            return {
                "success": True,
                "scan_id": scan_id,
                "target": target_name,
                "scan_workspace_dir": scan_workspace_dir,
                "endpoints_file": str(endpoints_file),
                "endpoint_count": 0,
                "executed_tools": [],
                "tool_results": {},
            }

        logger.info("Endpoint 导出完成，共 %d 条，开始执行漏洞扫描", total_endpoints)

        tool_results: Dict[str, dict] = {}

        # Step 2: 并行执行每个漏洞扫描工具（目前主要是 Dalfox）
        # 1）先为每个工具 submit Prefect Task，让 Worker 并行调度
        # 2）再统一收集各自的结果，组装成 tool_results
        tool_futures: Dict[str, dict] = {}

        for tool_name, tool_config in enabled_tools.items():
            # Nuclei 需要先确保本地模板存在（支持多个模板仓库）
            template_args = ""
            if tool_name == "nuclei":
                repo_names = tool_config.get("template_repo_names")
                if not repo_names or not isinstance(repo_names, (list, tuple)):
                    logger.error("Nuclei 配置缺少 template_repo_names（数组），跳过")
                    continue
                template_paths = []
                try:
                    for repo_name in repo_names:
                        path = ensure_nuclei_templates_local(repo_name)
                        template_paths.append(path)
                        logger.info("Nuclei 模板路径 [%s]: %s", repo_name, path)
                except Exception as e:
                    logger.error("获取 Nuclei 模板失败: %s，跳过 nuclei 扫描", e)
                    continue
                template_args = " ".join(f"-t {p}" for p in template_paths)

            # 构建命令参数
            command_params = {"endpoints_file": str(endpoints_file)}
            if template_args:
                command_params["template_args"] = template_args

            command = build_scan_command(
                tool_name=tool_name,
                scan_type="vuln_scan",
                command_params=command_params,
                tool_config=tool_config,
            )

            raw_timeout = tool_config.get("timeout", 600)
            timeout = 600
            min_timeout = 600  # 最小超时时间：10 分钟

            if isinstance(raw_timeout, str) and raw_timeout == "auto":
                # timeout=auto 时，根据 endpoints_file 行数自动计算超时时间
                # Dalfox: 每行 100 秒，Nuclei: 每行 30 秒
                base_per_time = 30 if tool_name == "nuclei" else 100
                timeout = calculate_timeout_by_line_count(
                    tool_config=tool_config,
                    file_path=str(endpoints_file),
                    base_per_time=base_per_time,
                )
                # 确保不低于最小超时时间
                timeout = max(timeout, min_timeout)
            else:
                try:
                    timeout = int(raw_timeout)
                    # 确保不低于最小超时时间
                    timeout = max(timeout, min_timeout)
                except (TypeError, ValueError) as e:
                    # 配置错误应当直接暴露，避免默默使用默认值导致排查困难
                    raise ValueError(
                        f"工具 {tool_name} 的 timeout 配置无效: {raw_timeout!r}"
                    ) from e

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_file = vuln_scan_dir / f"{tool_name}_{timestamp}.log"

            # Dalfox XSS 使用流式任务，一边解析一边保存漏洞结果
            if tool_name == "dalfox_xss":
                logger.info("开始执行漏洞扫描工具 %s（流式保存漏洞结果，已提交任务）", tool_name)
                future = run_and_stream_save_dalfox_vulns_task.submit(
                    cmd=command,
                    tool_name=tool_name,
                    scan_id=scan_id,
                    target_id=target_id,
                    cwd=str(vuln_scan_dir),
                    shell=True,
                    batch_size=1,
                    timeout=timeout,
                    log_file=str(log_file),
                )

                tool_futures[tool_name] = {
                    "future": future,
                    "command": command,
                    "timeout": timeout,
                    "log_file": str(log_file),
                    "mode": "streaming",
                }
            elif tool_name == "nuclei":
                # Nuclei 使用流式任务
                logger.info("开始执行漏洞扫描工具 %s（流式保存漏洞结果，已提交任务）", tool_name)
                future = run_and_stream_save_nuclei_vulns_task.submit(
                    cmd=command,
                    tool_name=tool_name,
                    scan_id=scan_id,
                    target_id=target_id,
                    cwd=str(vuln_scan_dir),
                    shell=True,
                    batch_size=10,
                    timeout=timeout,
                    log_file=str(log_file),
                )

                tool_futures[tool_name] = {
                    "future": future,
                    "command": command,
                    "timeout": timeout,
                    "log_file": str(log_file),
                    "mode": "streaming",
                }
            else:
                # 其他工具仍使用非流式执行逻辑
                logger.info("开始执行漏洞扫描工具 %s（已提交任务）", tool_name)
                future = run_vuln_tool_task.submit(
                    tool_name=tool_name,
                    command=command,
                    timeout=timeout,
                    log_file=str(log_file),
                )

                tool_futures[tool_name] = {
                    "future": future,
                    "command": command,
                    "timeout": timeout,
                    "log_file": str(log_file),
                    "mode": "normal",
                }

        # 统一收集所有工具的执行结果
        for tool_name, meta in tool_futures.items():
            future = meta["future"]
            result = future.result()

            if meta["mode"] == "streaming":
                tool_results[tool_name] = {
                    "command": meta["command"],
                    "timeout": meta["timeout"],
                    "processed_records": result.get("processed_records"),
                    "created_vulns": result.get("created_vulns"),
                    "command_log_file": meta["log_file"],
                }
            else:
                tool_results[tool_name] = {
                    "command": meta["command"],
                    "timeout": meta["timeout"],
                    "duration": result.get("duration"),
                    "returncode": result.get("returncode"),
                    "command_log_file": result.get("command_log_file"),
                }

        return {
            "success": True,
            "scan_id": scan_id,
            "target": target_name,
            "scan_workspace_dir": scan_workspace_dir,
            "endpoints_file": str(endpoints_file),
            "endpoint_count": total_endpoints,
            "executed_tools": list(enabled_tools.keys()),
            "tool_results": tool_results,
        }

    except Exception as e:
        logger.exception("Endpoint 漏洞扫描失败: %s", e)
        raise
