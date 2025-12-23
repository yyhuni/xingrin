"""
基于 stream_command 的流式端口扫描任务（简化版）

主要功能：
    1. 实时执行端口扫描命令（如 naabu）
    2. 流式处理命令输出，实时解析为 PortScanRecord
    3. 批量保存到数据库（HostPortAssociation + HostPortAssociationSnapshot）
    4. 避免生成大量临时文件，提高效率

数据流向：
    命令执行 → 流式输出 → 实时解析 → 批量保存 → 数据库
    
    输入：扫描命令及参数
    输出：HostPortAssociation（资产表）+ HostPortAssociationSnapshot（快照表）

优化策略：
    - 使用 stream_command 实时处理输出
    - 直接存储 host + ip + port 组合，不维护复杂关系
    - 流式处理避免内存溢出
    - 批量操作减少数据库交互
"""

import logging
import json
import subprocess
import time
from asyncio import CancelledError
from pathlib import Path
from prefect import task
from typing import Generator, List, Optional, TYPE_CHECKING
from django.db import IntegrityError, OperationalError, DatabaseError
from psycopg2 import InterfaceError
from dataclasses import dataclass

from .types import PortScanRecord
from apps.scan.utils import execute_stream
from apps.common.validators import validate_port
from apps.common.definitions import ScanStatus
from apps.scan.models import Scan

# 类型检查时导入，运行时不导入（避免循环依赖）
if TYPE_CHECKING:
    from apps.asset.services.snapshot import HostPortMappingSnapshotsService

logger = logging.getLogger(__name__)


@dataclass
class ServiceSet:
    """
    Service 集合，用于依赖注入
    
    提供所有需要的 Service 实例，便于测试时注入 Mock 对象
    """
    snapshot: "HostPortMappingSnapshotsService"
    
    @classmethod
    def create_default(cls) -> "ServiceSet":
        """创建默认的 Service 集合"""
        from apps.asset.services.snapshot import HostPortMappingSnapshotsService
        return cls(
            snapshot=HostPortMappingSnapshotsService()
        )


def _save_batch_with_retry(
    batch: list,
    scan_id: int,
    target_id: int,
    batch_num: int,
    services: ServiceSet,
    max_retries: int = 3
) -> dict:
    """
    保存一个批次的端口扫描结果（带重试机制）
    
    Args:
        batch: 数据批次
        scan_id: 扫描任务ID
        target_id: 目标ID
        batch_num: 批次编号
        services: Service 集合（必须，包含 HostPortAssociationSnapshotsService）
        max_retries: 最大重试次数
    
    Returns:
        dict: {'success': bool}
    """
    for attempt in range(max_retries):
        try:
            result = _save_batch(batch, scan_id, target_id, batch_num, services)
            return result  # {'success': True}
        
        except IntegrityError as e:
            # 数据完整性错误，不应重试（IntegrityError 是 DatabaseError 的子类，需先处理）
            logger.error("批次 %d 数据完整性错误，跳过: %s", batch_num, str(e)[:100])
            return {'success': False}
        
        except (OperationalError, DatabaseError) as e:
            # 数据库连接/操作错误，可重试
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 指数退避: 1s, 2s, 4s
                logger.warning(
                    "批次 %d 保存失败（第 %d 次尝试），%d秒后重试: %s",
                    batch_num, attempt + 1, wait_time, str(e)[:100]
                )
                time.sleep(wait_time)
            else:
                logger.error("批次 %d 保存失败（已重试 %d 次）: %s", batch_num, max_retries, e)
                return {'success': False}
        
        except Exception as e:
            # 其他未知错误
            logger.error("批次 %d 未知错误: %s", batch_num, e, exc_info=True)
            return {'success': False}
    
    return {'success': False}


