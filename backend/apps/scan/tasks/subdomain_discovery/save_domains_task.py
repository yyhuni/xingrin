"""
保存域名任务

负责将验证后的域名批量保存到数据库
"""

import logging
import time
from pathlib import Path
from prefect import task
from typing import List
from dataclasses import dataclass
from django.db import IntegrityError, OperationalError, DatabaseError

from apps.asset.services.snapshot import SubdomainSnapshotsService
from apps.common.validators import validate_domain

logger = logging.getLogger(__name__)


@dataclass
class ServiceSet:
    """
    Service 集合，用于依赖注入
    
    封装所有需要的 Service 实例，便于测试和管理。
    """
    snapshot: SubdomainSnapshotsService
    
    @classmethod
    def create_default(cls) -> 'ServiceSet':
        """创建默认的 Service 集合"""
        return cls(
            snapshot=SubdomainSnapshotsService()
        )


@task(
    name='save_domains',
    retries=0,
    log_prints=True
)
def save_domains_task(
    domains_file: str,
    scan_id: int,
    target_id: int = None,
    batch_size: int = 1000
) -> dict:
    """
    流式批量保存域名到数据库
    
    Args:
        domains_file: 域名文件路径（流式读取）
        scan_id: 扫描任务 ID
        target_id: 目标 ID（可选）
        batch_size: 批量保存大小
    
    Returns:
        dict: {
            'processed_records': int  # 处理的域名总数（不是实际创建数）
        }
    
    Raises:
        ValueError: 参数验证失败（target_id为None或路径不是文件）
        FileNotFoundError: 域名文件不存在
        RuntimeError: 数据库操作失败
        IOError: 文件读取失败
    
    Performance:
        - 流式读取文件，边读边保存
        - 内存占用恒定（只存储一个 batch）
        - 默认batch_size=1000(平衡性能和内存)
        - 批次失败自动重试
    
    Note:
        由于使用 ignore_conflicts，无法返回实际创建的数量
    """
    logger.info("开始从文件流式保存域名到数据库: %s", domains_file)
    
    # 参数验证
    if target_id is None:
        raise ValueError("target_id 不能为 None，必须指定目标ID")
    
    # 文件验证
    file_path = Path(domains_file)
    if not file_path.exists():
        raise FileNotFoundError(f"域名文件不存在: {domains_file}")
    if not file_path.is_file():
        raise ValueError(f"路径不是文件: {domains_file}")
    
    batch_num = 0
    failed_batches = []  # 记录失败的批次
    total_domains = 0  # 总域名数
    
    # 初始化 Service 集合（依赖注入）
    services = ServiceSet.create_default()
    
    try:
        # 流式读取并分批保存
        batch = []
        
        with open(domains_file, 'r', encoding='utf-8') as f:
            for line in f:
                domain = line.strip()
                
                # 验证域名格式（包含空行检查）
                try:
                    validate_domain(domain)
                except ValueError as e:
                    logger.warning("跳过无效域名: %s - %s", domain, e)
                    continue
                
                # 只有通过验证的域名才添加到批次和计数
                batch.append(domain)
                total_domains += 1
                
                # 达到批次大小，执行保存
                if len(batch) >= batch_size:
                    batch_num += 1
                    result = _save_batch_with_retry(batch, scan_id, target_id, batch_num, services)
                    if not result['success']:
                        failed_batches.append(batch_num)
                        logger.warning("批次 %d 保存失败，已记录", batch_num)
                    
                    batch = []  # 清空批次
                    
                    # 每20个批次输出进度(减少日志开销)
                    if batch_num % 20 == 0:
                        logger.info("进度: 已处理 %d 批次，%d 个域名", batch_num, total_domains)
            
            # 保存最后一批（可能不足 batch_size）
            if batch:
                batch_num += 1
                result = _save_batch_with_retry(batch, scan_id, target_id, batch_num, services)
                if not result['success']:
                    failed_batches.append(batch_num)
        
        # 输出最终统计
        if failed_batches:
            error_msg = (
                f"保存域名时出现失败批次，处理域名: {total_domains}，"
                f"失败批次: {failed_batches}"
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg)
        
        logger.info("✓ 保存完成 - 处理域名: %d（%d 批次）", total_domains, batch_num)
        
        return {
            'processed_records': total_domains
        }
        
    except (IntegrityError, OperationalError, DatabaseError) as e:
        error_msg = f"数据库操作失败: {e}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from e
    
    except IOError as e:
        error_msg = f"文件读取失败: {e}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from e
    
    except Exception as e:
        error_msg = f"保存域名失败: {e}"
        logger.error(error_msg, exc_info=True)
        raise


def _save_batch_with_retry(
    batch: List[str], 
    scan_id: int, 
    target_id: int, 
    batch_num: int, 
    services: ServiceSet,
    max_retries: int = 3
) -> dict:
    """
    保存一个批次的域名（带重试机制）
    
    Args:
        batch: 域名批次
        scan_id: 扫描ID
        target_id: 目标ID
        batch_num: 批次编号
        services: Service 集合（依赖注入）
        max_retries: 最大重试次数
    
    Returns:
        dict: {'success': bool}
    
    Strategy:
        使用 bulk_create + ignore_conflicts
        - 新域名：插入 (INSERT)
        - 重复域名：忽略（不更新，因为没有探测数据）
    """
    # 调试日志：记录传入的参数
    logger.info(f"[调试] _save_batch_with_retry 接收的参数: scan_id={scan_id}, target_id={target_id}, batch_size={len(batch)}")
    
    # 使用快照 DTO（包含完整的业务上下文）
    from apps.asset.dtos import SubdomainSnapshotDTO
    items = [
        SubdomainSnapshotDTO(
            name=domain,
            scan_id=scan_id,
            target_id=target_id  # 包含 target_id
        )
        for domain in batch
    ]
    
    # 调试日志：记录第一个DTO的内容
    if items:
        first_item = items[0]
        logger.info(f"[调试] 第一个 SubdomainSnapshotDTO: name={first_item.name}, scan_id={first_item.scan_id}, target_id={first_item.target_id}")
    
    for attempt in range(max_retries):
        try:
            # DTO 已包含 target_id，无需额外传参
            services.snapshot.save_and_sync(items)
            logger.debug("批次 %d: 已处理 %d 个域名", batch_num, len(batch))
            return {'success': True}
        
        except (OperationalError, DatabaseError) as e:
            # 数据库连接/操作错误，可重试
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 指数退避: 1s, 2s, 4s
                logger.warning("批次 %d 保存失败（第 %d 次尝试），%d秒后重试: %s", 
                             batch_num, attempt + 1, wait_time, str(e)[:100])
                time.sleep(wait_time)
            else:
                logger.error("批次 %d 保存失败（已重试 %d 次）: %s", batch_num, max_retries, e)
                return {'success': False}
        
        except IntegrityError as e:
            # 数据完整性错误，不应重试
            logger.error("批次 %d 数据完整性错误，跳过: %s", batch_num, str(e)[:100])
            return {'success': False}
        
        except Exception as e:
            # 其他未知错误
            logger.error("批次 %d 未知错误: %s", batch_num, e, exc_info=True)
            return {'success': False}
    
    return {'success': False}
