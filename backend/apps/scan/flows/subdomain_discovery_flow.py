"""
子域名发现扫描 Flow（增强版）

负责编排子域名发现扫描的完整流程

架构：
- Flow 负责编排多个原子 Task
- 支持并行执行扫描工具
- 每个 Task 可独立重试
- 配置由 YAML 解析

增强流程（4 阶段）：
    Stage 1: 被动收集（并行） - 必选
    Stage 2: 字典爆破（可选） - 子域名字典爆破
    Stage 3: 变异生成 + 验证（可选） - dnsgen + 通用存活验证
    Stage 4: DNS 存活验证（可选） - 通用存活验证
    
各阶段可灵活开关，最终结果根据实际执行的阶段动态决定
"""

# Django 环境初始化（导入即生效）
from apps.common.prefect_django_setup import setup_django_for_prefect

from prefect import flow
from pathlib import Path
import logging
import os
from apps.scan.handlers.scan_flow_handlers import (
    on_scan_flow_running,
    on_scan_flow_completed,
    on_scan_flow_failed,
)
from apps.scan.utils import build_scan_command, ensure_wordlist_local
from apps.engine.services.wordlist_service import WordlistService
from apps.common.normalizer import normalize_domain
from apps.common.validators import validate_domain
from datetime import datetime
import uuid
import subprocess

logger = logging.getLogger(__name__)


def _setup_subdomain_directory(scan_workspace_dir: str) -> Path:
    """
    创建并验证子域名扫描工作目录
    
    Args:
        scan_workspace_dir: 扫描工作空间目录
        
    Returns:
        Path: 子域名扫描目录路径
        
    Raises:
        RuntimeError: 目录创建或验证失败
    """
    result_dir = Path(scan_workspace_dir) / 'subdomain_discovery'
    result_dir.mkdir(parents=True, exist_ok=True)
    
    if not result_dir.is_dir():
        raise RuntimeError(f"子域名扫描目录创建失败: {result_dir}")
    if not os.access(result_dir, os.W_OK):
        raise RuntimeError(f"子域名扫描目录不可写: {result_dir}")
    
    return result_dir


def _validate_and_normalize_target(target_name: str) -> str:
    """
    验证并规范化目标域名
    
    Args:
        target_name: 原始目标域名
        
    Returns:
        str: 规范化后的域名
        
    Raises:
        ValueError: 域名无效时抛出异常
        
    Example:
        >>> _validate_and_normalize_target('EXAMPLE.COM')
        'example.com'
        >>> _validate_and_normalize_target('http://example.com')
        'example.com'
    """
    try:
        normalized_target = normalize_domain(target_name)
        validate_domain(normalized_target)
        logger.debug("域名验证通过: %s -> %s", target_name, normalized_target)
        return normalized_target
    except ValueError as e:
        error_msg = f"无效的目标域名: {target_name} - {e}"
        logger.error(error_msg)
        raise ValueError(error_msg) from e


