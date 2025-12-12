"""
导出扫描目标到 TXT 文件的 Task

根据 Target 类型决定导出内容：
- DOMAIN: 从 Subdomain 表导出子域名
- IP: 直接写入 target.name
- CIDR: 展开 CIDR 范围内的所有 IP

使用流式处理，避免大量数据导致内存溢出
"""
import logging
import ipaddress
from pathlib import Path
from prefect import task

from apps.asset.services.asset.subdomain_service import SubdomainService
from apps.targets.services import TargetService
from apps.targets.models import Target  # 仅用于 TargetType 常量

logger = logging.getLogger(__name__)


def _export_domains(target_id: int, output_path: Path, batch_size: int) -> int:
    """
    导出域名类型目标的子域名
    
    Args:
        target_id: 目标 ID
        output_path: 输出文件路径
        batch_size: 批次大小
    
    Returns:
        int: 导出的记录数
    """
    subdomain_service = SubdomainService()
    domain_iterator = subdomain_service.iter_subdomain_names_by_target(
        target_id=target_id,
        chunk_size=batch_size
    )
    
    total_count = 0
    with open(output_path, 'w', encoding='utf-8', buffering=8192) as f:
        for domain_name in domain_iterator:
            f.write(f"{domain_name}\n")
            total_count += 1
            
            if total_count % 10000 == 0:
                logger.info("已导出 %d 个域名...", total_count)
    
    return total_count


def _export_ip(target_name: str, output_path: Path) -> int:
    """
    导出 IP 类型目标
    
    Args:
        target_name: IP 地址
        output_path: 输出文件路径
    
    Returns:
        int: 导出的记录数（始终为 1）
    """
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"{target_name}\n")
    return 1


def _export_cidr(target_name: str, output_path: Path) -> int:
    """
    导出 CIDR 类型目标，展开为每个 IP
    
    Args:
        target_name: CIDR 范围（如 192.168.1.0/24）
        output_path: 输出文件路径
    
    Returns:
        int: 导出的 IP 数量
    """
    network = ipaddress.ip_network(target_name, strict=False)
    total_count = 0
    
    with open(output_path, 'w', encoding='utf-8', buffering=8192) as f:
        for ip in network.hosts():  # 排除网络地址和广播地址
            f.write(f"{ip}\n")
            total_count += 1
            
            if total_count % 10000 == 0:
                logger.info("已导出 %d 个 IP...", total_count)
    
    # 如果是 /32 或 /128（单个 IP），hosts() 会为空，需要特殊处理
    if total_count == 0:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f"{network.network_address}\n")
        total_count = 1
    
    return total_count


@task(name="export_scan_targets")
def export_scan_targets_task(
    target_id: int,
    output_file: str,
    batch_size: int = 1000
) -> dict:
    """
    导出扫描目标到 TXT 文件
    
    根据 Target 类型自动决定导出内容：
    - DOMAIN: 从 Subdomain 表导出子域名（流式处理，支持 10万+ 域名）
    - IP: 直接写入 target.name（单个 IP）
    - CIDR: 展开 CIDR 范围内的所有可用 IP

    Args:
        target_id: 目标 ID
        output_file: 输出文件路径（绝对路径）
        batch_size: 每次读取的批次大小，默认 1000（仅对 DOMAIN 类型有效）

    Returns:
        dict: {
            'success': bool,
            'output_file': str,
            'total_count': int,
            'target_type': str
        }

    Raises:
        ValueError: Target 不存在
        IOError: 文件写入失败
    """
    try:
        # 1. 通过 Service 层获取 Target
        target_service = TargetService()
        target = target_service.get_target(target_id)
        if not target:
            raise ValueError(f"Target ID {target_id} 不存在")
        
        target_type = target.type
        target_name = target.name
        
        logger.info(
            "开始导出扫描目标 - Target ID: %d, Name: %s, Type: %s, 输出文件: %s",
            target_id, target_name, target_type, output_file
        )

        # 2. 确保输出目录存在
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # 3. 根据类型导出
        if target_type == Target.TargetType.DOMAIN:
            total_count = _export_domains(target_id, output_path, batch_size)
            type_desc = "域名"
        elif target_type == Target.TargetType.IP:
            total_count = _export_ip(target_name, output_path)
            type_desc = "IP"
        elif target_type == Target.TargetType.CIDR:
            total_count = _export_cidr(target_name, output_path)
            type_desc = "CIDR IP"
        else:
            raise ValueError(f"不支持的目标类型: {target_type}")

        logger.info(
            "✓ 扫描目标导出完成 - 类型: %s, 总数: %d, 文件: %s (%.2f KB)",
            type_desc,
            total_count,
            str(output_path),
            output_path.stat().st_size / 1024
        )

        return {
            'success': True,
            'output_file': str(output_path),
            'total_count': total_count,
            'target_type': target_type
        }

    except FileNotFoundError as e:
        logger.error("输出目录不存在: %s", e)
        raise
    except PermissionError as e:
        logger.error("文件写入权限不足: %s", e)
        raise
    except ValueError as e:
        logger.error("参数错误: %s", e)
        raise
    except Exception as e:
        logger.exception("导出扫描目标失败: %s", e)
        raise
