"""
导出站点URL到文件的Task

直接使用 HostPortMapping 表查询 host+port 组合，拼接成URL格式写入文件
"""
import logging
from pathlib import Path
from prefect import task

from apps.asset.services import HostPortMappingService

logger = logging.getLogger(__name__)


@task(name="export_site_urls")
def export_site_urls_task(
    target_id: int,
    output_file: str,
    batch_size: int = 1000
) -> dict:
    """
    导出目标下的所有站点URL到文件（基于 HostPortMapping 表）
    
    功能：
    1. 从 HostPortMapping 表查询 target 下所有 host+port 组合
    2. 拼接成URL格式（标准端口80/443将省略端口号）
    3. 写入到指定文件中
    
    Args:
        target_id: 目标ID
        output_file: 输出文件路径（绝对路径）
        batch_size: 每次处理的批次大小，默认1000（暂未使用，预留）
        
    Returns:
        dict: {
            'success': bool,
            'output_file': str,
            'total_urls': int,
            'association_count': int  # 主机端口关联数量
        }
        
    Raises:
        ValueError: 参数错误
        IOError: 文件写入失败
    """
    try:
        logger.info("开始统计站点URL - Target ID: %d, 输出文件: %s", target_id, output_file)
        
        # 确保输出目录存在
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 直接查询 HostPortMapping 表，按 host 排序
        service = HostPortMappingService()
        associations = service.iter_host_port_by_target(
            target_id=target_id,
            batch_size=batch_size,
        )
        
        total_urls = 0
        association_count = 0
        
        # 流式写入文件
        with open(output_path, 'w', encoding='utf-8', buffering=8192) as f:
            for assoc in associations:
                association_count += 1
                host = assoc['host']
                port = assoc['port']
                
                # 根据端口号生成URL
                # 80 端口：只生成 HTTP URL（省略端口号）
                # 443 端口：只生成 HTTPS URL（省略端口号）
                # 其他端口：生成 HTTP 和 HTTPS 两个URL（带端口号）
                if port == 80:
                    # HTTP 标准端口，省略端口号
                    url = f"http://{host}"
                    f.write(f"{url}\n")
                    total_urls += 1
                elif port == 443:
                    # HTTPS 标准端口，省略端口号
                    url = f"https://{host}"
                    f.write(f"{url}\n")
                    total_urls += 1
                else:
                    # 非标准端口，生成 HTTP 和 HTTPS 两个URL
                    http_url = f"http://{host}:{port}"
                    https_url = f"https://{host}:{port}"
                    f.write(f"{http_url}\n")
                    f.write(f"{https_url}\n")
                    total_urls += 2
                
                # 每处理1000条记录打印一次进度
                if association_count % 1000 == 0:
                    logger.info("已处理 %d 条关联，生成 %d 个URL...", association_count, total_urls)
        
        logger.info(
            "✓ 站点URL导出完成 - 关联数: %d, 总URL数: %d, 文件: %s (%.2f KB)",
            association_count,
            total_urls,
            str(output_path),
            output_path.stat().st_size / 1024
        )
        
        return {
            'success': True,
            'output_file': str(output_path),
            'total_urls': total_urls,
            'association_count': association_count
        }
        
    except FileNotFoundError as e:
        logger.error("输出目录不存在: %s", e)
        raise
    except PermissionError as e:
        logger.error("文件写入权限不足: %s", e)
        raise
    except Exception as e:
        logger.exception("导出站点URL失败: %s", e)
        raise