def _run_scans_parallel(
    enabled_tools: dict,
    domain_name: str,
    result_dir: Path
) -> tuple[list, list, list]:
    """
    并行运行所有启用的子域名扫描工具
    
    Args:
        enabled_tools: 启用的工具配置字典 {'tool_name': {'timeout': 600, ...}}
        domain_name: 目标域名
        result_dir: 结果输出目录
        
    Returns:
        tuple: (result_files, failed_tools, successful_tool_names)
        
    Raises:
        RuntimeError: 所有工具均失败
    """
    # 导入任务函数
    from apps.scan.tasks.subdomain_discovery import run_subdomain_discovery_task
    
    # 生成时间戳（所有工具共用）
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # TODO: 接入代理池管理系统
    # from apps.proxy.services import proxy_pool
    # proxy_stats = proxy_pool.get_stats()
    # logger.info(f"代理池状态: {proxy_stats['healthy']}/{proxy_stats['total']} 可用")
    
    failures = []  # 记录命令构建失败的工具
    futures = {}
    
    # 1. 构建命令并提交并行任务
    for tool_name, tool_config in enabled_tools.items():
        # 1.1 生成唯一的输出文件路径（绝对路径）
        short_uuid = uuid.uuid4().hex[:4]
        output_file = str(result_dir / f"{tool_name}_{timestamp}_{short_uuid}.txt")
        
        # 1.2 构建完整命令（变量替换）
        try:
            command = build_scan_command(
                tool_name=tool_name,
                scan_type='subdomain_discovery',
                command_params={
                    'domain': domain_name,      # 对应 {domain}
                    'output_file': output_file  # 对应 {output_file}
                },
                tool_config=tool_config
            )
        except Exception as e:
            failure_msg = f"{tool_name}: 命令构建失败 - {e}"
            failures.append(failure_msg)
            logger.error(f"构建 {tool_name} 命令失败: {e}")
            continue
        
        # 1.3 获取超时时间（支持 'auto' 动态计算）
        timeout = tool_config['timeout']
        if timeout == 'auto':
            # 子域名发现工具通常运行时间较长，使用默认值 600 秒
            timeout = 600
            logger.info(f"✓ 工具 {tool_name} 使用默认 timeout: {timeout}秒")
        
        # 1.4 提交任务
        logger.debug(
            f"提交任务 - 工具: {tool_name}, 超时: {timeout}s, 输出: {output_file}"
        )
        
        future = run_subdomain_discovery_task.submit(
            tool=tool_name,
            command=command,
            timeout=timeout,
            output_file=output_file
        )
        futures[tool_name] = future
    
    # 2. 检查是否有任何工具成功提交
    if not futures:
        logger.warning(
            "所有扫描工具均无法启动 - 目标: %s, 失败详情: %s",
            domain_name, "; ".join(failures)
        )
        # 返回空结果，不抛出异常，让扫描继续
        return [], [{'tool': 'all', 'reason': '所有工具均无法启动'}], []
    
    # 3. 等待并行任务完成，获取结果
    result_files = []
    failed_tools = []
    
    for tool_name, future in futures.items():
        try:
            result = future.result()  # 返回文件路径（字符串）或 ""（失败）
            if result:
                result_files.append(result)
                logger.info("✓ 扫描工具 %s 执行成功: %s", tool_name, result)
            else:
                failure_msg = f"{tool_name}: 未生成结果文件"
                failures.append(failure_msg)
                failed_tools.append({'tool': tool_name, 'reason': '未生成结果文件'})
                logger.warning("⚠️ 扫描工具 %s 未生成结果文件", tool_name)
        except Exception as e:
            failure_msg = f"{tool_name}: {str(e)}"
            failures.append(failure_msg)
            failed_tools.append({'tool': tool_name, 'reason': str(e)})
            logger.warning("⚠️ 扫描工具 %s 执行失败: %s", tool_name, str(e))
    
    # 4. 检查是否有成功的工具
    if not result_files:
        logger.warning(
            "所有扫描工具均失败 - 目标: %s, 失败详情: %s",
            domain_name, "; ".join(failures)
        )
        # 返回空结果，不抛出异常，让扫描继续
        return [], failed_tools, []
    
    # 5. 动态计算成功的工具列表
    successful_tool_names = [name for name in futures.keys() 
                              if name not in [f['tool'] for f in failed_tools]]
    
    logger.info(
        "✓ 扫描工具并行执行完成 - 成功: %d/%d (成功: %s, 失败: %s)",
        len(result_files), len(futures),
        ', '.join(successful_tool_names) if successful_tool_names else '无',
        ', '.join([f['tool'] for f in failed_tools]) if failed_tools else '无'
    )
    
    return result_files, failed_tools, successful_tool_names


