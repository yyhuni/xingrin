"""
基于 execute_stream 的流式 URL 验证任务

主要功能：
    1. 实时执行 httpx 命令验证 URL 存活
    2. 流式处理命令输出，解析存活的 URL
    3. 批量保存到数据库（Endpoint 表）
    4. 避免一次性加载所有 URL 到内存

数据流向：
    httpx 命令执行 → 流式输出 → 实时解析 → 批量保存 → Endpoint 表
    
优化策略：
    - 使用 execute_stream 实时处理输出
    - 流式处理避免内存溢出
    - 批量操作减少数据库交互
    - 只保存存活的 URL（status 2xx/3xx）
"""

import logging
import json
import subprocess
import time
from pathlib import Path
from prefect import task
from typing import Generator, Optional
from django.db import IntegrityError, OperationalError, DatabaseError
from psycopg2 import InterfaceError
from dataclasses import dataclass

from apps.asset.services.snapshot import EndpointSnapshotsService
from apps.scan.utils import execute_stream

logger = logging.getLogger(__name__)


@dataclass
class ServiceSet:
    """
    Service 集合，用于依赖注入
    
    提供 URL 验证所需的 Service 实例
    """
    snapshot: EndpointSnapshotsService
    
    @classmethod
    def create_default(cls) -> "ServiceSet":
        """创建默认的 Service 集合"""
        return cls(
            snapshot=EndpointSnapshotsService()
        )


def _sanitize_string(value: str) -> str:
    """
    清理字符串中的 NUL 字符和其他不可打印字符
    
    PostgreSQL 不允许字符串字段包含 NUL (0x00) 字符
    """
    if not value:
        return value
    # 移除 NUL 字符
    return value.replace('\x00', '')


def _parse_and_validate_line(line: str) -> Optional[dict]:
    """
    解析并验证单行 httpx JSON 输出
    
    Args:
        line: 单行输出数据
    
    Returns:
        Optional[dict]: 有效的 httpx 记录，或 None 如果验证失败
        
    只返回存活的 URL（2xx/3xx 状态码）
    """
    try:
        # 清理 NUL 字符后再解析 JSON
        line = _sanitize_string(line)
        
        # 解析 JSON
        try:
            line_data = json.loads(line)
        except json.JSONDecodeError:
            logger.info("跳过非 JSON 行: %s", line)
            return None
        
        # 验证数据类型
        if not isinstance(line_data, dict):
            logger.info("跳过非字典数据")
            return None
        
        # 获取必要字段
        url = line_data.get('url', '').strip()
        status_code = line_data.get('status_code')
        
        if not url:
            logger.info("URL 为空，跳过 - 数据: %s", str(line_data)[:200])
            return None
        
        # 只保存存活的 URL（2xx 或 3xx）
        if status_code and (200 <= status_code < 400):
            return {
                'url': _sanitize_string(url),
                'host': _sanitize_string(line_data.get('host', '')),
                'status_code': status_code,
                'title': _sanitize_string(line_data.get('title', '')),
                'content_length': line_data.get('content_length', 0),
                'content_type': _sanitize_string(line_data.get('content_type', '')),
                'webserver': _sanitize_string(line_data.get('webserver', '')),
                'location': _sanitize_string(line_data.get('location', '')),
                'tech': line_data.get('tech', []),
                'body_preview': _sanitize_string(line_data.get('body_preview', '')),
                'vhost': line_data.get('vhost', False),
            }
        else:
            logger.debug("URL 不存活（状态码: %s），跳过: %s", status_code, url)
            return None
    
    except Exception:
        logger.info("跳过无法解析的行: %s", line[:100] if line else 'empty')
        return None


