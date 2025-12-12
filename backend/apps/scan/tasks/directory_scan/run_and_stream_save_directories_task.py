"""
基于 execute_stream 的流式目录扫描任务

主要功能：
    1. 实时执行目录扫描命令（如 ffuf）
    2. 流式处理命令输出，实时解析为 Directory 记录
    3. 批量保存到数据库
    4. 避免生成大量临时文件，提高效率

数据流向：
    命令执行 → 流式输出 → 实时解析 → 批量保存 → 数据库
    
    输入：扫描命令及参数
    输出：Directory 记录

优化策略：
    - 使用 execute_stream 实时处理输出
    - 流式处理避免内存溢出
    - 批量操作减少数据库交互
"""

import logging
import json
import subprocess
import time
from pathlib import Path
from prefect import task
from typing import Generator, Optional, TYPE_CHECKING
from django.db import IntegrityError, OperationalError, DatabaseError
from psycopg2 import InterfaceError
from dataclasses import dataclass

from apps.asset.services import WebSiteService
from apps.asset.dtos.snapshot import DirectorySnapshotDTO
from apps.scan.utils import execute_stream

# 类型检查时导入，运行时不导入（避免循环依赖）
if TYPE_CHECKING:
    from apps.asset.services.snapshot import DirectorySnapshotsService

logger = logging.getLogger(__name__)


@dataclass
class ServiceSet:
    """
    Service 集合，用于依赖注入
    
    提供目录扫描所需的 Service 实例，便于测试时注入 Mock 对象
    """
    website: WebSiteService
    snapshot: "DirectorySnapshotsService"
    
    @classmethod
    def create_default(cls) -> "ServiceSet":
        """创建默认的 Service 集合"""
        from apps.asset.services.snapshot import DirectorySnapshotsService
        return cls(
            website=WebSiteService(),
            snapshot=DirectorySnapshotsService()
        )