def _run_single_tool(
    tool_name: str,
    tool_config: dict,
    command_params: dict,
    result_dir: Path,
    scan_type: str = 'subdomain_discovery'
) -> str:
    """
    运行单个扫描工具
    
    Args:
        tool_name: 工具名称
        tool_config: 工具配置
        command_params: 命令参数
        result_dir: 结果目录
        scan_type: 扫描类型
        
    Returns:
        str: 输出文件路径，失败返回空字符串
    """
    from apps.scan.tasks.subdomain_discovery import run_subdomain_discovery_task
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    short_uuid = uuid.uuid4().hex[:4]
    output_file = str(result_dir / f"{tool_name}_{timestamp}_{short_uuid}.txt")
    
    # 添加 output_file 到参数
    command_params['output_file'] = output_file
    
    try:
        command = build_scan_command(
            tool_name=tool_name,
            scan_type=scan_type,
            command_params=command_params,
            tool_config=tool_config
        )
    except Exception as e:
        logger.error(f"构建 {tool_name} 命令失败: {e}")
        return ""
    
    timeout = tool_config.get('timeout', 3600)
    if timeout == 'auto':
        timeout = 3600
    
    logger.info(f"执行 {tool_name}: timeout={timeout}s")
    
    try:
        result = run_subdomain_discovery_task(
            tool=tool_name,
            command=command,
            timeout=timeout,
            output_file=output_file
        )
        return result if result else ""
    except Exception as e:
        logger.warning(f"{tool_name} 执行失败: {e}")
        return ""


