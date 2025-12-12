
"""
站点扫描 Flow

负责编排站点扫描的完整流程

架构：
- Flow 负责编排多个原子 Task
- 支持串行执行扫描工具（流式处理）
- 每个 Task 可独立重试
- 配置由 YAML 解析
"""

# Django 环境初始化（导入即生效）
from apps.common.prefect_django_setup import setup_django_for_prefect

import logging
import os
import subprocess
from pathlib import Path
from typing import Callable
from prefect import flow
from apps.scan.tasks.site_scan import export_site_urls_task, run_and_stream_save_websites_task
from apps.scan.handlers.scan_flow_handlers import (
    on_scan_flow_running,
    on_scan_flow_completed,
    on_scan_flow_failed,
)
from apps.scan.utils import config_parser, build_scan_command

logger = logging.getLogger(__name__)


def calculate_timeout_by_line_count(
    tool_config: dict,
    file_path: str, 
    base_per_time: int = 1
) -> int:
    """
    根据文件行数计算 timeout
    
    使用 wc -l 统计文件行数，根据行数和每行基础时间计算 timeout
    
    Args:
        tool_config: 工具配置字典（此函数未使用，但保持接口一致性）
        file_path: 要统计行数的文件路径
        base_per_time: 每行的基础时间（秒），默认1秒
    
    Returns:
        int: 计算出的超时时间（秒）
    
    Example:
        timeout = calculate_timeout_by_line_count(
            tool_config={},
            file_path='/path/to/urls.txt', 
            base_per_time=2
        )
    """
    try:
        # 使用 wc -l 快速统计行数
        result = subprocess.run(
            ['wc', '-l', file_path],
            capture_output=True,
            text=True,
            check=True
        )
        # wc -l 输出格式：行数 + 空格 + 文件名
        line_count = int(result.stdout.strip().split()[0])
        
        # 计算 timeout：行数 × 每行基础时间
        timeout = line_count * base_per_time
        
        logger.info(
            f"timeout 自动计算: 文件={file_path}, "
            f"行数={line_count}, 每行时间={base_per_time}秒, timeout={timeout}秒"
        )
        
        return timeout
        
    except Exception as e:
        # 如果 wc -l 失败，使用默认值
        logger.warning(f"wc -l 计算行数失败: {e}，使用默认 timeout: 600秒")
        return 600


def _setup_site_scan_directory(scan_workspace_dir: str) -> Path:
    """
    创建并验证站点扫描工作目录
    
    Args:
        scan_workspace_dir: 扫描工作空间目录
        
    Returns:
        Path: 站点扫描目录路径
        
    Raises:
        RuntimeError: 目录创建或验证失败
    """
    site_scan_dir = Path(scan_workspace_dir) / 'site_scan'
    site_scan_dir.mkdir(parents=True, exist_ok=True)
    
    if not site_scan_dir.is_dir():
        raise RuntimeError(f"站点扫描目录创建失败: {site_scan_dir}")
    if not os.access(site_scan_dir, os.W_OK):
        raise RuntimeError(f"站点扫描目录不可写: {site_scan_dir}")
    
    return site_scan_dir


def _export_site_urls(target_id: int, site_scan_dir: Path) -> tuple[str, int, int]:
    """
    导出站点 URL 到文件
    
    Args:
        target_id: 目标 ID
        site_scan_dir: 站点扫描目录
        
    Returns:
        tuple: (urls_file, total_urls, association_count)
        
    Raises:
        ValueError: URL 数量为 0
    """
    logger.info("Step 1: 导出站点URL列表")
    
    urls_file = str(site_scan_dir / 'site_urls.txt')
    export_result = export_site_urls_task(
        target_id=target_id,
        output_file=urls_file,
        batch_size=1000  # 每次处理1000个子域名
    )
    
    total_urls = export_result['total_urls']
    association_count = export_result['association_count']  # 主机端口关联数
    
    logger.info(
        "✓ 站点URL导出完成 - 文件: %s, URL数量: %d, 关联数: %d",
        export_result['output_file'],
        total_urls,
        association_count
    )
    
    if total_urls == 0:
        logger.warning("目标下没有可用的站点URL，无法执行站点扫描")
        # 不抛出异常，由上层决定如何处理
        # raise ValueError("目标下没有可用的站点URL，无法执行站点扫描")
    
    return export_result['output_file'], total_urls, association_count