def _parse_and_validate_line(line: str) -> Optional[dict]:
    """
    解析并验证单行 JSON 数据
    
    Args:
        line: 单行输出数据
    
    Returns:
        Optional[dict]: 有效的 ffuf 扫描记录，或 None 如果验证失败
    
    验证步骤：
        1. 解析 JSON 格式
        2. 验证数据类型为字典
        3. 验证必要字段（url）
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
        
        # 步骤 3: 验证必要字段
        if not line_data.get('url'):
            logger.debug("URL 为空，跳过")
            return None
        
        # 返回有效记录
        return {
            'url': line_data['url'],
            'status': line_data.get('status'),
            'length': line_data.get('length'),
            'words': line_data.get('words'),
            'lines': line_data.get('lines'),
            'content_type': line_data.get('content-type', ''),
            'duration': line_data.get('duration')
        }
    
    except Exception as e:
        logger.error("解析行数据异常: %s - 数据: %s", e, line[:100])
        return None


def _parse_ffuf_stream_output(
    cmd: str,
    tool_name: str,
    cwd: Optional[str] = None,
    shell: bool = False,
    timeout: Optional[int] = None,
    log_file: Optional[str] = None
) -> Generator[dict, None, None]:
    """
    流式解析 ffuf 目录扫描命令输出
    
    基于 execute_stream 实时处理 ffuf 命令的 stdout，将每行 JSON 输出
    转换为 Directory 记录格式
    
    Args:
        cmd: ffuf 目录扫描命令
        cwd: 工作目录
        shell: 是否使用 shell 执行
        timeout: 命令执行超时时间（秒），None 表示不设置超时
    
    Yields:
        dict: 每次 yield 一条解析后的目录记录
    """
    logger.info("开始流式解析 ffuf 目录扫描命令输出 - 命令: %s", cmd)
    
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


def _save_batch_with_retry(
    batch: list,
    website_id: int,
    scan_id: int,
    target_id: int,
    batch_num: int,
    services: ServiceSet,
    max_retries: int = 3
) -> dict:
    """
    保存一个批次的目录扫描结果（带重试机制）
    
    Args:
        batch: 数据批次
        website_id: 站点 ID
        scan_id: 扫描任务ID
        target_id: 目标ID
        batch_num: 批次编号
        services: Service 集合（必须，依赖注入）
        max_retries: 最大重试次数
    
    Returns:
        dict: {
            'success': bool,
            'created_directories': int
        }
    """
    for attempt in range(max_retries):
        try:
            count = _save_batch(batch, website_id, scan_id, target_id, batch_num, services)
            return {
                'success': True,
                'created_directories': count
            }
        
        except IntegrityError as e:
            # 数据完整性错误，不应重试
            logger.error("批次 %d 数据完整性错误，跳过: %s", batch_num, str(e)[:100])
            return {
                'success': False,
                'created_directories': 0
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
                    'created_directories': 0
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
                    'created_directories': 0
                }
    
    return {
        'success': False,
        'created_directories': 0
    }


def _save_batch(
    batch: list,
    website_id: int,
    scan_id: int,
    target_id: int,
    batch_num: int,
    services: ServiceSet
) -> int:
    """
    保存一个批次的数据到数据库（使用快照 Service）
    
    数据关系链：
        WebSite (已存在) → DirectorySnapshot (待创建) → Directory (自动同步)
    
    处理流程：
        1. 构建 DirectorySnapshotDTO：包含 scan_id 和 target_id
        2. 调用快照 Service：save_and_sync() 自动保存快照并同步到资产表
    
    Args:
        batch: 数据批次，list of dict
        website_id: 站点 ID
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        batch_num: 批次编号（用于日志）
        services: Service 集合（依赖注入）
    
    Returns:
        int: 创建的记录数
    """
    if not batch:
        logger.debug("批次 %d 为空，跳过处理", batch_num)
        return 0
    
    # ========== Step 1: 准备 DirectorySnapshot 数据（内存操作，无需事务）==========
    snapshot_items = []
    
    for record in batch:
        # 创建 DirectorySnapshot DTO
        snapshot_dto = DirectorySnapshotDTO(
            scan_id=scan_id,
            website_id=website_id,
            target_id=target_id,  # 冗余字段，用于同步到资产表
            url=record['url'],
            status=record.get('status'),
            content_length=record.get('length'),
            words=record.get('words'),
            lines=record.get('lines'),
            content_type=record.get('content_type', ''),
            duration=record.get('duration')
        )
        
        snapshot_items.append(snapshot_dto)
    
    # ========== Step 2: 保存快照并同步到资产表（通过快照 Service）==========
    if snapshot_items:
        services.snapshot.save_and_sync(snapshot_items)
    
    return len(snapshot_items)


@task(
    name='run_and_stream_save_directories',
    retries=0,
    log_prints=True
)
def run_and_stream_save_directories_task(
    cmd: str,
    tool_name: str,
    scan_id: int,
    target_id: int,
    site_url: str,
    cwd: Optional[str] = None,
    shell: bool = False,
    batch_size: int = 1000,
    timeout: Optional[int] = None,
    log_file: Optional[str] = None
) -> dict:
    """
    执行 ffuf 目录扫描命令并流式保存结果到数据库
    
    该任务将：
    1. 通过 site_url 查找对应的 WebSite 对象
    2. 流式解析 ffuf 输出（JSON 格式）
    3. 批量保存到 Directory 表
    
    Args:
        cmd: ffuf 目录扫描命令
        scan_id: 扫描任务 ID
        target_id: 目标 ID
        site_url: 当前站点 URL
        cwd: 工作目录（可选）
        shell: 是否使用 shell 执行（默认 False）
        batch_size: 批量保存大小（默认1000）
        timeout: 命令执行超时时间（秒），None 表示不设置超时
    
    Returns:
        dict: {
            'processed_records': int,  # 处理的记录总数
            'created_directories': int,  # 创建的目录记录数
            'site_url': str  # 当前站点 URL
        }
    
    Raises:
        ValueError: 参数验证失败
        RuntimeError: 命令执行或数据库操作失败
        subprocess.TimeoutExpired: 命令执行超时
    """
    logger.info(
        "开始执行流式目录扫描任务 - site_url=%s, 超时=%s秒", 
        site_url, timeout if timeout else '无限制'
    )
    
    data_generator = None
    
    try:
        # 1. 初始化服务
        services = ServiceSet.create_default()
        
        # 2. 查找站点（使用 Service）
        website_id = services.website.get_by_url(url=site_url, target_id=target_id)
        
        if website_id is None:
            logger.error("站点不存在: %s", site_url)
            raise ValueError(f"站点不存在: {site_url}")
        
        logger.info("找到站点: %s (ID: %d)", site_url, website_id)
        
        # 3. 初始化资源
        data_generator = _parse_ffuf_stream_output(cmd=cmd, tool_name=tool_name, cwd=cwd, shell=shell, timeout=timeout, log_file=log_file)
        
        # 4. 流式处理记录并分批保存
        total_records = 0
        batch_num = 0
        failed_batches = []
        batch = []
        total_created = 0
        
        for record in data_generator:
            batch.append(record)
            total_records += 1
            
            # 达到批次大小，执行保存
            if len(batch) >= batch_size:
                batch_num += 1
                result = _save_batch_with_retry(
                    batch, website_id, scan_id, target_id, batch_num, services
                )
                
                total_created += result.get('created_directories', 0)
                
                if not result['success']:
                    failed_batches.append(batch_num)
                
                batch = []  # 清空批次
                
                # 每20个批次输出进度
                if batch_num % 20 == 0:
                    logger.info(
                        "进度: 已处理 %d 批次，%d 条记录", 
                        batch_num, total_records
                    )
        
        # 保存最后一批
        if batch:
            batch_num += 1
            result = _save_batch_with_retry(
                batch, website_id, scan_id, target_id, batch_num, services
            )
            total_created += result.get('created_directories', 0)
            
            if not result['success']:
                failed_batches.append(batch_num)
        
        # 检查失败批次
        if failed_batches:
            logger.warning(
                "部分批次保存失败 - 站点: %s, 失败批次: %s",
                site_url, failed_batches
            )
        
        logger.info(
            "✓ 流式保存完成 - 站点: %s, 处理记录: %d（%d 批次），创建目录: %d",
            site_url, total_records, batch_num, total_created
        )
        
        return {
            'processed_records': total_records,
            'created_directories': total_created,
            'site_url': site_url
        }
        
    except subprocess.TimeoutExpired:
        # 超时异常直接向上传播，保留异常类型
        logger.warning(
            "⚠️ 目录扫描任务超时 - site_url=%s, 超时=%s秒",
            site_url, timeout
        )
        raise
    
    except Exception as e:
        error_msg = f"流式执行目录扫描任务失败: {e}"
        logger.error(error_msg, exc_info=True)
        raise RuntimeError(error_msg) from e
    
    finally:
        # 清理资源
        if data_generator is not None:
            try:
                data_generator.close()
                logger.debug("已关闭数据生成器")
            except Exception as gen_close_error:
                logger.error("关闭生成器时出错: %s", gen_close_error)
