"""
保存 URL 到数据库任务

批量保存发现的 URL 到 Endpoint 表
支持批量插入和去重
"""

import logging
from pathlib import Path
from prefect import task
from typing import List, Optional
from urllib.parse import urlparse
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ParsedURL:
    """解析后的 URL 数据"""
    url: str
    domain: str
    path: str
    query: Optional[str]
    method: str = 'GET'  # 默认方法


def _parse_url(url: str) -> Optional[ParsedURL]:
    """
    解析 URL 提取各个组件
    
    Args:
        url: 完整 URL
        
    Returns:
        ParsedURL 或 None（如果解析失败）
    """
    try:
        # 确保有协议
        if not url.startswith(('http://', 'https://')):
            url = f'http://{url}'
        
        parsed = urlparse(url)
        
        # 提取域名
        domain = parsed.netloc
        if not domain:
            return None
        
        # 提取路径（默认为 /）
        path = parsed.path if parsed.path else '/'
        
        # 提取查询参数
        query = parsed.query if parsed.query else None
        
        # 重建完整 URL（标准化）
        scheme = parsed.scheme if parsed.scheme else 'http'
        full_url = f"{scheme}://{domain}{path}"
        if query:
            full_url = f"{full_url}?{query}"
        
        return ParsedURL(
            url=full_url,
            domain=domain,
            path=path,
            query=query
        )
    except Exception as e:
        logger.debug(f"解析 URL 失败 {url}: {e}")
        return None


@task(
    name='save_urls',
    retries=1,
    log_prints=True
)
def save_urls_task(
    urls_file: str,
    scan_id: int,
    target_id: int,
    batch_size: int = 1000
) -> dict:
    """
    保存 URL 到数据库
    
    Args:
        urls_file: URL 文件路径
        scan_id: 扫描 ID
        target_id: 目标 ID
        batch_size: 批次大小
        
    Returns:
        dict: {
            'saved_urls': int,  # 保存的 URL 数量
            'total_urls': int,  # 总 URL 数量
            'skipped_urls': int  # 跳过的 URL 数量
        }
    """
    try:
        logger.info(f"开始保存 URL 到数据库 - 扫描ID: {scan_id}, 目标ID: {target_id}")
        
        # 导入快照服务和 DTO
        from apps.asset.services.snapshot import EndpointSnapshotsService
        from apps.asset.dtos.snapshot import EndpointSnapshotDTO
        
        # 创建快照服务（统一负责快照 + 资产双写）
        snapshots_service = EndpointSnapshotsService()
        
        # 按批次流式读取并解析 URL，避免一次性加载全部到内存
        total_urls = 0
        invalid_urls = 0
        valid_urls = 0
        saved_count = 0
        skipped_count = 0
        batch_index = 0
        current_batch: list[EndpointSnapshotDTO] = []

        with open(urls_file, 'r') as f:
            for line in f:
                url = line.strip()
                if not url:
                    continue

                total_urls += 1

                # 解析 URL
                parsed = _parse_url(url)
                if not parsed:
                    invalid_urls += 1
                    continue

                valid_urls += 1
                current_batch.append(
                    EndpointSnapshotDTO(
                        scan_id=scan_id,
                        url=parsed.url,
                        host=parsed.domain,  # 设置 host 字段
                        target_id=target_id,  # 用于同步到资产表
                    )
                )

                # 达到批次大小时写入数据库
                if len(current_batch) >= batch_size:
                    batch_index += 1
                    try:
                        snapshots_service.save_and_sync(current_batch)
                        created_count = len(current_batch)
                        saved_count += created_count
                        logger.debug(f"批次 {batch_index}: 保存 {created_count} 个 URL")
                    except Exception as e:
                        logger.error(f"批量保存失败（批次 {batch_index}）: {e}")
                        skipped_count += len(current_batch)
                    finally:
                        current_batch = []

        # 处理最后不足一个批次的 URL
        if current_batch:
            batch_index += 1
            try:
                snapshots_service.save_and_sync(current_batch)
                created_count = len(current_batch)
                saved_count += created_count
                logger.debug(f"批次 {batch_index}: 保存 {created_count} 个 URL")
            except Exception as e:
                logger.error(f"批量保存失败（批次 {batch_index}）: {e}")
                skipped_count += len(current_batch)

        if valid_urls == 0:
            logger.warning("没有有效的 URL 需要保存")
            return {
                'saved_urls': 0,
                'total_urls': total_urls,
                'skipped_urls': invalid_urls,
            }

        logger.info(
            "准备保存 %d 个有效 URL（总计: %d，无效: %d）",
            valid_urls,
            total_urls,
            invalid_urls,
        )

        # 计算最终跳过的数量（包括无效 URL 和保存失败的 URL）
        final_skipped = total_urls - saved_count
        
        logger.info(
            f"✓ URL 保存完成 - 保存: {saved_count}, "
            f"跳过: {final_skipped}（包括重复和无效）, 总计: {total_urls}"
        )
        
        return {
            'saved_urls': saved_count,
            'total_urls': total_urls,
            'skipped_urls': final_skipped
        }
        
    except Exception as e:
        logger.error(f"保存 URL 失败: {e}", exc_info=True)
        raise RuntimeError(f"保存 URL 失败: {e}") from e
