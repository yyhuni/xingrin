"""
基于 execute_stream 的流式站点扫描任务

主要功能：
    1. 实时执行站点扫描命令（httpx）
    2. 流式处理命令输出，实时解析为 HttpxRecord
    3. 批量保存到数据库，复用现有的字段校验与统计逻辑
    4. 避免生成大量临时文件，提高效率

数据流向：
    命令执行 → 流式输出 → 实时解析 → 批量保存 → 数据库
    
    输入：扫描命令及参数
    输出：WebSite 记录

优化策略：
    - 使用 execute_stream 实时处理输出
    - 复用现有的 _save_batch_with_retry 逻辑
    - 流式处理避免内存溢出
    - 批量操作减少数据库交互
"""

import logging
import json
import subprocess
import time
from pathlib import Path
from prefect import task
from typing import Generator, Optional, Dict, Any, TYPE_CHECKING
from django.db import IntegrityError, OperationalError, DatabaseError
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse
from dateutil.parser import parse as parse_datetime
from psycopg2 import InterfaceError

from apps.asset.dtos.snapshot import WebsiteSnapshotDTO

from apps.scan.utils import execute_stream

# 类型检查时导入，运行时不导入（避免循环依赖）
if TYPE_CHECKING:
    from apps.asset.services.snapshot import WebsiteSnapshotsService

logger = logging.getLogger(__name__)


@dataclass
class ServiceSet:
    """
    Service 集合，用于依赖注入
    
    提供所有需要的 Service 实例，便于测试时注入 Mock 对象
    """
    snapshot: "WebsiteSnapshotsService"
    
    @classmethod
    def create_default(cls) -> 'ServiceSet':
        """创建默认的 Service 集合"""
        from apps.asset.services.snapshot import WebsiteSnapshotsService
        return cls(
            snapshot=WebsiteSnapshotsService()
        )


def normalize_url(url: str) -> str:
    """
    标准化 URL，移除默认端口号
    
    处理规则：
    - HTTPS 协议的 443 端口 → 移除端口号
    - HTTP 协议的 80 端口 → 移除端口号
    - 其他端口 → 保留端口号
    
    Args:
        url: 原始 URL（如 https://www.example.com:443）
    
    Returns:
        str: 标准化后的 URL（如 https://www.example.com）
    
    Examples:
        >>> normalize_url('https://www.example.com:443')
        'https://www.example.com'
        >>> normalize_url('http://www.example.com:80')
        'http://www.example.com'
        >>> normalize_url('https://www.example.com:8443')
        'https://www.example.com:8443'
    """
    try:
        parsed = urlparse(url)
        
        # 检查是否需要移除端口号
        should_remove_port = (
            (parsed.scheme == 'https' and parsed.port == 443) or
            (parsed.scheme == 'http' and parsed.port == 80)
        )
        
        if should_remove_port:
            # 重建 URL，不包含端口号
            # netloc 可能是 'domain:port' 格式，需要只保留 hostname
            netloc = parsed.hostname or parsed.netloc.split(':')[0]
            normalized = urlunparse((
                parsed.scheme,
                netloc,
                parsed.path,
                parsed.params,
                parsed.query,
                parsed.fragment
            ))
            return normalized
        
        # 不需要修改，返回原 URL
        return url
        
    except Exception as e:
        # 解析失败，返回原 URL
        logger.debug("URL 标准化失败: %s，使用原始 URL: %s", e, url)
        return url


class HttpxRecord:
    """httpx 扫描记录数据类"""
    
    def __init__(self, data: Dict[str, Any]):
        self.url = data.get('url', '')
        self.input = data.get('input', '')
        self.title = data.get('title', '')
        self.status_code = data.get('status_code')
        self.content_length = data.get('content_length')
        self.content_type = data.get('content_type', '')
        self.location = data.get('location', '')
        self.webserver = data.get('webserver', '')
        self.body_preview = data.get('body_preview', '')
        self.tech = data.get('tech', [])
        self.vhost = data.get('vhost')
        self.failed = data.get('failed', False)
        self.timestamp = data.get('timestamp')
        
        # 从 URL 中提取主机名
        self.host = self._extract_hostname()
    
    def _extract_hostname(self) -> str:
        """
        从 URL 或 input 字段提取主机名
        
        优先级：
        1. 使用 urlparse 解析 URL 获取 hostname
        2. 从 input 字段提取（处理可能包含协议的情况）
        3. 从 URL 字段手动提取（降级方案）
        
        Returns:
            str: 提取的主机名（小写）
        """
        try:
            # 方法 1: 使用 urlparse 解析 URL
            if self.url:
                parsed = urlparse(self.url)
                if parsed.hostname:
                    return parsed.hostname
            
            # 方法 2: 从 input 字段提取
            if self.input:
                host = self.input.strip().lower()
                # 移除协议前缀
                if host.startswith(('http://', 'https://')):
                    host = host.split('//', 1)[1].split('/')[0]
                return host
            
            # 方法 3: 从 URL 手动提取（降级方案）
            if self.url:
                return self.url.replace('http://', '').replace('https://', '').split('/')[0]
            
            # 兜底：返回空字符串
            return ''
            
        except Exception as e:
            # 异常处理：尽力从 input 或 URL 提取
            logger.debug("提取主机名失败: %s，使用降级方案", e)
            if self.input:
                return self.input.strip().lower()
            if self.url:
                return self.url.replace('http://', '').replace('https://', '').split('/')[0]
            return ''


