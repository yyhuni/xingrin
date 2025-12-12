"""Prefect Flow 状态处理器

当前架构使用 Docker + SSH 执行任务，不使用 Prefect Server。
docker stop 会触发 on_failure 处理器。
"""

from .initiate_scan_flow_handlers import (
    on_initiate_scan_flow_running,
    on_initiate_scan_flow_completed,
    on_initiate_scan_flow_failed,
)

from .scan_flow_handlers import (
    on_scan_flow_running,
    on_scan_flow_completed,
    on_scan_flow_failed,
)

__all__ = [
    # 初始化扫描流程处理器
    'on_initiate_scan_flow_running',
    'on_initiate_scan_flow_completed',
    'on_initiate_scan_flow_failed',
    # 通用扫描流程处理器
    'on_scan_flow_running',
    'on_scan_flow_completed',
    'on_scan_flow_failed',
]
