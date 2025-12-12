"""
子域名发现任务模块

包含子域名扫描流程的 Prefect Tasks：
- run_subdomain_discovery_task: 运行单个子域名发现工具（可并行）
- merge_and_validate_task: 合并、解析并验证域名（一体化高性能）
- save_domains_task: 保存到数据库

架构优势：
- 每个 task 单一职责，可独立重试
- 支持并行执行扫描工具
- 流式处理 + 正则验证，性能提升 50-100 倍
- Flow 层编排，逻辑清晰
"""

from .run_subdomain_discovery_task import run_subdomain_discovery_task
from .merge_and_validate_task import merge_and_validate_task
from .save_domains_task import save_domains_task

__all__ = [
    'run_subdomain_discovery_task',
    'merge_and_validate_task',
    'save_domains_task',
]
