"""
扫描任务模块

包含：
- Prefect Tasks: 具体操作的执行单元

架构说明：
- Flow（flows/）编排 Tasks（tasks/）
- Tasks 负责具体操作，Flow 负责编排
"""

# Prefect Tasks
from .workspace_tasks import create_scan_workspace_task

# 子域名发现任务（已重构为多个子任务）
from .subdomain_discovery import (
    run_subdomain_discovery_task,
    merge_and_validate_task,
    save_domains_task,
)

# 注意：
# - subdomain_discovery_task 已重构为多个子任务（subdomain_discovery/）
# - finalize_scan_task 已废弃（Handler 统一管理状态）
# - initiate_scan_task 已迁移到 flows/initiate_scan_flow.py
# - cleanup_old_scans_task 已迁移到 flows（cleanup_old_scans_flow）

__all__ = [
    # Prefect Tasks
    'create_scan_workspace_task',
    # 子域名发现任务
    'run_subdomain_discovery_task',
    'merge_and_validate_task',
    'save_domains_task',
]
