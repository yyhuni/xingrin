"""
目录扫描 Flow

负责编排目录扫描的完整流程

架构：
- Flow 负责编排多个原子 Task
- 支持串行执行扫描工具（流式处理）
- 每个 Task 可独立重试
- 配置由 YAML 解析
"""

# Django 环境初始化（导入即生效）
from apps.common.prefect_django_setup import setup_django_for_prefect

from prefect import flow

import logging
import os
import subprocess
from pathlib import Path

from apps.scan.tasks.directory_scan import (
    export_sites_task,
    run_and_stream_save_directories_task
)
from apps.scan.handlers.scan_flow_handlers import (
    on_scan_flow_running,
    on_scan_flow_completed,
    on_scan_flow_failed,
)
from apps.scan.utils import config_parser, build_scan_command, ensure_wordlist_local

logger = logging.getLogger(__name__)


def calculate_directory_scan_timeout(
    tool_config: dict,
    base_per_word: float = 1.0,
    min_timeout: int = 60,
    max_timeout: int = 7200
) -> int:
    """
    根据字典行数计算目录扫描超时时间
    
    计算公式：超时时间 = 字典行数 × 每个单词基础时间
    超时范围：60秒 ~ 2小时（7200秒）
    
    Args:
        tool_config: 工具配置字典，包含 wordlist 路径
        base_per_word: 每个单词的基础时间（秒），默认 1.0秒
        min_timeout: 最小超时时间（秒），默认 60秒
        max_timeout: 最大超时时间（秒），默认 7200秒（2小时）
    
    Returns:
        int: 计算出的超时时间（秒），范围：60 ~ 7200
    
    Example:
        # 1000行字典 × 1.0秒 = 1000秒 → 限制为7200秒中的 1000秒
        # 10000行字典 × 1.0秒 = 10000秒 → 限制为7200秒（最大值）
        timeout = calculate_directory_scan_timeout(
            tool_config={'wordlist': '/path/to/wordlist.txt'}
        )
    """
    try:
        # 从 tool_config 中获取 wordlist 路径
        wordlist_path = tool_config.get('wordlist')
        if not wordlist_path:
            logger.warning("工具配置中未指定 wordlist，使用默认超时: %d秒", min_timeout)
            return min_timeout
        
        # 展开用户目录（~）
        wordlist_path = os.path.expanduser(wordlist_path)
        
        # 检查文件是否存在
        if not os.path.exists(wordlist_path):
            logger.warning("字典文件不存在: %s，使用默认超时: %d秒", wordlist_path, min_timeout)
            return min_timeout
        
        # 使用 wc -l 快速统计字典行数
        result = subprocess.run(
            ['wc', '-l', wordlist_path],
            capture_output=True,
            text=True,
            check=True
        )
        # wc -l 输出格式：行数 + 空格 + 文件名
        line_count = int(result.stdout.strip().split()[0])
        
        # 计算超时时间
        timeout = int(line_count * base_per_word)
        
        # 设置合理的下限（不再设置上限）
        timeout = max(min_timeout, timeout)
        
        logger.info(
            "目录扫描超时计算 - 字典: %s, 行数: %d, 基础时间: %.3f秒/词, 计算超时: %d秒",
            wordlist_path, line_count, base_per_word, timeout
        )
        
        return timeout
        
    except subprocess.CalledProcessError as e:
        logger.error("统计字典行数失败: %s", e)
        # 失败时返回默认超时
        return min_timeout
    except (ValueError, IndexError) as e:
        logger.error("解析字典行数失败: %s", e)
        return min_timeout
    except Exception as e:
        logger.error("计算超时时间异常: %s", e)
        return min_timeout


def _setup_directory_scan_directory(scan_workspace_dir: str) -> Path:
    """
    创建并验证目录扫描工作目录
    
    Args:
        scan_workspace_dir: 扫描工作空间目录
        
    Returns:
        Path: 目录扫描目录路径
        
    Raises:
        RuntimeError: 目录创建或验证失败
    """
    directory_scan_dir = Path(scan_workspace_dir) / 'directory_scan'
    directory_scan_dir.mkdir(parents=True, exist_ok=True)
    
    if not directory_scan_dir.is_dir():
        raise RuntimeError(f"目录扫描目录创建失败: {directory_scan_dir}")
    if not os.access(directory_scan_dir, os.W_OK):
        raise RuntimeError(f"目录扫描目录不可写: {directory_scan_dir}")
    
    return directory_scan_dir