def _run_scans_sequentially(
    enabled_tools: dict,
    urls_file: str,
    total_urls: int,
    site_scan_dir: Path,
    scan_id: int,
    target_id: int,
    target_name: str
) -> tuple[dict, int, list, list]:
    """
    串行执行站点扫描任务
    
    Args:
        enabled_tools: 已启用的工具配置字典
        urls_file: URL 文件路径
        total_urls: URL 总数
        site_scan_dir: 站点扫描目录
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        target_name: 目标名称（用于错误日志）
        
    Returns:
        tuple: (tool_stats, processed_records, successful_tool_names, failed_tools)
        
    Raises:
        RuntimeError: 所有工具均失败
    """
    tool_stats = {}
    processed_records = 0
    failed_tools = []
    
    for tool_name, tool_config in enabled_tools.items():
        # 1. 构建完整命令（变量替换）
        try:
            command = build_scan_command(
                tool_name=tool_name,
                scan_type='site_scan',
                command_params={
                    'url_file': urls_file
                },
                tool_config=tool_config
            )
        except Exception as e:
            reason = f"命令构建失败: {str(e)}"
            logger.error(f"构建 {tool_name} 命令失败: {e}")
            failed_tools.append({'tool': tool_name, 'reason': reason})
            continue
        
        # 2. 获取超时时间（支持 'auto' 动态计算）
        config_timeout = tool_config.get('timeout', 300)
        if config_timeout == 'auto':
            # 动态计算超时时间
            timeout = calculate_timeout_by_line_count(tool_config, urls_file, base_per_time=1)
            logger.info(f"✓ 工具 {tool_name} 动态计算 timeout: {timeout}秒")
        else:
            # 使用配置的超时时间和动态计算的较大值
            dynamic_timeout = calculate_timeout_by_line_count(tool_config, urls_file, base_per_time=1)
            timeout = max(dynamic_timeout, config_timeout)
        
        # 2.1 生成日志文件路径（类似端口扫描）
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = site_scan_dir / f"{tool_name}_{timestamp}.log"
        
        logger.info(
            "开始执行 %s 站点扫描 - URL数: %d, 最终超时: %ds",
            tool_name, total_urls, timeout
        )
        
        # 3. 执行扫描任务
        try:
            # 流式执行扫描并实时保存结果
            result = run_and_stream_save_websites_task(
                cmd=command,
                tool_name=tool_name,  # 新增：工具名称
                scan_id=scan_id,
                target_id=target_id,
                cwd=str(site_scan_dir),
                shell=True,
                batch_size=1000,
                timeout=timeout,
                log_file=str(log_file)  # 新增：日志文件路径
            )
            
            tool_stats[tool_name] = {
                'command': command,
                'result': result,
                'timeout': timeout
            }
            processed_records += result.get('processed_records', 0)
            
            logger.info(
                "✓ 工具 %s 流式处理完成 - 处理记录: %d, 创建站点: %d, 跳过: %d",
                tool_name,
                result.get('processed_records', 0),
                result.get('created_websites', 0),
                result.get('skipped_no_subdomain', 0) + result.get('skipped_failed', 0)
            )
            
        except subprocess.TimeoutExpired as exc:
            # 超时异常单独处理
            reason = f"执行超时（配置: {timeout}秒）"
            failed_tools.append({'tool': tool_name, 'reason': reason})
            logger.warning(
                "⚠️ 工具 %s 执行超时 - 超时配置: %d秒\n"
                "注意：超时前已解析的站点数据已保存到数据库，但扫描未完全完成。",
                tool_name, timeout
            )
        except Exception as exc:
            # 其他异常
            failed_tools.append({'tool': tool_name, 'reason': str(exc)})
            logger.error("工具 %s 执行失败: %s", tool_name, exc, exc_info=True)
    
    if failed_tools:
        logger.warning(
            "以下扫描工具执行失败: %s",
            ', '.join([f['tool'] for f in failed_tools])
        )
    
    if not tool_stats:
        error_details = "; ".join([f"{f['tool']}: {f['reason']}" for f in failed_tools])
        logger.warning("所有站点扫描工具均失败 - 目标: %s, 失败工具: %s", target_name, error_details)
        # 返回空结果，不抛出异常，让扫描继续
        return {}, 0, [], failed_tools
    
    # 动态计算成功的工具列表
    successful_tool_names = [name for name in enabled_tools.keys() 
                              if name not in [f['tool'] for f in failed_tools]]
    
    logger.info(
        "✓ 串行站点扫描执行完成 - 成功: %d/%d (成功: %s, 失败: %s)",
        len(tool_stats), len(enabled_tools),
        ', '.join(successful_tool_names) if successful_tool_names else '无',
        ', '.join([f['tool'] for f in failed_tools]) if failed_tools else '无'
    )
    
    return tool_stats, processed_records, successful_tool_names, failed_tools


