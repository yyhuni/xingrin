"""
URL Fetch 主 Flow

负责编排不同输入类型的 URL 获取子 Flow（domain_name / domains_file / sites_file），以及统一的后处理（uro 去重、httpx 验证）

架构：
- 调用 domain_name_url_fetch_flow（domain_name 输入）、domains_url_fetch_flow（domains_file 输入）和 sites_url_fetch_flow（sites_file 输入）
- 合并多个子 Flow 的结果
- 统一进行 uro 去重（如果启用）
- 统一进行 httpx 验证（如果启用）
"""

# Django 环境初始化
from apps.common.prefect_django_setup import setup_django_for_prefect

import logging
import os
from pathlib import Path
from datetime import datetime

from prefect import flow

from apps.scan.handlers.scan_flow_handlers import (
    on_scan_flow_running,
    on_scan_flow_completed,
    on_scan_flow_failed,
)

from .domain_name_url_fetch_flow import domain_name_url_fetch_flow
from .domains_url_fetch_flow import domains_url_fetch_flow
from .sites_url_fetch_flow import sites_url_fetch_flow
from .utils import calculate_timeout_by_line_count

logger = logging.getLogger(__name__)


# ==================== 工具分类配置 ====================
# 使用 target_name (domain_name) 作为输入的 URL 获取工具
DOMAIN_NAME_TOOLS = {'waymore'}
# 使用 domains_file 作为输入的 URL 获取工具
DOMAINS_FILE_TOOLS = {'gau', 'waybackurls'}
# 使用 sites_file 作为输入的 URL 获取工具
SITES_FILE_TOOLS = {'katana', 'gospider', 'hakrawler'}
# 后处理工具：不参与获取，用于清理和验证
POST_PROCESS_TOOLS = {'uro', 'httpx'}


def _setup_url_fetch_directory(scan_workspace_dir: str) -> Path:
    """创建并验证 URL 获取工作目录"""
    url_fetch_dir = Path(scan_workspace_dir) / 'url_fetch'
    url_fetch_dir.mkdir(parents=True, exist_ok=True)
    
    if not url_fetch_dir.is_dir():
        raise RuntimeError(f"URL 获取目录创建失败: {url_fetch_dir}")
    if not os.access(url_fetch_dir, os.W_OK):
        raise RuntimeError(f"URL 获取目录不可写: {url_fetch_dir}")
    
    return url_fetch_dir


def _classify_tools(enabled_tools: dict) -> tuple[dict, dict, dict, dict, dict]:
    """
    将启用的工具按输入类型分类
    
    Returns:
        tuple: (domain_name_tools, domains_file_tools, sites_file_tools, uro_config, httpx_config)
    """
    domain_name_tools: dict = {}
    domains_file_tools: dict = {}
    sites_file_tools: dict = {}
    uro_config = None
    httpx_config = None

    for tool_name, tool_config in enabled_tools.items():
        if tool_name in DOMAIN_NAME_TOOLS:
            domain_name_tools[tool_name] = tool_config
        elif tool_name in DOMAINS_FILE_TOOLS:
            domains_file_tools[tool_name] = tool_config
        elif tool_name in SITES_FILE_TOOLS:
            sites_file_tools[tool_name] = tool_config
        elif tool_name == 'uro':
            uro_config = tool_config
        elif tool_name == 'httpx':
            httpx_config = tool_config
        else:
            logger.warning("未知工具类型: %s，将尝试作为 domains_file 输入的被动收集工具", tool_name)
            domains_file_tools[tool_name] = tool_config

    return domain_name_tools, domains_file_tools, sites_file_tools, uro_config, httpx_config


def _merge_and_deduplicate_urls(result_files: list, url_fetch_dir: Path) -> tuple[str, int]:
    """合并并去重 URL"""
    from apps.scan.tasks.url_fetch import merge_and_deduplicate_urls_task
    
    merged_file = merge_and_deduplicate_urls_task(
        result_files=result_files,
        result_dir=str(url_fetch_dir)
    )
    
    # 统计唯一 URL 数量
    unique_url_count = 0
    if Path(merged_file).exists():
        with open(merged_file, 'r') as f:
            unique_url_count = sum(1 for line in f if line.strip())
    
    logger.info(
        "✓ URL 合并去重完成 - 合并文件: %s, 唯一 URL 数: %d",
        merged_file, unique_url_count
    )
    
    return merged_file, unique_url_count