def _save_batch(
    batch: list, 
    scan_id: int, 
    target_id: int, 
    batch_num: int, 
    services: ServiceSet  # Service集合（依赖注入）
) -> dict:
    """
    保存一个批次的端口扫描数据到数据库（使用 Service 架构）
    
    数据存储：
        使用 HostPortAssociationSnapshotsService.save_and_sync()
        自动保存到快照表并同步到资产表
    
    处理流程：
        1. 构建 HostPortAssociationSnapshotDTO 列表
        2. 调用 service.save_and_sync() 统一处理
           - 保存到快照表（scan_id）
           - 同步到资产表（target_id）
    
    Args:
        batch: 数据批次，list of {'host', 'ip', 'port'}
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        batch_num: 批次编号（用于日志）
        services: Service 集合（包含 HostPortAssociationSnapshotsService）
    
    Returns:
        dict: {'success': bool}
    
    Raises:
        TypeError: batch 参数类型错误
        IntegrityError: 数据完整性错误
        OperationalError: 数据库操作错误
        DatabaseError: 其他数据库错误
    
    Note:
        此函数不包含重试逻辑，由外层 _save_batch_with_retry 负责重试
    
    Strategy:
        使用 bulk_create + ignore_conflicts
        - 新记录：插入
        - 重复记录：忽略（不更新）
    """
    from apps.asset.dtos.snapshot import HostPortMappingSnapshotDTO
    
    # 参数验证
    if not isinstance(batch, list):
        raise TypeError(f"batch 必须是 list 类型，实际: {type(batch).__name__}")
    
    if not batch:
        logger.debug("批次 %d 为空，跳过处理", batch_num)
        return {'success': True}
    
    # 构建 DTO 列表（包含完整的业务上下文）
    items = [
        HostPortMappingSnapshotDTO(
            scan_id=scan_id,
            target_id=target_id,  # 包含 target_id 用于同步到资产表
            host=record['host'],
            ip=record['ip'],
            port=record['port']
        )
        for record in batch
    ]
    
    # 调用 Service 统一处理（保存快照 + 同步资产）
    # DTO 已包含 target_id，无需额外传参
    services.snapshot.save_and_sync(items)
    
    logger.debug("批次 %d: 已处理 %d 条记录", batch_num, len(batch))
    
    return {'success': True}

def _parse_and_validate_line(line: str) -> Optional[PortScanRecord]:
    """
    解析并验证单行 JSON 数据
    
    Args:
        line: 单行输出数据
    
    Returns:
        Optional[PortScanRecord]: 有效的端口扫描记录，或 None 如果验证失败
    
    验证步骤：
        1. 解析 JSON 格式
        2. 验证数据类型为字典
        3. 提取必要字段（host, ip, port）
        4. 验证字段不为空
        5. 验证端口号有效性
    """
    try:
        # 步骤 1: 解析 JSON
        try:
            line_data = json.loads(line)
        except json.JSONDecodeError:
            logger.info("跳过非 JSON 行: %s", line)
            return None
        
        # 步骤 2: 验证数据类型
        if not isinstance(line_data, dict):
            logger.info("跳过非字典数据")
            return None
        
        # 步骤 3: 提取必要字段
        host = line_data.get('host', '').strip()
        ip = line_data.get('ip', '').strip()
        port = line_data.get('port')
        
        logger.debug("解析到的主机名: %s, IP: %s, 端口: %s", host, ip, port)

        if not host and ip:
            host = ip
            logger.debug("主机名为空，使用 IP 作为 host")


        # 步骤 4: 验证字段不为空
        if not host or not ip or port is None:
            logger.info("跳过缺少必要字段的记录")
            return None
        
        # 步骤 5: 验证端口号有效性
        is_valid, port_num = validate_port(port)
        if not is_valid:
            return None
        
        # 返回有效记录
        return {
            'host': host,
            'ip': ip,
            'port': port_num,
        }
    
    except Exception:
        logger.info("跳过无法解析的行: %s", line[:100])
        return None