def _save_batch_with_retry(
    batch: list,
    scan_id: int,
    target_id: int,
    batch_num: int,
    services: ServiceSet,
    max_retries: int = 3
) -> dict:
    """
    保存一个批次的数据（带重试机制）
    
    Args:
        batch: 要保存的记录批次
        scan_id: 扫描任务ID
        target_id: 目标ID
        batch_num: 批次编号
        services: Service 集合（必须，依赖注入）
        max_retries: 最大重试次数
    
    Returns:
        dict: {
            'success': bool,
            'created_websites': int,
            'skipped_failed': int
        }
    """
    for attempt in range(max_retries):
        try:
            stats = _save_batch(batch, scan_id, target_id, batch_num, services)
            return {
                'success': True,
                'created_websites': stats.get('created_websites', 0),
                'skipped_failed': stats.get('skipped_failed', 0)
            }
        
        except IntegrityError as e:
            # 数据完整性错误，不应重试（IntegrityError 是 DatabaseError 的子类，需先处理）
            logger.error("批次 %d 数据完整性错误，跳过: %s", batch_num, str(e)[:100])
            return {
                'success': False,
                'created_websites': 0,
                'skipped_failed': 0
            }
        
        except (OperationalError, DatabaseError, InterfaceError) as e:
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
                return {
                    'success': False,
                    'created_websites': 0,
                    'skipped_failed': 0
                }
        
        except Exception as e:
            # 其他未知错误 - 检查是否为连接问题
            error_str = str(e).lower()
            if 'connection' in error_str and attempt < max_retries - 1:
                logger.warning(
                    "批次 %d 连接相关错误（尝试 %d/%d）: %s，Repository 装饰器会自动重连",
                    batch_num, attempt + 1, max_retries, str(e)
                )
                time.sleep(2)
            else:
                logger.error("批次 %d 未知错误: %s", batch_num, e, exc_info=True)
                return {
                    'success': False,
                    'created_websites': 0,
                    'skipped_failed': 0
                }
    
    return {
        'success': False,
        'created_websites': 0,
        'skipped_failed': 0
    }