def _clean_urls_with_uro(
    merged_file: str,
    uro_config: dict,
    url_fetch_dir: Path
) -> tuple[str, int, int]:
    """使用 uro 清理合并后的 URL 列表"""
    from apps.scan.tasks.url_fetch import clean_urls_task
    
    raw_timeout = uro_config.get('timeout', 60)
    whitelist = uro_config.get('whitelist')
    blacklist = uro_config.get('blacklist')
    filters = uro_config.get('filters')
    
    # 计算超时时间
    if isinstance(raw_timeout, str) and raw_timeout == 'auto':
        timeout = calculate_timeout_by_line_count(
            tool_config=uro_config,
            file_path=merged_file,
            base_per_time=1,
        )
        timeout = max(30, timeout)
        logger.info("uro 自动计算超时时间(按行数，每行 1 秒): %d 秒", timeout)
    else:
        try:
            timeout = int(raw_timeout)
        except (TypeError, ValueError):
            logger.warning("uro timeout 配置无效(%s)，使用默认 60 秒", raw_timeout)
            timeout = 60
    
    result = clean_urls_task(
        input_file=merged_file,
        output_dir=str(url_fetch_dir),
        timeout=timeout,
        whitelist=whitelist,
        blacklist=blacklist,
        filters=filters
    )
    
    if result['success']:
        return result['output_file'], result['output_count'], result['removed_count']
    else:
        logger.warning("uro 清理失败: %s，使用原始合并文件", result.get('error', '未知错误'))
        return merged_file, result['input_count'], 0


def _validate_and_stream_save_urls(
    merged_file: str,
    httpx_config: dict,
    url_fetch_dir: Path,
    scan_id: int,
    target_id: int
) -> int:
    """使用 httpx 验证 URL 存活并流式保存到数据库"""
    from apps.scan.utils import build_scan_command
    from apps.scan.tasks.url_fetch import run_and_stream_save_urls_task
    
    logger.info("开始使用 httpx 验证 URL 存活状态...")
    
    # 统计待验证的 URL 数量
    try:
        with open(merged_file, 'r') as f:
            url_count = sum(1 for _ in f)
        logger.info("待验证 URL 数量: %d", url_count)
    except Exception as e:
        logger.error("读取 URL 文件失败: %s", e)
        return 0
    
    if url_count == 0:
        logger.warning("没有需要验证的 URL")
        return 0
    
    # 构建 httpx 命令
    command_params = {'url_file': merged_file}
    
    try:
        command = build_scan_command(
            tool_name='httpx',
            scan_type='url_fetch',
            command_params=command_params,
            tool_config=httpx_config
        )
    except Exception as e:
        logger.error("构建 httpx 命令失败: %s", e)
        logger.warning("降级处理：将直接保存所有 URL（不验证存活）")
        return _save_urls_to_database(merged_file, scan_id, target_id)
    
    # 计算超时时间
    raw_timeout = httpx_config.get('timeout', 'auto')
    timeout = 3600
    if isinstance(raw_timeout, str) and raw_timeout == 'auto':
        # 按 URL 行数计算超时时间：每行 3 秒，不设上限
        timeout = url_count * 3
        timeout = max(600, timeout)
        logger.info(
            "自动计算 httpx 超时时间(按行数，每行 3 秒): url_count=%d, timeout=%d 秒",
            url_count,
            timeout,
        )
    else:
        try:
            timeout = int(raw_timeout)
        except (TypeError, ValueError):
            timeout = 3600
        logger.info("使用配置的 httpx 超时时间: %d 秒", timeout)
    
    # 生成日志文件路径
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = url_fetch_dir / f"httpx_validation_{timestamp}.log"
    
    # 流式执行
    try:
        result = run_and_stream_save_urls_task(
            cmd=command,
            tool_name='httpx',
            scan_id=scan_id,
            target_id=target_id,
            cwd=str(url_fetch_dir),
            shell=True,
            batch_size=500,
            timeout=timeout,
            log_file=str(log_file)
        )
        
        saved = result.get('saved_urls', 0)
        logger.info(
            "✓ httpx 验证完成 - 存活 URL: %d (%.1f%%)",
            saved, (saved / url_count * 100) if url_count > 0 else 0
        )
        return saved
        
    except Exception as e:
        logger.error("httpx 流式验证失败: %s", e, exc_info=True)
        raise