def _parse_naabu_stream_output(
    cmd: str,
    tool_name: str,
    cwd: Optional[str] = None,
    shell: bool = False,
    timeout: Optional[int] = None,
    log_file: Optional[str] = None
) -> Generator[PortScanRecord, None, None]:
    """
    流式解析 naabu 端口扫描命令输出
    
    基于 stream_command 实时处理 naabu 命令的 stdout，将每行 JSON 输出
    转换为 PortScanRecord 格式，沿用现有字段校验逻辑
    
    Args:
        cmd: naabu 端口扫描命令（如: "naabu -l domains.txt -json"）
        tool_name: 工具名称（如: "naabu"）
        cwd: 工作目录
        shell: 是否使用 shell 执行
        timeout: 命令执行超时时间（秒），None 表示不设置超时
        log_file: 日志文件路径（可选）
    
    Yields:
        PortScanRecord: 每次 yield 一条解析后的端口记录，格式：
        {
            'host': str,   # 域名
            'ip': str,     # IP地址  
            'port': int,   # 端口号
        }
    """
    logger.info("开始流式解析 naabu 端口扫描命令输出 - 命令: %s", cmd)
    
    total_lines = 0
    error_lines = 0
    last_log_time = time.time()  # 添加：记录上次日志时间
    
    try:
        # 使用 execute_stream 获取实时输出流（带工具名、超时控制和日志文件）
        for line in execute_stream(cmd=cmd, tool_name=tool_name, cwd=cwd, shell=shell, timeout=timeout, log_file=log_file):
            total_lines += 1
            
            try:
                # 解析并验证单行数据
                record = _parse_and_validate_line(line)
                if record is None:
                    error_lines += 1
                    continue
                
                # yield 一条有效记录
                yield record
                
                # 添加：每100条记录输出一次处理速度统计
                if total_lines % 100 == 0:
                    current_time = time.time()
                    elapsed = current_time - last_log_time
                    logger.info(
                        "流式处理进度 - 已处理: %d 行, 有效记录: %d, 错误: %d, 速度: %.1f 行/秒",
                        total_lines, total_lines - error_lines, error_lines, 100 / elapsed if elapsed > 0 else 0
                    )
                    last_log_time = current_time
            
            except (json.JSONDecodeError, ValueError, KeyError):
                # 数据解析错误（可恢复）：记录信息但继续处理后续数据
                error_lines += 1
                logger.info("跳过无法解析的行: %s", line)
                continue
                
    except subprocess.TimeoutExpired as e:
        # 超时异常：简洁输出，不显示堆栈
        error_msg = f"流式解析命令输出超时 - 命令执行超过 {timeout} 秒"
        logger.warning(error_msg)  # 超时是可预期的
        raise RuntimeError(error_msg) from e
    
    except (IOError, OSError) as e:
        # IO错误（致命）：无法继续读取数据流
        logger.error("流式解析IO错误: %s", e, exc_info=True)
        raise RuntimeError(f"流式解析IO错误: {e}") from e
    
    except (BrokenPipeError, ConnectionError) as e:
        # 连接错误（致命）：进程异常终止或管道断开
        logger.error("流式解析连接错误（进程可能异常终止）: %s", e, exc_info=True)
        raise RuntimeError(f"流式解析连接错误: {e}") from e
    
    except Exception as e:
        # 未预期的异常：输出详细堆栈以便调试
        logger.error(
            "流式解析命令输出失败（未预期的异常）: %s",
            e, exc_info=True
        )
        raise
    
    logger.info(
        "流式解析完成 - 总行数: %d, 错误行数: %d", 
        total_lines, error_lines,
    )


def _validate_task_parameters(cmd: str, target_id: int, scan_id: int, cwd: Optional[str]) -> None:
    """
    验证任务参数的有效性
    
    Args:
        cmd: 扫描命令
        target_id: 目标ID
        scan_id: 扫描ID
        cwd: 工作目录
        
    Raises:
        ValueError: 参数验证失败
    """
    if not cmd or not cmd.strip():
        raise ValueError("扫描命令不能为空")
    
    if target_id is None:
        raise ValueError("target_id 不能为 None，必须指定目标ID")
        
    if scan_id is None:
        raise ValueError("scan_id 不能为 None，必须指定扫描ID")
    
    # 验证工作目录（如果指定）
    if cwd and not Path(cwd).exists():
        raise ValueError(f"工作目录不存在: {cwd}")


def _accumulate_batch_stats(total_stats: dict, batch_result: dict) -> None:
    """
    累加批次统计信息
    
    Args:
        total_stats: 总统计信息字典
        batch_result: 批次结果字典
    """
    total_stats['created_ips'] += batch_result.get('created_ips', 0)
    total_stats['created_ports'] += batch_result.get('created_ports', 0)
    total_stats['skipped_no_subdomain'] += batch_result.get('skipped_no_subdomain', 0)
    total_stats['skipped_no_ip'] += batch_result.get('skipped_no_ip', 0)


def _process_batch(
    batch: list,
    scan_id: int,
    target_id: int,
    batch_num: int,
    total_stats: dict,
    failed_batches: list,
    services: ServiceSet
) -> None:
    """
    处理单个批次
    
    Args:
        batch: 数据批次
        scan_id: 扫描ID
        target_id: 目标ID
        batch_num: 批次编号
        total_stats: 总统计信息
        failed_batches: 失败批次列表
        services: Service 集合（必须，依赖注入）
    """
    result = _save_batch_with_retry(
        batch, scan_id, target_id, batch_num, services
    )
    
    # 累计统计信息（失败时可能有部分数据已保存）
    _accumulate_batch_stats(total_stats, result)
    
    if not result['success']:
        failed_batches.append(batch_num)
        logger.warning(
            "批次 %d 保存失败，但已累计统计信息：创建IP=%d, 创建端口=%d",
            batch_num, result.get('created_ips', 0), result.get('created_ports', 0)
        )