def _parse_httpx_stream_output(
    cmd: str,
    tool_name: str,
    cwd: Optional[str] = None,
    shell: bool = False,
    timeout: Optional[int] = None,
    log_file: Optional[str] = None
) -> Generator[dict, None, None]:
    """
    流式解析 httpx 命令输出
    
    Args:
        cmd: httpx 命令
        tool_name: 工具名称（'httpx'）
        cwd: 工作目录
        shell: 是否使用 shell 执行
        timeout: 命令执行超时时间（秒）
        log_file: 日志文件路径
    
    Yields:
        dict: 每次 yield 一条存活的 URL 记录
    """
    logger.info("开始流式解析 httpx 输出 - 命令: %s", cmd)
    
    total_lines = 0
    error_lines = 0
    valid_records = 0
    
    try:
        # 使用 execute_stream 获取实时输出流
        for line in execute_stream(
            cmd=cmd, 
            tool_name=tool_name, 
            cwd=cwd, 
            shell=shell, 
            timeout=timeout, 
            log_file=log_file
        ):
            total_lines += 1
            
            # 解析并验证单行数据
            record = _parse_and_validate_line(line)
            if record is None:
                error_lines += 1
                continue
            
            valid_records += 1
            # yield 一条有效记录（存活的 URL）
            yield record
            
            # 每处理 500 条记录输出一次进度
            if valid_records % 500 == 0:
                logger.info("已解析 %d 条存活的 URL...", valid_records)
                
    except subprocess.TimeoutExpired as e:
        error_msg = f"流式解析命令输出超时 - 命令执行超过 {timeout} 秒"
        logger.warning(error_msg)  # 超时是可预期的，使用 warning 级别
        raise RuntimeError(error_msg) from e
    except Exception as e:
        logger.error("流式解析命令输出失败: %s", e, exc_info=True)
        raise
    
    logger.info(
        "流式解析完成 - 总行数: %d, 存活 URL: %d, 无效/死链: %d", 
        total_lines, valid_records, error_lines
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
    保存一个批次的 URL（带重试机制）
    
    Args:
        batch: 数据批次
        scan_id: 扫描任务ID
        target_id: 目标ID
        batch_num: 批次编号
        services: Service 集合
        max_retries: 最大重试次数
    
    Returns:
        dict: {'success': bool, 'saved_count': int}
    """
    for attempt in range(max_retries):
        try:
            count = _save_batch(batch, scan_id, target_id, batch_num, services)
            return {
                'success': True,
                'saved_count': count
            }

        except IntegrityError as e:
            # 唯一约束等数据完整性错误通常意味着重复数据，这里记录错误但不让整个扫描失败
            logger.error("批次 %d 数据完整性错误，跳过: %s", batch_num, str(e)[:100])
            return {
                'success': False,
                'saved_count': 0
            }

        except (OperationalError, DatabaseError, InterfaceError) as e:
            # 数据库级错误（连接中断、表结构不匹配等）：按指数退避重试，最终失败时抛出异常让 Flow 失败
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(
                    "批次 %d 保存失败（第 %d 次尝试），%d秒后重试: %s",
                    batch_num, attempt + 1, wait_time, str(e)[:100]
                )
                time.sleep(wait_time)
            else:
                logger.error(
                    "批次 %d 保存失败（已重试 %d 次），将终止任务: %s",
                    batch_num,
                    max_retries,
                    e,
                    exc_info=True,
                )
                # 让上层 Task 感知失败，从而标记整个扫描为失败
                raise

        except Exception as e:
            # 其他未知异常也不再吞掉，直接抛出以便 Flow 标记为失败
            logger.error("批次 %d 未知错误: %s", batch_num, e, exc_info=True)
            raise

    # 理论上不会走到这里，保留兜底返回值以满足类型约束
    return {
        'success': False,
        'saved_count': 0
    }


def _save_batch(
    batch: list,
    scan_id: int,
    target_id: int,
    batch_num: int,
    services: ServiceSet
) -> int:
    """
    保存一个批次的数据到数据库
    
    Args:
        batch: 数据批次，list of dict
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        batch_num: 批次编号
        services: Service 集合
    
    Returns:
        int: 创建的记录数
    """
    if not batch:
        logger.debug("批次 %d 为空，跳过处理", batch_num)
        return 0
    
    # 批量构造 Endpoint 快照 DTO
    from apps.asset.dtos.snapshot import EndpointSnapshotDTO
    
    snapshots = []
    for record in batch:
        try:
            dto = EndpointSnapshotDTO(
                scan_id=scan_id,
                url=record['url'],
                host=record.get('host', ''),
                title=record.get('title', ''),
                status_code=record.get('status_code'),
                content_length=record.get('content_length', 0),
                location=record.get('location', ''),
                webserver=record.get('webserver', ''),
                content_type=record.get('content_type', ''),
                tech=record.get('tech', []),
                body_preview=record.get('body_preview', ''),
                vhost=record.get('vhost', False),
                matched_gf_patterns=[],
                target_id=target_id,
            )
            snapshots.append(dto)
        except Exception as e:
            logger.error("处理记录失败: %s，错误: %s", record.get('url', 'Unknown'), e)
            continue
    
    if snapshots:
        try:
            # 通过快照服务统一保存快照并同步到资产表
            services.snapshot.save_and_sync(snapshots)
            count = len(snapshots)
            logger.info(
                "批次 %d: 保存了 %d 个存活的 URL（共 %d 个）",
                batch_num, count, len(batch)
            )
            return count
        except Exception as e:
            logger.error("批次 %d 批量保存失败: %s", batch_num, e)
            raise
    
    return 0


def _process_records_in_batches(
    data_generator,
    scan_id: int,
    target_id: int,
    batch_size: int,
    services: ServiceSet
) -> dict:
    """
    分批处理记录并保存到数据库
    
    Args:
        data_generator: 数据生成器
        scan_id: 扫描ID
        target_id: 目标ID
        batch_size: 批次大小
        services: Service 集合
        
    Returns:
        dict: 处理统计结果
    """
    batch = []
    batch_num = 0
    total_records = 0
    total_saved = 0
    failed_batches = []
    
    for record in data_generator:
        batch.append(record)
        total_records += 1
        
        # 达到批次大小，执行保存
        if len(batch) >= batch_size:
            batch_num += 1
            result = _save_batch_with_retry(
                batch, scan_id, target_id, batch_num, services
            )
            
            if result['success']:
                total_saved += result['saved_count']
            else:
                failed_batches.append(batch_num)
            
            batch = []  # 清空批次
            
            # 每 10 个批次输出进度
            if batch_num % 10 == 0:
                logger.info(
                    "进度: 已处理 %d 批次，%d 条记录，保存 %d 条",
                    batch_num, total_records, total_saved
                )
    
    # 保存最后一批
    if batch:
        batch_num += 1
        result = _save_batch_with_retry(
            batch, scan_id, target_id, batch_num, services
        )
        
        if result['success']:
            total_saved += result['saved_count']
        else:
            failed_batches.append(batch_num)
    
    return {
        'processed_records': total_records,
        'saved_urls': total_saved,
        'failed_urls': total_records - total_saved,
        'batch_count': batch_num,
        'failed_batches': failed_batches
    }


@task(name="run_and_stream_save_urls", retries=3, retry_delay_seconds=10)
def run_and_stream_save_urls_task(
    cmd: str,
    tool_name: str,
    scan_id: int,
    target_id: int,
    cwd: Optional[str] = None,
    shell: bool = False,
    batch_size: int = 500,
    timeout: Optional[int] = None,
    log_file: Optional[str] = None
) -> dict:
    """
    执行 httpx 验证并流式保存存活的 URL
    
    该任务将：
    1. 执行 httpx 命令验证 URL 存活
    2. 流式处理输出，实时解析
    3. 批量保存存活的 URL 到 Endpoint 表
    
    Args:
        cmd: httpx 命令
        tool_name: 工具名称（'httpx'）
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        cwd: 工作目录
        shell: 是否使用 shell 执行
        batch_size: 批次大小（默认 500）
        timeout: 超时时间（秒）
        log_file: 日志文件路径
    
    Returns:
        dict: {
            'processed_records': int,  # 处理的记录总数
            'saved_urls': int,         # 保存的存活 URL 数
            'failed_urls': int,        # 失败/死链数
            'batch_count': int,        # 批次数
            'failed_batches': list     # 失败的批次号
        }
    """
    logger.info(
        "开始执行流式 URL 验证任务 - target_id=%s, 超时=%s秒, 命令: %s",
        target_id, timeout if timeout else '无限制', cmd
    )
    
    data_generator = None
    
    try:
        # 1. 初始化资源
        data_generator = _parse_httpx_stream_output(
            cmd, tool_name, cwd, shell, timeout, log_file
        )
        services = ServiceSet.create_default()
        
        # 2. 流式处理记录并分批保存
        stats = _process_records_in_batches(
            data_generator, scan_id, target_id, batch_size, services
        )
        
        # 3. 输出最终统计
        logger.info(
            "✓ URL 验证任务完成 - 处理: %d, 存活: %d, 失败: %d",
            stats['processed_records'],
            stats['saved_urls'],
            stats['failed_urls']
        )
        
        return stats
        
    except subprocess.TimeoutExpired:
        logger.warning(
            "⚠️ URL 验证任务超时 - target_id=%s, 超时=%s秒",
            target_id, timeout
        )
        raise
    
    except Exception as e:
        error_msg = f"流式执行 URL 验证任务失败: {e}"
        logger.error(error_msg, exc_info=True)
        raise RuntimeError(error_msg) from e
    
    finally:
        # 清理资源
        if data_generator is not None:
            try:
                # 确保生成器被正确关闭
                data_generator.close()
            except (GeneratorExit, StopIteration):
                pass
            except Exception as e:
                logger.warning("关闭数据生成器时出错: %s", e)