def _count_lines(file_path: str) -> int:
    """
    统计文件非空行数
    
    Args:
        file_path: 文件路径
        
    Returns:
        int: 非空行数量
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for line in f if line.strip())
    except Exception as e:
        logger.warning(f"统计文件行数失败: {file_path} - {e}")
        return 0


def _merge_files(file_list: list, output_file: str) -> str:
    """
    合并多个文件并去重
    
    Args:
        file_list: 文件路径列表
        output_file: 输出文件路径
        
    Returns:
        str: 输出文件路径
    """
    domains = set()
    for f in file_list:
        if f and Path(f).exists():
            with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
                for line in fp:
                    line = line.strip()
                    if line:
                        domains.add(line)
    
    with open(output_file, 'w', encoding='utf-8') as fp:
        for domain in sorted(domains):
            fp.write(domain + '\n')
    
    logger.info(f"合并完成: {len(domains)} 个域名 -> {output_file}")
    return output_file


@flow(
    name="subdomain_discovery", 
    log_prints=True,
    on_running=[on_scan_flow_running],
    on_completion=[on_scan_flow_completed],
    on_failure=[on_scan_flow_failed],
)
def subdomain_discovery_flow(
    scan_id: int,
    target_name: str,
    target_id: int,
    scan_workspace_dir: str,
    enabled_tools: dict
) -> dict:
    """子域名发现扫描流程（增强版）
    
    工作流程（4 阶段）：
        Stage 1: 被动收集（并行） - 必选
        Stage 2: 字典爆破（可选） - 子域名字典爆破
        Stage 3: 变异生成 + 验证（可选） - dnsgen + 通用存活验证
        Stage 4: DNS 存活验证（可选） - 通用存活验证
        Final: 保存到数据库
    
    Args:
        scan_id: 扫描任务 ID
        target_name: 目标名称（域名）
        target_id: 目标 ID
        scan_workspace_dir: Scan 工作空间目录（由 Service 层创建）
        enabled_tools: 扫描配置字典:
            {
                'passive_tools': {...},
                'bruteforce': {...},
                'permutation': {...},
                'resolve': {...}
            }
    
    Returns:
        dict: 扫描结果
    
    Raises:
        ValueError: 配置错误
        RuntimeError: 执行失败
    """
    try:
        # ==================== 参数验证 ====================
        if scan_id is None:
            raise ValueError("scan_id 不能为空")
        if target_id is None:
            raise ValueError("target_id 不能为空")
        if not scan_workspace_dir:
            raise ValueError("scan_workspace_dir 不能为空")
        if enabled_tools is None:
            raise ValueError("enabled_tools 不能为空")
        
        scan_config = enabled_tools
        
        # 如果未提供目标域名，跳过扫描
        if not target_name:
            logger.warning("未提供目标域名，跳过子域名发现扫描")
            return _empty_result(scan_id, '', scan_workspace_dir)
        
        # 导入任务函数
        from apps.scan.tasks.subdomain_discovery import (
            run_subdomain_discovery_task,
            merge_and_validate_task,
            save_domains_task
        )
        
        # Step 0: 准备工作
        result_dir = _setup_subdomain_directory(scan_workspace_dir)
        
        # 验证并规范化目标域名
        try:
            domain_name = _validate_and_normalize_target(target_name)
        except ValueError as e:
            logger.warning("目标域名无效，跳过子域名发现扫描: %s", e)
            return _empty_result(scan_id, target_name, scan_workspace_dir)
        
        # 验证成功后打印日志
        logger.info(
            "="*60 + "\n" +
            "开始子域名发现扫描（增强版）\n" +
            f"  Scan ID: {scan_id}\n" +
            f"  Domain: {domain_name}\n" +
            f"  Workspace: {scan_workspace_dir}\n" +
            "="*60
        )
        
        # 解析配置
        passive_tools = scan_config.get('passive_tools', {})
        bruteforce_config = scan_config.get('bruteforce', {})
        permutation_config = scan_config.get('permutation', {})
        resolve_config = scan_config.get('resolve', {})
        
        # 过滤出启用的被动工具
        enabled_passive_tools = {
            k: v for k, v in passive_tools.items() 
            if v.get('enabled', True)
        }
        
        executed_tasks = []
        all_result_files = []
        failed_tools = []
        successful_tool_names = []
        
        # ==================== Stage 1: 被动收集（并行）====================
        logger.info("=" * 40)
        logger.info("Stage 1: 被动收集（并行）")
        logger.info("=" * 40)
        
        if enabled_passive_tools:
            logger.info("启用工具: %s", ', '.join(enabled_passive_tools.keys()))
            result_files, stage1_failed, stage1_success = _run_scans_parallel(
                enabled_tools=enabled_passive_tools,
                domain_name=domain_name,
                result_dir=result_dir
            )
            all_result_files.extend(result_files)
            failed_tools.extend(stage1_failed)
            successful_tool_names.extend(stage1_success)
            executed_tasks.extend([f'passive ({tool})' for tool in stage1_success])
        else:
            logger.warning("未启用任何被动收集工具")
        
        # 合并 Stage 1 结果
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        current_result = str(result_dir / f"subs_passive_{timestamp}.txt")
        if all_result_files:
            current_result = _merge_files(all_result_files, current_result)
            executed_tasks.append('merge_passive')
        else:
            # 创建空文件
            Path(current_result).touch()
            logger.warning("Stage 1 无结果，创建空文件")
        
        # ==================== Stage 2: 字典爆破（可选）====================
        bruteforce_enabled = bruteforce_config.get('enabled', False)
        if bruteforce_enabled:
            logger.info("=" * 40)
            logger.info("Stage 2: 字典爆破")
            logger.info("=" * 40)
            
            bruteforce_tool_config = bruteforce_config.get('subdomain_bruteforce', {})
            wordlist_name = bruteforce_tool_config.get('wordlist_name', 'dns_wordlist.txt')
            
            try:
                # 确保本地存在字典文件（含 hash 校验）
                local_wordlist_path = ensure_wordlist_local(wordlist_name)
                
                # 获取字典记录用于计算 timeout
                wordlist_service = WordlistService()
                wordlist = wordlist_service.get_wordlist_by_name(wordlist_name)
                
                timeout_value = bruteforce_tool_config.get('timeout', 3600)
                if timeout_value == 'auto' and wordlist:
                    line_count = getattr(wordlist, 'line_count', None)
                    if line_count is None:
                        try:
                            with open(local_wordlist_path, 'rb') as f:
                                line_count = sum(1 for _ in f)
                        except OSError:
                            line_count = 0

                    try:
                        line_count_int = int(line_count)
                    except (TypeError, ValueError):
                        line_count_int = 0

                    timeout_value = line_count_int * 3 if line_count_int > 0 else 3600
                    bruteforce_tool_config = {
                        **bruteforce_tool_config,
                        'timeout': timeout_value,
                    }
                    logger.info(
                        "subdomain_bruteforce 使用自动 timeout: %s 秒 (字典行数=%s, 3秒/行)",
                        timeout_value,
                        line_count_int,
                    )

                brute_output = str(result_dir / f"subs_brute_{timestamp}.txt")
                brute_result = _run_single_tool(
                    tool_name='subdomain_bruteforce',
                    tool_config=bruteforce_tool_config,
                    command_params={
                        'domain': domain_name,
                        'wordlist': local_wordlist_path,
                        'output_file': brute_output
                    },
                    result_dir=result_dir
                )
                
                if brute_result:
                    # 合并 Stage 1 + Stage 2
                    current_result = _merge_files(
                        [current_result, brute_result],
                        str(result_dir / f"subs_merged_{timestamp}.txt")
                    )
                    successful_tool_names.append('subdomain_bruteforce')
                    executed_tasks.append('bruteforce')
                else:
                    failed_tools.append({'tool': 'subdomain_bruteforce', 'reason': '执行失败'})
            except Exception as exc:
                logger.warning("字典准备失败，跳过字典爆破: %s", exc)
                failed_tools.append({'tool': 'subdomain_bruteforce', 'reason': str(exc)})
        
        # ==================== Stage 3: 变异生成 + 验证（可选）====================
        permutation_enabled = permutation_config.get('enabled', False)
        if permutation_enabled:
            logger.info("=" * 40)
            logger.info("Stage 3: 变异生成 + 存活验证（流式管道）")
            logger.info("=" * 40)
            
            permutation_tool_config = permutation_config.get('subdomain_permutation_resolve', {})
            
            # === Step 3.1: 泛解析采样检测 ===
            # 生成原文件 100 倍的变异样本，检查解析结果是否超过 50 倍
            before_count = _count_lines(current_result)
            
            # 配置参数
            SAMPLE_MULTIPLIER = 100  # 采样数量 = 原文件 × 100
            EXPANSION_THRESHOLD = 50  # 膨胀阈值 = 原文件 × 50
            SAMPLE_TIMEOUT = 7200  # 采样超时 2 小时
            
            sample_size = before_count * SAMPLE_MULTIPLIER
            max_allowed = before_count * EXPANSION_THRESHOLD
            
            sample_output = str(result_dir / f"subs_permuted_sample_{timestamp}.txt")
            sample_cmd = (
                f"cat {current_result} | dnsgen - | head -n {sample_size} | "
                f"puredns resolve -r /app/backend/resources/resolvers.txt "
                f"--write {sample_output} --wildcard-tests 50 --wildcard-batch 1000000 --quiet"
            )
            
            logger.info(
                f"泛解析采样检测: 原文件 {before_count} 个, "
                f"采样 {sample_size} 个, 阈值 {max_allowed} 个"
            )
            
            try:
                subprocess.run(
                    sample_cmd, 
                    shell=True, 
                    timeout=SAMPLE_TIMEOUT, 
                    check=False,
                    capture_output=True
                )
                sample_result_count = _count_lines(sample_output) if Path(sample_output).exists() else 0
                
                logger.info(
                    f"采样结果: {sample_result_count} 个域名存活 "
                    f"(原文件: {before_count}, 阈值: {max_allowed})"
                )
                
                if sample_result_count > max_allowed:
                    # 采样结果超过阈值，说明存在泛解析，跳过完整变异
                    ratio = sample_result_count / before_count if before_count > 0 else sample_result_count
                    logger.warning(
                        f"跳过变异: 采样检测到泛解析 "
                        f"({sample_result_count} > {max_allowed}, 膨胀率 {ratio:.1f}x)"
                    )
                    failed_tools.append({
                        'tool': 'subdomain_permutation_resolve',
                        'reason': f"采样检测到泛解析 (膨胀率 {ratio:.1f}x)"
                    })
                else:
                    # === Step 3.2: 采样通过，执行完整变异 ===
                    logger.info("采样检测通过，执行完整变异...")
                    
                    permuted_output = str(result_dir / f"subs_permuted_{timestamp}.txt")
                    
                    permuted_result = _run_single_tool(
                        tool_name='subdomain_permutation_resolve',
                        tool_config=permutation_tool_config,
                        command_params={
                            'input_file': current_result,
                            'output_file': permuted_output,
                        },
                        result_dir=result_dir
                    )
                    
                    if permuted_result:
                        # 合并原结果 + 变异验证结果
                        current_result = _merge_files(
                            [current_result, permuted_result],
                            str(result_dir / f"subs_with_permuted_{timestamp}.txt")
                        )
                        successful_tool_names.append('subdomain_permutation_resolve')
                        executed_tasks.append('permutation')
                    else:
                        failed_tools.append({'tool': 'subdomain_permutation_resolve', 'reason': '执行失败'})
                        
            except subprocess.TimeoutExpired:
                logger.warning(f"采样检测超时 ({SAMPLE_TIMEOUT}秒)，跳过变异")
                failed_tools.append({'tool': 'subdomain_permutation_resolve', 'reason': '采样检测超时'})
            except Exception as e:
                logger.warning(f"采样检测失败: {e}，跳过变异")
                failed_tools.append({'tool': 'subdomain_permutation_resolve', 'reason': f'采样检测失败: {e}'})
        
        # ==================== Stage 4: DNS 存活验证（可选）====================
        # 无论是否启用 Stage 3，只要 resolve.enabled 为 true 就会执行，对当前所有候选子域做统一 DNS 验证
        resolve_enabled = resolve_config.get('enabled', False)
        if resolve_enabled:
            logger.info("=" * 40)
            logger.info("Stage 4: DNS 存活验证")
            logger.info("=" * 40)
            
            resolve_tool_config = resolve_config.get('subdomain_resolve', {})

            # 根据当前候选子域数量动态计算 timeout（支持 timeout: auto）
            timeout_value = resolve_tool_config.get('timeout', 3600)
            if timeout_value == 'auto':
                line_count = 0
                try:
                    with open(current_result, 'rb') as f:
                        line_count = sum(1 for _ in f)
                except OSError:
                    line_count = 0

                try:
                    line_count_int = int(line_count)
                except (TypeError, ValueError):
                    line_count_int = 0

                timeout_value = line_count_int * 3 if line_count_int > 0 else 3600
                resolve_tool_config = {
                    **resolve_tool_config,
                    'timeout': timeout_value,
                }
                logger.info(
                    "subdomain_resolve 使用自动 timeout: %s 秒 (候选子域数=%s, 3秒/域名)",
                    timeout_value,
                    line_count_int,
                )

            alive_output = str(result_dir / f"subs_alive_{timestamp}.txt")
            
            alive_result = _run_single_tool(
                tool_name='subdomain_resolve',
                tool_config=resolve_tool_config,
                command_params={
                    'input_file': current_result,
                    'output_file': alive_output,
                },
                result_dir=result_dir
            )
            
            if alive_result:
                current_result = alive_result
                successful_tool_names.append('subdomain_resolve')
                executed_tasks.append('resolve')
            else:
                failed_tools.append({'tool': 'subdomain_resolve', 'reason': '执行失败'})
        
        # ==================== Final: 保存到数据库 ====================
        logger.info("=" * 40)
        logger.info("Final: 保存到数据库")
        logger.info("=" * 40)
        
        # 最终验证和保存
        final_file = merge_and_validate_task(
            result_files=[current_result],
            result_dir=str(result_dir)
        )
        
        save_result = save_domains_task(
            domains_file=final_file,
            scan_id=scan_id,
            target_id=target_id
        )
        processed_domains = save_result.get('processed_records', 0)
        executed_tasks.append('save_domains')
        
        logger.info("="*60 + "\n✓ 子域名发现扫描完成\n" + "="*60)
        
        return {
            'success': True,
            'scan_id': scan_id,
            'target': domain_name,
            'scan_workspace_dir': scan_workspace_dir,
            'total': processed_domains,
            'executed_tasks': executed_tasks,
            'tool_stats': {
                'total': len(enabled_passive_tools) + (1 if bruteforce_enabled else 0) + 
                         (1 if permutation_enabled else 0) + (1 if resolve_enabled else 0),
                'successful': len(successful_tool_names),
                'failed': len(failed_tools),
                'successful_tools': successful_tool_names,
                'failed_tools': failed_tools
            }
        }
        
    except ValueError as e:
        logger.error("配置错误: %s", e)
        raise
    except RuntimeError as e:
        logger.error("运行时错误: %s", e)
        raise
    except Exception as e:
        logger.exception("子域名发现扫描失败: %s", e)
        raise


def _empty_result(scan_id: int, target: str, scan_workspace_dir: str) -> dict:
    """返回空结果"""
    return {
        'success': True,
        'scan_id': scan_id,
        'target': target,
        'scan_workspace_dir': scan_workspace_dir,
        'total': 0,
        'executed_tasks': [],
        'tool_stats': {
            'total': 0,
            'successful': 0,
            'failed': 0,
            'successful_tools': [],
            'failed_tools': []
        }
    }