def _process_records_in_batches(
    data_generator,
    scan_id: int,
    target_id: int,
    batch_size: int,
    services: ServiceSet
) -> dict:
    """
    流式处理记录并分批保存
    
    Args:
        data_generator: 数据生成器
        scan_id: 扫描ID
        target_id: 目标ID
        batch_size: 批次大小
        services: Service 集合（必须，依赖注入）
        
    Returns:
        dict: 处理统计信息
        
    Raises:
        RuntimeError: 存在失败批次时抛出
        subprocess.TimeoutExpired: 命令执行超时（部分数据已保存）
    
    Note:
        如果发生超时，已处理的数据会被保留在数据库中，
        但扫描任务会被标记为失败。这是预期行为。
    """
    total_records = 0
    batch_num = 0
    failed_batches = []
    batch = []
    cancel_check_interval = 50  # 每处理50条检查一次取消信号
    
    # 统计信息
    total_stats = {
        'created_ips': 0,
        'created_ports': 0,
        'skipped_no_subdomain': 0,
        'skipped_no_ip': 0
    }
    
    # 流式读取生成器并分批保存
    # 注意：如果超时，subprocess.TimeoutExpired 会从 data_generator 中抛出
    # 此时已处理的数据已经保存到数据库
    for record in data_generator:
        # 周期性检查取消信号，协作式终止
        if cancel_check_interval > 0 and (total_records % cancel_check_interval == 0):
            _raise_if_cancelled(scan_id)

        batch.append(record)
        total_records += 1
        
        # 达到批次大小，执行保存
        if len(batch) >= batch_size:
            batch_num += 1
            _process_batch(batch, scan_id, target_id, batch_num, total_stats, failed_batches, services)
            batch = []  # 清空批次
            
            # 每20个批次输出进度
            if batch_num % 20 == 0:
                logger.info("进度: 已处理 %d 批次，%d 条记录", batch_num, total_records)
    
    # 保存最后一批
    if batch:
        batch_num += 1
        _process_batch(batch, scan_id, target_id, batch_num, total_stats, failed_batches, services)

    # 最后再检查一次取消信号，避免在尾部卡住
    _raise_if_cancelled(scan_id)
    
    # 检查失败批次
    if failed_batches:
        error_msg = (
            f"流式保存端口扫描结果时出现失败批次，处理记录: {total_records}，"
            f"失败批次: {failed_batches}"
        )
        logger.warning(error_msg)  # 超时是可预期的
        raise RuntimeError(error_msg)
    
    return {
        'processed_records': total_records,
        'batch_count': batch_num,
        **total_stats
    }


def _build_final_result(stats: dict) -> dict:
    """
    构建最终结果并输出日志
    
    Args:
        stats: 处理统计信息
        
    Returns:
        dict: 最终结果
    """
    logger.info(
        "✓ 流式保存完成 - 处理记录: %d（%d 批次），创建IP: %d，创建端口: %d，跳过（无域名）: %d，跳过（无IP）: %d",
        stats['processed_records'], stats['batch_count'], stats['created_ips'], stats['created_ports'], 
        stats['skipped_no_subdomain'], stats['skipped_no_ip']
    )
    
    # 如果没有创建任何记录，给出明确提示
    if stats['created_ips'] == 0 and stats['created_ports'] == 0:
        logger.warning(
            "⚠️  没有创建任何记录！可能原因：1) 域名不在数据库中 2) 命令输出格式问题 3) 重复数据被忽略"
        )
    
    return {
        'processed_records': stats['processed_records'],
        'created_ips': stats['created_ips'],
        'created_ports': stats['created_ports'],
        'skipped_no_subdomain': stats['skipped_no_subdomain'],
        'skipped_no_ip': stats['skipped_no_ip']
    }


def _cleanup_resources(data_generator) -> None:
    """
    清理任务资源
    
    Args:
        data_generator: 数据生成器（可以为 None）
    
    Note:
        此函数设计为幂等且安全：
        - 可以多次调用
        - 接受 None 值
        - 捕获所有异常，不会导致 finally 块失败
    """
    # 确保生成器被正确关闭
    if data_generator is None:
        logger.debug("数据生成器为 None，无需清理")
        return
    
    try:
        data_generator.close()
        logger.debug("✓ 已成功关闭数据生成器")
    except StopIteration:
        # 生成器已经正常结束，这是预期行为
        logger.debug("数据生成器已正常结束")
    except GeneratorExit:
        # 生成器已经被关闭，这是预期行为
        logger.debug("数据生成器已被关闭")
    except Exception as gen_close_error:
        # 未预期的错误：记录但不抛出，避免掩盖原始异常
        logger.error(
            "⚠️ 关闭生成器时出错（此错误不会影响任务结果）: %s",
            gen_close_error,
            exc_info=True
        )