def _save_batch(
    batch: list, 
    scan_id: int, 
    target_id: int, 
    batch_num: int, 
    services: ServiceSet
) -> dict:
    """
    保存一个批次的数据到数据库（使用快照 Service）
    
    数据关系链：
        Subdomain (已存在) → WebsiteSnapshot (待创建) → WebSite (自动同步)
    
    处理流程：
        1. 查询 Subdomain：根据域名批量查询（LRU缓存）
        2. 构建 WebsiteSnapshotDTO：包含 scan_id 和 target_id
        3. 调用快照 Service：save_and_sync() 自动保存快照并同步到资产表
    
    Args:
        batch: 数据批次，list of HttpxRecord
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        batch_num: 批次编号（用于日志）
        services: Service 集合（依赖注入）
    
    Returns:
        dict: 包含创建和跳过记录的统计信息
    
    Raises:
        TypeError: batch 参数类型错误
        IntegrityError: 数据完整性错误
        OperationalError: 数据库操作错误
        DatabaseError: 其他数据库错误
    
    Note:
        此函数不包含重试逻辑，由外层 _save_batch_with_retry 负责重试
    """
    # 参数验证
    if not isinstance(batch, list):
        raise TypeError(f"batch 必须是 list 类型，实际: {type(batch).__name__}")
    
    if not batch:
        logger.debug("批次 %d 为空，跳过处理", batch_num)
        return {
            'created_websites': 0,
            'skipped_failed': 0
        }
    
    # 统计变量
    skipped_failed = 0
    
    # ========== Step 1: 准备 WebsiteSnapshot 数据（内存操作，无需事务）==========
    snapshot_items = []
    
    for record in batch:
        # 跳过失败的请求
        if record.failed:
            skipped_failed += 1
            continue
        
        # 解析时间戳
        created_at = None
        if hasattr(record, 'timestamp') and record.timestamp:
            try:
                created_at = parse_datetime(record.timestamp)
            except (ValueError, TypeError) as e:
                logger.warning(f"无法解析时间戳 {record.timestamp}: {e}")
        
        # 使用 input 字段（原始扫描的 URL）而不是 url 字段（重定向后的 URL）
        # 原因：避免多个不同的输入 URL 重定向到同一个 URL 时产生唯一约束冲突
        # 例如：http://example.com 和 https://example.com 都重定向到 https://example.com
        # 如果使用 record.url，两条记录会有相同的 url，导致数据库冲突
        # 如果使用 record.input，两条记录保留原始输入，不会冲突
        normalized_url = normalize_url(record.input)
        
        # 提取 host 字段（域名或IP地址）
        host = record.host if record.host else ''
        
        # 创建 WebsiteSnapshot DTO
        snapshot_dto = WebsiteSnapshotDTO(
            scan_id=scan_id,
            target_id=target_id,  # 主关联字段
            url=normalized_url,  # 保存原始输入 URL（归一化后）
            host=host,  # 主机名（域名或IP地址）
            location=record.location,  # location 字段保存重定向信息
            title=record.title[:1000] if record.title else '',
            web_server=record.webserver[:200] if record.webserver else '',
            body_preview=record.body_preview[:1000] if record.body_preview else '',
            content_type=record.content_type[:200] if record.content_type else '',
            tech=record.tech if isinstance(record.tech, list) else [],
            status=record.status_code,
            content_length=record.content_length,
            vhost=record.vhost
        )
        
        snapshot_items.append(snapshot_dto)
    
    # ========== Step 3: 保存快照并同步到资产表（通过快照 Service）==========
    if snapshot_items:
        services.snapshot.save_and_sync(snapshot_items)
    
    return {
        'created_websites': len(snapshot_items),
        'skipped_failed': skipped_failed
    }

def _parse_and_validate_line(line: str) -> Optional[HttpxRecord]:
    """
    解析并验证单行 JSON 数据
    
    Args:
        line: 单行输出数据
    
    Returns:
        Optional[HttpxRecord]: 有效的 httpx 扫描记录，或 None 如果验证失败
    
    验证步骤：
        1. 解析 JSON 格式
        2. 验证数据类型为字典
        3. 创建 HttpxRecord 对象
        4. 验证必要字段（url）
    """
    try:
        # 步骤 1: 解析 JSON
        try:
            line_data = json.loads(line)
        except json.JSONDecodeError:
            # logger.debug("跳过非 JSON 格式的行: %s", line[:100])
            return None
        
        # 步骤 2: 验证数据类型
        if not isinstance(line_data, dict):
            logger.warning("解析后的数据不是字典类型，跳过: %s", str(line_data)[:100])
            return None
        
        # 步骤 3: 创建记录
        record = HttpxRecord(line_data)
        
        # 步骤 4: 验证必要字段
        if not record.url:
            logger.debug("URL 为空，跳过")
            return None
        
        # 返回有效记录
        return record
    
    except Exception as e:
        logger.error("解析行数据异常: %s - 数据: %s", e, line[:100])
        return None