def calculate_timeout(url_count: int, base: int = 600, per_url: int = 1) -> int:
    """
    根据 URL 数量动态计算扫描超时时间

    规则：
    - 基础时间：默认 600 秒（10 分钟）
    - 每个 URL 额外增加：默认 1 秒

    Args:
        url_count: URL 数量，必须为正整数
        base: 基础超时时间（秒），默认 600
        per_url: 每个 URL 增加的时间（秒），默认 1

    Returns:
        int: 计算得到的超时时间（秒），不超过 max_timeout

    Raises:
        ValueError: 当 url_count 为负数或 0 时抛出异常
    """
    if url_count < 0:
        raise ValueError(f"URL数量不能为负数: {url_count}")
    if url_count == 0:
        raise ValueError("URL数量不能为0")

    timeout = base + int(url_count * per_url)
    
    # 不设置上限，由调用方根据需要控制
    return timeout


@flow(
    name="site_scan", 
    log_prints=True,
    on_running=[on_scan_flow_running],
    on_completion=[on_scan_flow_completed],
    on_failure=[on_scan_flow_failed],
)
def site_scan_flow(
    scan_id: int,
    target_name: str,
    target_id: int,
    scan_workspace_dir: str,
    enabled_tools: dict
) -> dict:
    """
    站点扫描 Flow
    
    主要功能：
        1. 从target获取所有子域名与其对应的端口号，拼接成URL写入文件
        2. 用httpx进行批量请求并实时保存到数据库（流式处理）
    
    工作流程：
        Step 0: 创建工作目录
        Step 1: 导出站点 URL 列表
        Step 2: 解析配置，获取启用的工具
        Step 3: 串行执行扫描工具并实时保存结果
    
    Args:
        scan_id: 扫描任务 ID
        target_name: 目标名称
        target_id: 目标 ID
        scan_workspace_dir: 扫描工作空间目录
        enabled_tools: 启用的工具配置字典
    
    Returns:
        dict: {
            'success': bool,
            'scan_id': int,
            'target': str,
            'scan_workspace_dir': str,
            'urls_file': str,
            'total_urls': int,
            'association_count': int,
            'processed_records': int,
            'created_websites': int,
            'skipped_no_subdomain': int,
            'skipped_failed': int,
            'executed_tasks': list,
            'tool_stats': {
                'total': int,
                'successful': int,
                'failed': int,
                'successful_tools': list[str],
                'failed_tools': list[dict]
            }
        }
        
    Raises:
        ValueError: 配置错误
        RuntimeError: 执行失败
    """
    try:
        logger.info(
            "="*60 + "\n" +
            "开始站点扫描\n" +
            f"  Scan ID: {scan_id}\n" +
            f"  Target: {target_name}\n" +
            f"  Workspace: {scan_workspace_dir}\n" +
            "="*60
        )
        
        # 参数验证
        if scan_id is None:
            raise ValueError("scan_id 不能为空")
        if not target_name:
            raise ValueError("target_name 不能为空")
        if target_id is None:
            raise ValueError("target_id 不能为空")
        if not scan_workspace_dir:
            raise ValueError("scan_workspace_dir 不能为空")
        
        # Step 0: 创建工作目录
        site_scan_dir = _setup_site_scan_directory(scan_workspace_dir)
        
        # Step 1: 导出站点 URL
        urls_file, total_urls, association_count = _export_site_urls(
            target_id, site_scan_dir
        )
        
        if total_urls == 0:
            logger.warning("目标下没有可用的站点URL，跳过站点扫描")
            return {
                'success': True,
                'scan_id': scan_id,
                'target': target_name,
                'scan_workspace_dir': scan_workspace_dir,
                'urls_file': urls_file,
                'total_urls': 0,
                'association_count': association_count,
                'processed_records': 0,
                'created_websites': 0,
                'skipped_no_subdomain': 0,
                'skipped_failed': 0,
                'executed_tasks': ['export_site_urls'],
                'tool_stats': {
                    'total': 0,
                    'successful': 0,
                    'failed': 0,
                    'successful_tools': [],
                    'failed_tools': [],
                    'details': {}
                }
            }
        
        # Step 2: 工具配置信息
        logger.info("Step 2: 工具配置信息")
        logger.info(
            "✓ 启用工具: %s",
            ', '.join(enabled_tools.keys())
        )
        
        # Step 3: 串行执行扫描工具
        logger.info("Step 3: 串行执行扫描工具并实时保存结果")
        tool_stats, processed_records, successful_tool_names, failed_tools = _run_scans_sequentially(
            enabled_tools=enabled_tools,
            urls_file=urls_file,
            total_urls=total_urls,
            site_scan_dir=site_scan_dir,
            scan_id=scan_id,
            target_id=target_id,
            target_name=target_name
        )
        
        logger.info("="*60 + "\n✓ 站点扫描完成\n" + "="*60)
        
        # 动态生成已执行的任务列表
        executed_tasks = ['export_site_urls', 'parse_config']
        executed_tasks.extend([f'run_and_stream_save_websites ({tool})' for tool in tool_stats.keys()])
        
        # 汇总所有工具的结果
        total_created = sum(stats['result'].get('created_websites', 0) for stats in tool_stats.values())
        total_skipped_no_subdomain = sum(stats['result'].get('skipped_no_subdomain', 0) for stats in tool_stats.values())
        total_skipped_failed = sum(stats['result'].get('skipped_failed', 0) for stats in tool_stats.values())
        
        return {
            'success': True,
            'scan_id': scan_id,
            'target': target_name,
            'scan_workspace_dir': scan_workspace_dir,
            'urls_file': urls_file,
            'total_urls': total_urls,
            'association_count': association_count,
            'processed_records': processed_records,
            'created_websites': total_created,
            'skipped_no_subdomain': total_skipped_no_subdomain,
            'skipped_failed': total_skipped_failed,
            'executed_tasks': executed_tasks,
            'tool_stats': {
                'total': len(enabled_tools),
                'successful': len(successful_tool_names),
                'failed': len(failed_tools),
                'successful_tools': successful_tool_names,
                'failed_tools': failed_tools,
                'details': tool_stats
            }
        }
        
    except ValueError as e:
        logger.error("配置错误: %s", e)
        raise
    except RuntimeError as e:
        logger.error("运行时错误: %s", e)
        raise
    except Exception as e:
        logger.exception("站点扫描失败: %s", e)
        raise