@task(
    name='run_and_stream_save_ports',
    retries=0,
    log_prints=True
)
def run_and_stream_save_ports_task(
    cmd: str,
    tool_name: str,
    scan_id: int,
    target_id: int,
    cwd: Optional[str] = None,
    shell: bool = False,
    batch_size: int = 1000,
    timeout: Optional[int] = None,
    log_file: Optional[str] = None
) -> dict:
    """
    执行端口扫描命令并流式保存结果到数据库
    
    该任务将：
    1. 验证输入参数
    2. 初始化资源（缓存、生成器）
    3. 流式处理记录并分批保存
    4. 构建并返回结果统计
    
    Args:
        cmd: 端口扫描命令（如: "naabu -l domains.txt -json"）
        tool_name: 工具名称（如: "naabu"）
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        cwd: 工作目录（可选）
        shell: 是否使用 shell 执行（默认 False）
        batch_size: 批量保存大小（默认1000）
        timeout: 命令执行超时时间（秒），None 表示不设置超时
        log_file: 日志文件路径（可选）
    
    Returns:
        dict: {
            'processed_records': int,  # 处理的记录总数
            'created_ips': int,        # 创建的IP记录数
            'created_ports': int,      # 创建的端口记录数
            'skipped_no_subdomain': int,  # 因域名不存在跳过的记录数
            'skipped_no_ip': int,      # 因IP不存在跳过的记录数
        }
    
    Raises:
        ValueError: 参数验证失败
        RuntimeError: 命令执行或数据库操作失败
        subprocess.TimeoutExpired: 命令执行超时
    
    Performance:
        - 流式处理，实时解析命令输出
        - 内存占用恒定（只存储一个 batch）
        - 复用现有的批次保存和重试逻辑
        - 使用事务确保数据一致性
    """
    logger.info(
        "开始执行流式端口扫描任务 - target_id=%s, 超时=%s秒, 命令: %s", 
        target_id, timeout if timeout else '无限制', cmd
    )
    
    data_generator = None
    
    try:
        # 1. 验证参数
        _validate_task_parameters(cmd, target_id, scan_id, cwd)
        
        # 2. 初始化资源
        data_generator = _parse_naabu_stream_output(cmd, tool_name, cwd, shell, timeout, log_file)
        services = ServiceSet.create_default()
        
        # 3. 流式处理记录并分批保存
        stats = _process_records_in_batches(
            data_generator, scan_id, target_id, batch_size, services
        )
        
        # 4. 构建最终结果
        return _build_final_result(stats)
    
    except CancelledError:
        # Prefect 取消信号：终止任务并标记为取消（让上层 handler 触发状态更新）
        logger.warning(
            "⚠️ 端口扫描任务检测到取消信号，正在终止 - scan_id=%s, target_id=%s",
            scan_id, target_id
        )
        raise

    except subprocess.TimeoutExpired:
        # 超时异常：部分数据已保存，但扫描未完成
        # 这是预期行为：流式处理会实时保存已解析的数据
        logger.warning(
            "⚠️ 端口扫描任务超时 - target_id=%s, 超时=%s秒\n"
            "注意：超时前已解析的数据已保存到数据库，但扫描未完全完成。\n"
            "建议：增加超时时间或减少扫描目标数量。",
            target_id, timeout
        )
        raise  # 直接重新抛出，保留异常类型
    
    except Exception as e:
        error_msg = f"流式执行端口扫描任务失败: {e}"
        logger.error(error_msg, exc_info=True)
        raise RuntimeError(error_msg) from e
    
    finally:
        # 5. 清理资源
        _cleanup_resources(data_generator)


def _raise_if_cancelled(scan_id: int) -> None:
    """检测扫描是否已请求取消，若已取消则抛出 CancelledError 以触发 Prefect 取消流程。"""
    status = Scan.objects.filter(id=scan_id).values_list("status", flat=True).first()
    if status == ScanStatus.CANCELLED:
        logger.warning("检测到取消信号，终止端口扫描 - scan_id=%s", scan_id)
        raise CancelledError()
