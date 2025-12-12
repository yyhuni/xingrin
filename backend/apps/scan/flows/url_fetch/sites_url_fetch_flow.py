"""
URL 爬虫 Flow

主动爬取网站页面，提取 URL 和 JS 端点
工具：katana, gospider, hakrawler 等
输入：sites_file（站点 URL 列表）
"""

# Django 环境初始化
from apps.common.prefect_django_setup import setup_django_for_prefect

import logging
from pathlib import Path

from prefect import flow

from .utils import run_tools_parallel

logger = logging.getLogger(__name__)


def _export_sites_file(target_id: int, scan_id: int, output_dir: Path) -> tuple[str, int]:
    """
    导出站点 URL 列表到文件
    
    Args:
        target_id: 目标 ID
        scan_id: 扫描 ID
        output_dir: 输出目录
        
    Returns:
        tuple: (file_path, count)
    """
    from apps.scan.tasks.url_fetch import export_target_assets_task
    
    output_file = str(output_dir / "sites.txt")
    result = export_target_assets_task(
        output_file=output_file,
        target_id=target_id,
        scan_id=scan_id,
        input_type="sites_file"
    )
    
    count = result['asset_count']
    if count == 0:
        logger.warning("站点列表为空，爬虫可能无法正常工作")
    else:
        logger.info("✓ 站点列表导出完成 - 数量: %d", count)
    
    return output_file, count


@flow(name="sites_url_fetch_flow", log_prints=True)
def sites_url_fetch_flow(
    scan_id: int,
    target_id: int,
    target_name: str,
    output_dir: str,
    enabled_tools: dict
) -> dict:
    """
    URL 爬虫子 Flow
    
    执行流程：
    1. 导出站点 URL 列表（sites_file）
    2. 并行执行爬虫工具
    3. 返回结果文件列表
    
    Args:
        scan_id: 扫描 ID
        target_id: 目标 ID
        target_name: 目标名称
        output_dir: 输出目录
        enabled_tools: 启用的爬虫工具配置
        
    Returns:
        dict: {
            'success': bool,
            'result_files': list,
            'failed_tools': list,
            'successful_tools': list,
            'sites_count': int
        }
    """
    try:
        output_path = Path(output_dir)
        
        logger.info(
            "开始 URL 爬虫 - Target: %s, Tools: %s",
            target_name, ', '.join(enabled_tools.keys())
        )
        
        # Step 1: 导出站点 URL 列表
        sites_file, sites_count = _export_sites_file(
            target_id=target_id,
            scan_id=scan_id,
            output_dir=output_path
        )
        
        if sites_count == 0:
            logger.warning("没有可用的站点，跳过爬虫")
            return {
                'success': True,
                'result_files': [],
                'failed_tools': [],
                'successful_tools': [],
                'sites_count': 0
            }
        
        # Step 2: 并行执行爬虫工具
        result_files, failed_tools, successful_tools = run_tools_parallel(
            tools=enabled_tools,
            input_file=sites_file,
            input_type="sites_file",
            output_dir=output_path
        )
        
        logger.info(
            "✓ 爬虫完成 - 成功: %d/%d, 结果文件: %d",
            len(successful_tools), len(enabled_tools), len(result_files)
        )
        
        return {
            'success': True,
            'result_files': result_files,
            'failed_tools': failed_tools,
            'successful_tools': successful_tools,
            'sites_count': sites_count
        }
        
    except Exception as e:
        logger.error("URL 爬虫失败: %s", e, exc_info=True)
        return {
            'success': False,
            'result_files': [],
            'failed_tools': [{'tool': 'sites_url_fetch_flow', 'reason': str(e)}],
            'successful_tools': [],
            'sites_count': 0
        }