def _save_urls_to_database(merged_file: str, scan_id: int, target_id: int) -> int:
    """保存 URL 到数据库（不验证存活）"""
    from apps.scan.tasks.url_fetch import save_urls_task
    
    result = save_urls_task(
        urls_file=merged_file,
        scan_id=scan_id,
        target_id=target_id
    )
    
    saved_count = result.get('saved_urls', 0)
    logger.info("✓ URL 保存完成 - 保存数量: %d", saved_count)
    
    return saved_count


@flow(
    name="url_fetch",
    log_prints=True,
    on_running=[on_scan_flow_running],
    on_completion=[on_scan_flow_completed],
    on_failure=[on_scan_flow_failed],
)
def url_fetch_flow(
    scan_id: int,
    target_name: str,
    target_id: int,
    scan_workspace_dir: str,
    enabled_tools: dict
) -> dict:
    """
    URL 获取主 Flow
    
    执行流程：
    1. 准备工作目录
    2. 按输入类型分类工具（domain_name / domains_file / sites_file / 后处理）
    3. 并行执行子 Flow
       - domain_name_url_fetch_flow: 基于 domain_name（来自 target_name）执行 URL 获取（如 waymore）
       - domains_url_fetch_flow: 基于 domains_file 执行 URL 获取（如 gau、waybackurls）
       - sites_url_fetch_flow: 基于 sites_file 执行爬虫（如 katana 等）
    4. 合并所有子 Flow 的结果并去重
    5. uro 去重（如果启用）
    6. httpx 验证（如果启用）
    
    Args:
        scan_id: 扫描 ID
        target_name: 目标名称
        target_id: 目标 ID
        scan_workspace_dir: 扫描工作目录
        enabled_tools: 启用的工具配置
        
    Returns:
        dict: 扫描结果
    """
    try:
        logger.info(
            "="*60 + "\n" +
            "开始 URL 获取扫描\n" +
            f"  Scan ID: {scan_id}\n" +
            f"  Target: {target_name}\n" +
            f"  Workspace: {scan_workspace_dir}\n" +
            "="*60
        )
        
        # Step 1: 准备工作目录
        logger.info("Step 1: 准备工作目录")
        url_fetch_dir = _setup_url_fetch_directory(scan_workspace_dir)
        
        # Step 2: 分类工具（按输入类型）
        logger.info("Step 2: 分类工具")
        domain_name_tools, domains_file_tools, sites_file_tools, uro_config, httpx_config = _classify_tools(enabled_tools)

        logger.info(
            "工具分类 - domain_name: %s, domains_file: %s, sites_file: %s, uro: %s, httpx: %s",
            list(domain_name_tools.keys()) or '无',
            list(domains_file_tools.keys()) or '无',
            list(sites_file_tools.keys()) or '无',
            '启用' if uro_config else '未启用',
            '启用' if httpx_config else '未启用'
        )

        # 检查是否有获取工具
        if not domain_name_tools and not domains_file_tools and not sites_file_tools:
            raise ValueError(
                "URL Fetch 流程需要至少启用一个 URL 获取工具（如 waymore, katana）。"
                "httpx 和 uro 仅用于后处理，不能单独使用。"
            )
        
        # Step 3: 并行执行子 Flow
        all_result_files = []
        all_failed_tools = []
        all_successful_tools = []
        
        # 3a: 基于 domain_name（target_name） 的 URL 被动收集（如 waymore）
        if domain_name_tools:
            logger.info("Step 3a: 执行基于 domain_name 的 URL 被动收集子 Flow")
            tn_result = domain_name_url_fetch_flow(
                scan_id=scan_id,
                target_id=target_id,
                target_name=target_name,
                output_dir=str(url_fetch_dir),
                domain_name_tools=domain_name_tools,
            )
            all_result_files.extend(tn_result.get('result_files', []))
            all_failed_tools.extend(tn_result.get('failed_tools', []))
            all_successful_tools.extend(tn_result.get('successful_tools', []))

        # 3b: 基于 domains_file 的 URL 被动收集
        if domains_file_tools:
            logger.info("Step 3b: 执行基于 domains_file 的 URL 被动收集子 Flow")
            passive_result = domains_url_fetch_flow(
                scan_id=scan_id,
                target_id=target_id,
                target_name=target_name,
                output_dir=str(url_fetch_dir),
                enabled_tools=domains_file_tools,
            )
            all_result_files.extend(passive_result.get('result_files', []))
            all_failed_tools.extend(passive_result.get('failed_tools', []))
            all_successful_tools.extend(passive_result.get('successful_tools', []))
        
        # 3c: 爬虫（以 sites_file 为输入）
        if sites_file_tools:
            logger.info("Step 3c: 执行爬虫子 Flow")
            crawl_result = sites_url_fetch_flow(
                scan_id=scan_id,
                target_id=target_id,
                target_name=target_name,
                output_dir=str(url_fetch_dir),
                enabled_tools=sites_file_tools
            )
            all_result_files.extend(crawl_result.get('result_files', []))
            all_failed_tools.extend(crawl_result.get('failed_tools', []))
            all_successful_tools.extend(crawl_result.get('successful_tools', []))
        
        # 检查是否有成功的工具
        if not all_result_files:
            error_details = "; ".join([f"{f['tool']}: {f['reason']}" for f in all_failed_tools])
            logger.warning("所有 URL 获取工具均失败 - 目标: %s, 失败详情: %s", target_name, error_details)
            # 返回空结果，不抛出异常，让扫描继续
            return {
                'success': True,
                'scan_id': scan_id,
                'target': target_name,
                'unique_url_count': 0,
                'valid_url_count': 0,
                'failed_tools': all_failed_tools,
                'successful_tools': [],
                'message': '所有 URL 获取工具均无结果'
            }
        
        # Step 4: 合并并去重 URL
        logger.info("Step 4: 合并并去重 URL")
        merged_file, unique_url_count = _merge_and_deduplicate_urls(
            result_files=all_result_files,
            url_fetch_dir=url_fetch_dir
        )
        
        # Step 5: 使用 uro 清理 URL（如果启用）
        url_file_for_validation = merged_file
        uro_removed_count = 0
        
        if uro_config and uro_config.get('enabled', False):
            logger.info("Step 5: 使用 uro 清理 URL")
            url_file_for_validation, cleaned_count, uro_removed_count = _clean_urls_with_uro(
                merged_file=merged_file,
                uro_config=uro_config,
                url_fetch_dir=url_fetch_dir
            )
        else:
            logger.info("Step 5: 跳过 uro 清理（未启用）")
        
        # Step 6: 使用 httpx 验证存活并保存（如果启用）
        if httpx_config and httpx_config.get('enabled', False):
            logger.info("Step 6: 使用 httpx 验证 URL 存活并流式保存")
            saved_count = _validate_and_stream_save_urls(
                merged_file=url_file_for_validation,
                httpx_config=httpx_config,
                url_fetch_dir=url_fetch_dir,
                scan_id=scan_id,
                target_id=target_id
            )
        else:
            logger.info("Step 6: 保存到数据库（未启用 httpx 验证）")
            saved_count = _save_urls_to_database(
                merged_file=url_file_for_validation,
                scan_id=scan_id,
                target_id=target_id
            )
        
        logger.info("="*60 + "\n✓ URL 获取扫描完成\n" + "="*60)
        
        # 构建已执行的任务列表
        executed_tasks = ['setup_directory', 'classify_tools']
        if domain_name_tools:
            executed_tasks.append('domain_name_url_fetch_flow')
        if domains_file_tools:
            executed_tasks.append('domains_url_fetch_flow')
        if sites_file_tools:
            executed_tasks.append('sites_url_fetch_flow')
        executed_tasks.append('merge_and_deduplicate')
        if uro_config and uro_config.get('enabled', False):
            executed_tasks.append('uro_clean')
        if httpx_config and httpx_config.get('enabled', False):
            executed_tasks.append('httpx_validation_and_save')
        else:
            executed_tasks.append('save_urls')
        
        return {
            'success': True,
            'scan_id': scan_id,
            'target': target_name,
            'scan_workspace_dir': scan_workspace_dir,
            'total': saved_count,
            'executed_tasks': executed_tasks,
            'tool_stats': {
                'total': len(domain_name_tools) + len(domains_file_tools) + len(sites_file_tools),
                'successful': len(all_successful_tools),
                'failed': len(all_failed_tools),
                'successful_tools': all_successful_tools,
                'failed_tools': [f['tool'] for f in all_failed_tools]
            }
        }
        
    except Exception as e:
        logger.error("URL 获取扫描失败: %s", e, exc_info=True)
        raise