def _export_site_urls(target_id: int, directory_scan_dir: Path) -> tuple[str, int]:
    """
    导出目标下的所有站点 URL 到文件
    
    Args:
        target_id: 目标 ID
        directory_scan_dir: 目录扫描目录
        
    Returns:
        tuple: (sites_file, site_count)
        
    Raises:
        ValueError: 站点数量为 0
    """
    logger.info("Step 1: 导出目标的所有站点 URL")
    
    sites_file = str(directory_scan_dir / 'sites.txt')
    export_result = export_sites_task(
        target_id=target_id,
        output_file=sites_file,
        batch_size=1000  # 每次读取 1000 条，优化内存占用
    )
    
    site_count = export_result['total_count']
    
    logger.info(
        "✓ 站点 URL 导出完成 - 文件: %s, 数量: %d",
        export_result['output_file'],
        site_count
    )
    
    if site_count == 0:
        logger.warning("目标下没有站点，无法执行目录扫描")
        # 不抛出异常，由上层决定如何处理
        # raise ValueError("目标下没有站点，无法执行目录扫描")
    
    return export_result['output_file'], site_count


def _run_scans_sequentially(
    enabled_tools: dict,
    sites_file: str,
    directory_scan_dir: Path,
    scan_id: int,
    target_id: int,
    site_count: int,
    target_name: str
) -> tuple[int, int, list]:
    """
    串行执行目录扫描任务（支持多工具）
    
    Args:
        enabled_tools: 启用的工具配置字典
        sites_file: 站点文件路径
        directory_scan_dir: 目录扫描目录
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        site_count: 站点数量
        target_name: 目标名称（用于错误日志）
        
    Returns:
        tuple: (total_directories, processed_sites, failed_sites)
    """
    # 读取站点列表
    sites = []
    with open(sites_file, 'r', encoding='utf-8') as f:
        for line in f:
            site_url = line.strip()
            if site_url:
                sites.append(site_url)
    
    logger.info("准备扫描 %d 个站点，使用工具: %s", len(sites), ', '.join(enabled_tools.keys()))
    
    total_directories = 0
    processed_sites_set = set()  # 使用 set 避免重复计数
    failed_sites = []
    
    # 遍历每个工具
    for tool_name, tool_config in enabled_tools.items():
        logger.info("="*60)
        logger.info("使用工具: %s", tool_name)
        logger.info("="*60)

        # 如果配置了 wordlist_name，则先确保本地存在对应的字典文件（含 hash 校验）
        wordlist_name = tool_config.get('wordlist_name')
        if wordlist_name:
            try:
                local_wordlist_path = ensure_wordlist_local(wordlist_name)
                tool_config['wordlist'] = local_wordlist_path
            except Exception as exc:
                logger.error("为工具 %s 准备字典失败: %s", tool_name, exc)
                # 当前工具无法执行，将所有站点视为失败，继续下一个工具
                failed_sites.extend(sites)
                continue
        
        # 逐个站点执行扫描
        for idx, site_url in enumerate(sites, 1):
            logger.info(
                "[%d/%d] 开始扫描站点: %s (工具: %s)",
                idx, len(sites), site_url, tool_name
            )
            
            # 使用统一的命令构建器
            try:
                command = build_scan_command(
                    tool_name=tool_name,
                    scan_type='directory_scan',
                    command_params={
                        'url': site_url
                    },
                    tool_config=tool_config
                )
            except Exception as e:
                logger.error(
                    "✗ [%d/%d] 构建 %s 命令失败: %s - 站点: %s",
                    idx, len(sites), tool_name, e, site_url
                )
                failed_sites.append(site_url)
                continue
            
            # 单个站点超时：从配置中获取（支持 'auto' 动态计算）
            # ffuf 逐个站点扫描，timeout 就是单个站点的超时时间
            site_timeout = tool_config.get('timeout', 300)
            if site_timeout == 'auto':
                # 动态计算超时时间（基于字典行数）
                site_timeout = calculate_directory_scan_timeout(tool_config)
                logger.info(f"✓ 工具 {tool_name} 动态计算 timeout: {site_timeout}秒")
            
            # 生成日志文件路径
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            log_file = directory_scan_dir / f"{tool_name}_{timestamp}_{idx}.log"
            
            try:
                # 直接调用 task（串行执行）
                result = run_and_stream_save_directories_task(
                    cmd=command,
                    tool_name=tool_name,  # 新增：工具名称
                    scan_id=scan_id,
                    target_id=target_id,
                    site_url=site_url,
                    cwd=str(directory_scan_dir),
                    shell=True,
                    batch_size=1000,
                    timeout=site_timeout,
                    log_file=str(log_file)  # 新增：日志文件路径
                )
                
                total_directories += result.get('created_directories', 0)
                processed_sites_set.add(site_url)  # 使用 set 记录成功的站点
                
                logger.info(
                    "✓ [%d/%d] 站点扫描完成: %s - 发现 %d 个目录",
                    idx, len(sites), site_url,
                    result.get('created_directories', 0)
                )
                
            except subprocess.TimeoutExpired as exc:
                # 超时异常单独处理
                failed_sites.append(site_url)
                logger.warning(
                    "⚠️ [%d/%d] 站点扫描超时: %s - 超时配置: %d秒\n"
                    "注意：超时前已解析的目录数据已保存到数据库，但扫描未完全完成。",
                    idx, len(sites), site_url, site_timeout
                )
            except Exception as exc:
                # 其他异常
                failed_sites.append(site_url)
                logger.error(
                    "✗ [%d/%d] 站点扫描失败: %s - 错误: %s",
                    idx, len(sites), site_url, exc
                )
            
            # 每 10 个站点输出进度
            if idx % 10 == 0:
                logger.info(
                    "进度: %d/%d (%.1f%%) - 已发现 %d 个目录",
                    idx, len(sites), idx/len(sites)*100, total_directories
                )
    
    # 计算成功和失败的站点数
    processed_count = len(processed_sites_set)
    
    if failed_sites:
        logger.warning(
            "部分站点扫描失败: %d/%d",
            len(failed_sites), len(sites)
        )
    
    logger.info(
        "✓ 串行目录扫描执行完成 - 成功: %d/%d, 失败: %d, 总目录数: %d",
        processed_count, len(sites), len(failed_sites), total_directories
    )
    
    return total_directories, processed_count, failed_sites


