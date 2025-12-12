"""
URL 被动收集 Flow

从历史归档、搜索引擎等被动来源收集 URL
工具：waymore, gau, waybackurls 等
输入：domains_file（子域名列表）
"""

# Django 环境初始化
from apps.common.prefect_django_setup import setup_django_for_prefect

import logging
from pathlib import Path

from prefect import flow

from .utils import run_tools_parallel

logger = logging.getLogger(__name__)


def _export_domains_file(target_id: int, scan_id: int, output_dir: Path) -> tuple[str, int]:
    """
    导出子域名列表到文件
    
    Args:
        target_id: 目标 ID
        scan_id: 扫描 ID
        output_dir: 输出目录
        
    Returns:
        tuple: (file_path, count)
    """
    from apps.scan.tasks.url_fetch import export_target_assets_task
    
    output_file = str(output_dir / "domains.txt")
    result = export_target_assets_task(
        output_file=output_file,
        target_id=target_id,
        scan_id=scan_id,
        input_type="domains_file"
    )
    
    count = result['asset_count']
    if count == 0:
        logger.warning("子域名列表为空，被动收集可能无法正常工作")
    else:
        logger.info("✓ 子域名列表导出完成 - 数量: %d", count)
    
    return output_file, count


@flow(name="domains_url_fetch_flow", log_prints=True)
def domains_url_fetch_flow(
    scan_id: int,
    target_id: int,
    target_name: str,
    output_dir: str,
    enabled_tools: dict
) -> dict:
    """
    URL 被动收集子 Flow
    
    执行流程：
    1. 导出子域名列表（domains_file）
    2. 并行执行被动收集工具
    3. 返回结果文件列表
    
    Args:
        scan_id: 扫描 ID
        target_id: 目标 ID
        target_name: 目标名称
        output_dir: 输出目录
        enabled_tools: 启用的被动收集工具配置
        
    Returns:
        dict: {
            'success': bool,
            'result_files': list,
            'failed_tools': list,
            'successful_tools': list,
            'domains_count': int
        }
    """
    try:
        output_path = Path(output_dir)
        
        logger.info(
            "开始 URL 被动收集 - Target: %s, Tools: %s",
            target_name, ', '.join(enabled_tools.keys())
        )
        
        # Step 1: 导出子域名列表
        domains_file, domains_count = _export_domains_file(
            target_id=target_id,
            scan_id=scan_id,
            output_dir=output_path
        )
        
        if domains_count == 0:
            logger.warning("没有可用的子域名，跳过被动收集")
            return {
                'success': True,
                'result_files': [],
                'failed_tools': [],
                'successful_tools': [],
                'domains_count': 0
            }
        
        # Step 2: 并行执行被动收集工具
        result_files, failed_tools, successful_tools = run_tools_parallel(
            tools=enabled_tools,
            input_file=domains_file,
            input_type="domains_file",
            output_dir=output_path
        )
        
        logger.info(
            "✓ 被动收集完成 - 成功: %d/%d, 结果文件: %d",
            len(successful_tools), len(enabled_tools), len(result_files)
        )
        
        return {
            'success': True,
            'result_files': result_files,
            'failed_tools': failed_tools,
            'successful_tools': successful_tools,
            'domains_count': domains_count
        }
        
    except Exception as e:
        logger.error("URL 被动收集失败: %s", e, exc_info=True)
        return {
            'success': False,
            'result_files': [],
            'failed_tools': [{'tool': 'domains_url_fetch_flow', 'reason': str(e)}],
            'successful_tools': [],
            'domains_count': 0
        }