def _parse_httpx_stream_output(
    cmd: str,
    tool_name: str,
    cwd: Optional[str] = None,
    shell: bool = False,
    timeout: Optional[int] = None,
    log_file: Optional[str] = None
) -> Generator[HttpxRecord, None, None]:
    """
    流式解析 httpx 站点扫描命令输出
    
    基于 execute_stream 实时处理 httpx 命令的 stdout，将每行 JSON 输出
    转换为 HttpxRecord 格式，沿用现有字段校验逻辑
    
    Args:
        cmd: httpx 站点扫描命令
        cwd: 工作目录
        shell: 是否使用 shell 执行
        timeout: 命令执行超时时间（秒），None 表示不设置超时
    
    Yields:
        HttpxRecord: 每次 yield 一条解析后的站点记录
    """
    logger.info("开始流式解析 httpx 站点扫描命令输出 - 命令: %s", cmd)
    
    total_lines = 0
    error_lines = 0
    valid_records = 0
    
    try:
        # 使用 execute_stream 获取实时输出流（带工具名、超时控制和日志文件）
        for line in execute_stream(cmd=cmd, tool_name=tool_name, cwd=cwd, shell=shell, timeout=timeout, log_file=log_file):
            total_lines += 1
            
            # 解析并验证单行数据
            record = _parse_and_validate_line(line)
            if record is None:
                error_lines += 1
                continue
            
            valid_records += 1
            # yield 一条有效记录
            yield record
            
            # 每处理 1000 条记录输出一次进度
            if valid_records % 1000 == 0:
                logger.info("已解析 %d 条有效记录...", valid_records)
                
    except subprocess.TimeoutExpired as e:
        # 超时异常：简洁输出，不显示堆栈
        error_msg = f"流式解析命令输出超时 - 命令执行超过 {timeout} 秒"
        logger.warning(error_msg)  # 超时是可预期的
        raise RuntimeError(error_msg) from e
    except Exception as e:
        # 其他异常：输出详细堆栈以便调试
        logger.error("流式解析命令输出失败: %s", e, exc_info=True)
        raise
    
    logger.info(
        "流式解析完成 - 总行数: %d, 有效记录: %d, 错误行数: %d", 
        total_lines, valid_records, error_lines
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
    total_stats['created_websites'] += batch_result.get('created_websites', 0)
    total_stats['skipped_failed'] += batch_result.get('skipped_failed', 0)


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
            "批次 %d 保存失败，但已累计统计信息：创建站点=%d",
            batch_num, result.get('created_websites', 0)
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
    """
    total_records = 0
    batch_num = 0
    failed_batches = []
    batch = []
    
    # 统计信息
    total_stats = {
        'created_websites': 0,
        'skipped_failed': 0
    }
    
    # 流式读取生成器并分批保存
    for record in data_generator:
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
    
    # 检查失败批次
    if failed_batches:
        error_msg = (
            f"流式保存站点扫描结果时出现失败批次，处理记录: {total_records}，"
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
        "✓ 流式保存完成 - 处理记录: %d（%d 批次），创建站点: %d，跳过（失败）: %d",
        stats['processed_records'], stats['batch_count'], stats['created_websites'],
        stats['skipped_failed']
    )
    
    # 如果没有创建任何记录，给出明确提示
    if stats['created_websites'] == 0:
        logger.warning(
            "⚠️  没有创建任何站点记录！可能原因：1) 域名不在数据库中 2) 命令输出格式问题 3) 重复数据被忽略 4) 所有请求都失败"
        )
    
    return {
        'processed_records': stats['processed_records'],
        'created_websites': stats['created_websites'],
        'skipped_failed': stats['skipped_failed']
    }


def _cleanup_resources(data_generator) -> None:
    """
    清理任务资源
    
    Args:
        data_generator: 数据生成器
    """
    # 注：LRUCache 是局部变量，函数结束时会自动释放，无需手动 clear()
    
    # 确保生成器被正确关闭
    if data_generator is not None:
        try:
            data_generator.close()
            logger.debug("已关闭数据生成器")
        except Exception as gen_close_error:
            logger.error("关闭生成器时出错: %s", gen_close_error)


@task(
    name='run_and_stream_save_websites',
    retries=0,
    log_prints=True
)
def run_and_stream_save_websites_task(
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
    执行 httpx 站点扫描命令并流式保存结果到数据库
    
    该任务将：
    1. 验证输入参数
    2. 初始化资源（缓存、生成器）
    3. 流式处理记录并分批保存
    4. 构建并返回结果统计
    
    Args:
        cmd: httpx 站点扫描命令
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        cwd: 工作目录（可选）
        shell: 是否使用 shell 执行（默认 False）
        batch_size: 批量保存大小（默认1000）
        timeout: 命令执行超时时间（秒），None 表示不设置超时
    
    Returns:
        dict: {
            'processed_records': int,  # 处理的记录总数
            'created_websites': int,   # 创建的站点记录数
            'skipped_failed': int,     # 因请求失败跳过的记录数
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
        "开始执行流式站点扫描任务 - target_id=%s, 超时=%s秒, 命令: %s", 
        target_id, timeout if timeout else '无限制', cmd
    )
    
    data_generator = None
    
    try:
        # 1. 验证参数
        _validate_task_parameters(cmd, target_id, scan_id, cwd)
        
        # 2. 初始化资源
        data_generator = _parse_httpx_stream_output(cmd, tool_name, cwd, shell, timeout, log_file)
        services = ServiceSet.create_default()
        
        # 3. 流式处理记录并分批保存
        stats = _process_records_in_batches(
            data_generator, scan_id, target_id, batch_size, services
        )
        
        # 4. 构建最终结果
        return _build_final_result(stats)
        
    except subprocess.TimeoutExpired:
        # 超时异常直接向上传播，保留异常类型
        logger.warning(
            "⚠️ 站点扫描任务超时 - target_id=%s, 超时=%s秒",
            target_id, timeout
        )
        raise  # 直接重新抛出，不包装
    
    except Exception as e:
        error_msg = f"流式执行站点扫描任务失败: {e}"
        logger.error(error_msg, exc_info=True)
        raise RuntimeError(error_msg) from e
    
    finally:
        # 5. 清理资源
        _cleanup_resources(data_generator)