@flow(
    name="directory_scan", 
    log_prints=True,
    on_running=[on_scan_flow_running],
    on_completion=[on_scan_flow_completed],
    on_failure=[on_scan_flow_failed],
)
def directory_scan_flow(
    scan_id: int,
    target_name: str,
    target_id: int,
    scan_workspace_dir: str,
    enabled_tools: dict
) -> dict:
    """
    目录扫描 Flow
    
    主要功能：
        1. 从 target 获取所有站点的 URL
        2. 对每个站点 URL 执行目录扫描（支持 ffuf 等工具）
        3. 流式保存扫描结果到数据库 Directory 表
    
    工作流程：
        Step 0: 创建工作目录
        Step 1: 导出站点 URL 列表到文件（供扫描工具使用）
        Step 2: 验证工具配置
        Step 3: 串行执行扫描工具并实时保存结果
    
    ffuf 输出字段：
        - url: 发现的目录/文件 URL
        - length: 响应内容长度
        - status: HTTP 状态码
        - words: 响应内容单词数
        - lines: 响应内容行数
        - content_type: 内容类型
        - duration: 请求耗时
    
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
            'sites_file': str,
            'site_count': int,
            'total_directories': int,  # 发现的总目录数
            'processed_sites': int,  # 成功处理的站点数
            'failed_sites_count': int,  # 失败的站点数
            'executed_tasks': list
        }
    
    Raises:
        ValueError: 参数错误
        RuntimeError: 执行失败
    """
    try:
        logger.info(
            "="*60 + "\n" +
            "开始目录扫描\n" +
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
        if not enabled_tools:
            raise ValueError("enabled_tools 不能为空")
        
        # Step 0: 创建工作目录
        directory_scan_dir = _setup_directory_scan_directory(scan_workspace_dir)
        
        # Step 1: 导出站点 URL
        sites_file, site_count = _export_site_urls(target_id, directory_scan_dir)
        
        if site_count == 0:
            logger.warning("目标下没有站点，跳过目录扫描")
            return {
                'success': True,
                'scan_id': scan_id,
                'target': target_name,
                'scan_workspace_dir': scan_workspace_dir,
                'sites_file': sites_file,
                'site_count': 0,
                'total_directories': 0,
                'processed_sites': 0,
                'failed_sites_count': 0,
                'executed_tasks': ['export_sites']
            }
        
        # Step 2: 工具配置信息
        logger.info("Step 2: 工具配置信息")
        logger.info(
            "✓ 启用工具: %s",
            ', '.join(enabled_tools.keys())
        )
        
        # Step 3: 串行执行扫描工具并实时保存结果
        logger.info("Step 3: 串行执行扫描工具并实时保存结果")
        total_directories, processed_sites, failed_sites = _run_scans_sequentially(
            enabled_tools=enabled_tools,
            sites_file=sites_file,
            directory_scan_dir=directory_scan_dir,
            scan_id=scan_id,
            target_id=target_id,
            site_count=site_count,
            target_name=target_name
        )
        
        # 检查是否所有站点都失败
        if processed_sites == 0 and site_count > 0:
            logger.warning("所有站点扫描均失败 - 总站点数: %d, 失败数: %d", site_count, len(failed_sites))
            # 不抛出异常，让扫描继续
        
        logger.info("="*60 + "\n✓ 目录扫描完成\n" + "="*60)
        
        return {
            'success': True,
            'scan_id': scan_id,
            'target': target_name,
            'scan_workspace_dir': scan_workspace_dir,
            'sites_file': sites_file,
            'site_count': site_count,
            'total_directories': total_directories,
            'processed_sites': processed_sites,
            'failed_sites_count': len(failed_sites),
            'executed_tasks': ['export_sites', 'run_and_stream_save_directories']
        }
        
    except Exception as e:
        logger.exception("目录扫描失败: %s", e)
        raise