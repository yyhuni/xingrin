"""
扫描模块工具包

提供扫描相关的工具函数。
"""

from .directory_cleanup import remove_directory
from .command_builder import build_scan_command
from .command_executor import execute_and_wait, execute_stream
from .wordlist_helpers import ensure_wordlist_local
from .nuclei_helpers import ensure_nuclei_templates_local
from . import config_parser

__all__ = [
    # 目录清理
    'remove_directory',
    # 命令构建
    'build_scan_command',    # 扫描工具命令构建（基于 f-string）
    # 命令执行
    'execute_and_wait',      # 等待式执行（文件输出）
    'execute_stream',        # 流式执行（实时处理）
    # 字典文件
    'ensure_wordlist_local', # 确保本地字典文件（含 hash 校验）
    # Nuclei 模板
    'ensure_nuclei_templates_local',  # 确保本地模板（含 commit hash 校验）
    # 配置解析
    'config_parser',
]

