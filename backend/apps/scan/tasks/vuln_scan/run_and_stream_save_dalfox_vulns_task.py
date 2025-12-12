"""基于 execute_stream 的 Dalfox XSS 漏洞流式扫描任务

主要功能：
    1. 实时执行 Dalfox 漏洞扫描命令
    2. 流式处理命令输出，解析为统一的漏洞记录
    3. 批量保存到 VulnerabilitySnapshot 表
    4. 避免生成大量临时文件，提高效率

数据流向：
    命令执行 → 流式输出 → 实时解析 → 批量保存 → 数据库

注意：
    Dalfox 的 JSON 输出为数组形式：首行为 '['，每条记录一行，行尾带逗号，末行为 ']'
    本任务在解析阶段会：
        - 跳过 '['、']' 等控制行
        - 去掉每条记录末尾的逗号，再做 json 解析
"""

import logging
import json
import subprocess
import time
from asyncio import CancelledError
from pathlib import Path
from dataclasses import dataclass
from typing import Generator, Optional, TYPE_CHECKING

from prefect import task
from django.db import IntegrityError, OperationalError, DatabaseError
from psycopg2 import InterfaceError

from apps.common.definitions import VulnSeverity, ScanStatus
from apps.asset.dtos.snapshot import VulnerabilitySnapshotDTO
from apps.scan.utils import execute_stream
from apps.scan.models import Scan

if TYPE_CHECKING:
    from apps.asset.services.snapshot import VulnerabilitySnapshotsService

logger = logging.getLogger(__name__)


@dataclass
class ServiceSet:
    """Service 集合，用于依赖注入

    提供漏洞扫描所需的 Service 实例，便于测试时注入 Mock 对象。
    """

    snapshot: "VulnerabilitySnapshotsService"

    @classmethod
    def create_default(cls) -> "ServiceSet":
        """创建默认的 Service 集合"""
        from apps.asset.services.snapshot import VulnerabilitySnapshotsService

        return cls(snapshot=VulnerabilitySnapshotsService())


def _validate_task_parameters(cmd: str, target_id: int, scan_id: int, cwd: Optional[str]) -> None:
    """验证任务参数的有效性。"""
    if not cmd or not cmd.strip():
        raise ValueError("扫描命令不能为空")

    if target_id is None:
        raise ValueError("target_id 不能为 None，必须指定目标ID")

    if scan_id is None:
        raise ValueError("scan_id 不能为 None，必须指定扫描ID")

    if cwd and not Path(cwd).exists():
        raise ValueError(f"工作目录不存在: {cwd}")


def _map_severity(raw: Optional[str]) -> str:
    """将 Dalfox 的严重性字符串映射为内部 VulnSeverity。"""
    value = (raw or "").strip().lower()
    mapping = {
        "info": VulnSeverity.INFO,
        "information": VulnSeverity.INFO,
        "low": VulnSeverity.LOW,
        "medium": VulnSeverity.MEDIUM,
        "med": VulnSeverity.MEDIUM,
        "high": VulnSeverity.HIGH,
        "critical": VulnSeverity.CRITICAL,
    }
    return mapping.get(value, VulnSeverity.UNKNOWN)


def _parse_and_validate_line(line: str) -> Optional[dict]:
    """解析并验证单行 Dalfox JSON 输出。

    处理步骤：
        1. 去除首尾空白
        2. 跳过 '['、']' 等数组控制行
        3. 去掉行尾逗号
        4. 解析 JSON 并验证必要字段
    """
    try:
        raw = line.strip()
        if not raw:
            return None

        # 跳过数组控制行
        if raw in ("[", "]", "],"):
            return None

        # 去掉尾部逗号
        if raw.endswith(","):
            raw = raw[:-1].rstrip()

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # logger.debug("跳过非 JSON 格式的行: %s", raw[:100])
            return None

        if not isinstance(data, dict):
            logger.warning("解析后的数据不是字典类型，跳过: %s", str(data)[:100])
            return None

        # Dalfox 输出中的 URL 字段为 data
        url = (data.get("data") or "").strip()
        if not url:
            logger.debug("Dalfox 记录缺少 data(URL) 字段，跳过")
            return None

        severity = _map_severity(data.get("severity"))

        # 漏洞类型：根据 type 字段区分 XSS 类型
        # R=Reflected, S=Stored, V=Verified
        type_code = data.get("type", "")
        type_map = {"R": "xss-reflected", "S": "xss-stored", "V": "xss-verified"}
        vuln_type = type_map.get(type_code, "xss")

        # 简化描述：只用 message_str，完整信息在 raw_output
        description = data.get("message_str") or ""

        return {
            "url": url,
            "vuln_type": vuln_type,
            "severity": severity,
            "source": "dalfox",
            "cvss_score": None,
            "description": description,
            "raw_output": data,  # 存储解析后的 dict，而不是原始字符串
        }

    except Exception as e:
        logger.error("解析 Dalfox 行数据异常: %s - 数据: %s", e, line[:100])
        return None


def _parse_dalfox_stream_output(
    cmd: str,
    tool_name: str,
    cwd: Optional[str] = None,
    shell: bool = False,
    timeout: Optional[int] = None,
    log_file: Optional[str] = None,
) -> Generator[dict, None, None]:
    """流式解析 Dalfox 漏洞扫描命令输出。"""
    logger.info("开始流式解析 Dalfox 漏洞扫描命令输出 - 命令: %s", cmd)

    total_lines = 0
    error_lines = 0
    valid_records = 0

    try:
        for line in execute_stream(
            cmd=cmd,
            tool_name=tool_name,
            cwd=cwd,
            shell=shell,
            timeout=timeout,
            log_file=log_file,
        ):
            total_lines += 1

            record = _parse_and_validate_line(line)
            if record is None:
                error_lines += 1
                continue

            valid_records += 1
            yield record

            if valid_records % 100 == 0:
                logger.info("已解析 %d 条有效漏洞记录...", valid_records)

    except subprocess.TimeoutExpired as e:
        error_msg = f"流式解析命令输出超时 - 命令执行超过 {timeout} 秒"
        logger.warning(error_msg)
        raise RuntimeError(error_msg) from e
    except Exception as e:
        logger.error("流式解析 Dalfox 命令输出失败: %s", e, exc_info=True)
        raise

    logger.info(
        "流式解析完成 - 总行数: %d, 有效记录: %d, 错误行数: %d",
        total_lines,
        valid_records,
        error_lines,
    )


def _save_batch(
    batch: list,
    scan_id: int,
    target_id: int,
    batch_num: int,
    services: ServiceSet,
) -> int:
    """保存一个批次的漏洞记录到数据库（使用快照 Service，同步到资产表）。"""
    if not batch:
        logger.debug("批次 %d 为空，跳过处理", batch_num)
        return 0

    snapshot_items = []
    for record in batch:
        try:
            dto = VulnerabilitySnapshotDTO(
                scan_id=scan_id,
                target_id=target_id,
                url=record["url"],
                vuln_type=record["vuln_type"],
                severity=str(record["severity"]),
                source=record["source"],
                cvss_score=record.get("cvss_score"),
                description=record.get("description", ""),
                raw_output=record.get("raw_output", ""),
            )
            snapshot_items.append(dto)
        except Exception as e:
            logger.error("构建漏洞快照 DTO 失败: %s，记录: %s", e, str(record)[:200])
            continue

    if snapshot_items:
        services.snapshot.save_and_sync(snapshot_items)

    logger.info("批次 %d: 保存了 %d 条漏洞记录（共 %d 条）", batch_num, len(snapshot_items), len(batch))
    return len(snapshot_items)


def _save_batch_with_retry(
    batch: list,
    scan_id: int,
    target_id: int,
    batch_num: int,
    services: ServiceSet,
    max_retries: int = 3,
) -> dict:
    """保存一个批次的漏洞记录（带重试机制）。"""
    for attempt in range(max_retries):
        try:
            created = _save_batch(batch, scan_id, target_id, batch_num, services)
            return {"success": True, "created_vulns": created}

        except IntegrityError as e:
            logger.error("批次 %d 数据完整性错误，跳过: %s", batch_num, str(e)[:100])
            return {"success": False, "created_vulns": 0}

        except (OperationalError, DatabaseError, InterfaceError) as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(
                    "批次 %d 保存失败（第 %d 次尝试），%d秒后重试: %s",
                    batch_num,
                    attempt + 1,
                    wait_time,
                    str(e)[:100],
                )
                time.sleep(wait_time)
            else:
                logger.error("批次 %d 保存失败（已重试 %d 次）: %s", batch_num, max_retries, e)
                return {"success": False, "created_vulns": 0}

        except Exception as e:
            logger.error("批次 %d 未知错误: %s", batch_num, e, exc_info=True)
            return {"success": False, "created_vulns": 0}

    return {"success": False, "created_vulns": 0}


def _accumulate_batch_stats(total_stats: dict, batch_result: dict) -> None:
    """累加批次统计信息。"""
    total_stats["created_vulns"] += batch_result.get("created_vulns", 0)


def _process_batch(
    batch: list,
    scan_id: int,
    target_id: int,
    batch_num: int,
    total_stats: dict,
    failed_batches: list,
    services: ServiceSet,
) -> None:
    """处理单个批次。"""
    result = _save_batch_with_retry(batch, scan_id, target_id, batch_num, services)
    _accumulate_batch_stats(total_stats, result)

    if not result["success"]:
        failed_batches.append(batch_num)
        logger.warning(
            "批次 %d 保存失败，但已累计统计信息：创建漏洞=%d",
            batch_num,
            result.get("created_vulns", 0),
        )


def _process_records_in_batches(
    data_generator,
    scan_id: int,
    target_id: int,
    batch_size: int,
    services: ServiceSet,
) -> dict:
    """流式处理记录并分批保存。"""
    total_records = 0
    batch_num = 0
    failed_batches = []
    batch = []
    cancel_check_interval = 50  # 每处理50条检查一次取消信号

    total_stats = {"created_vulns": 0}

    for record in data_generator:
        if cancel_check_interval > 0 and (total_records % cancel_check_interval == 0):
            _raise_if_cancelled(scan_id)

        batch.append(record)
        total_records += 1

        if len(batch) >= batch_size:
            batch_num += 1
            _process_batch(batch, scan_id, target_id, batch_num, total_stats, failed_batches, services)
            batch = []

            if batch_num % 20 == 0:
                logger.info("进度: 已处理 %d 批次，%d 条记录", batch_num, total_records)

    if batch:
        batch_num += 1
        _process_batch(batch, scan_id, target_id, batch_num, total_stats, failed_batches, services)

    _raise_if_cancelled(scan_id)

    if failed_batches:
        error_msg = (
            f"流式保存漏洞扫描结果时出现失败批次，处理记录: {total_records}，"
            f"失败批次: {failed_batches}"
        )
        logger.warning(error_msg)
        raise RuntimeError(error_msg)

    return {
        "processed_records": total_records,
        "batch_count": batch_num,
        **total_stats,
    }


def _build_final_result(stats: dict) -> dict:
    """构建最终结果并输出日志。"""
    logger.info(
        "✓ Dalfox 流式保存完成 - 处理记录: %d（%d 批次），创建漏洞: %d",
        stats["processed_records"],
        stats["batch_count"],
        stats["created_vulns"],
    )

    if stats["created_vulns"] == 0:
        logger.warning(
            "⚠️  没有创建任何漏洞记录！可能原因：1) Dalfox 未发现漏洞 2) 输出格式问题 3) 重复数据被忽略"
        )

    return {
        "processed_records": stats["processed_records"],
        "created_vulns": stats["created_vulns"],
    }


def _cleanup_resources(data_generator) -> None:
    """清理任务资源。"""
    if data_generator is None:
        return

    try:
        data_generator.close()
        logger.debug("已关闭数据生成器")
    except Exception as gen_close_error:
        logger.error("关闭生成器时出错: %s", gen_close_error)


@task(
    name="run_and_stream_save_dalfox_vulns",
    retries=0,
    log_prints=True,
)
def run_and_stream_save_dalfox_vulns_task(
    cmd: str,
    tool_name: str,
    scan_id: int,
    target_id: int,
    cwd: Optional[str] = None,
    shell: bool = False,
    batch_size: int = 1, # Dalfox 漏洞结果本来就不会特别多，可以改小点实时写入
    timeout: Optional[int] = None,
    log_file: Optional[str] = None,
) -> dict:
    """执行 Dalfox 漏洞扫描命令并流式保存结果到数据库。"""
    logger.info(
        "开始执行 Dalfox 流式漏洞扫描任务 - target_id=%s, 超时=%s秒, 命令: %s",
        target_id,
        timeout if timeout else "无限制",
        cmd,
    )

    data_generator = None

    try:
        _validate_task_parameters(cmd, target_id, scan_id, cwd)

        data_generator = _parse_dalfox_stream_output(
            cmd=cmd,
            tool_name=tool_name,
            cwd=cwd,
            shell=shell,
            timeout=timeout,
            log_file=log_file,
        )
        services = ServiceSet.create_default()

        stats = _process_records_in_batches(
            data_generator,
            scan_id,
            target_id,
            batch_size,
            services,
        )

        return _build_final_result(stats)

    except CancelledError:
        logger.warning(
            "⚠️ Dalfox 漏洞扫描任务检测到取消信号，正在终止 - scan_id=%s, target_id=%s",
            scan_id,
            target_id,
        )
        raise

    except subprocess.TimeoutExpired:
        logger.warning(
            "⚠️ Dalfox 漏洞扫描任务超时 - target_id=%s, 超时=%s秒。超时前已解析的数据已保存到数据库。",
            target_id,
            timeout,
        )
        raise

    except Exception as e:
        error_msg = f"流式执行 Dalfox 漏洞扫描任务失败: {e}"
        logger.error(error_msg, exc_info=True)
        raise RuntimeError(error_msg) from e

    finally:
        _cleanup_resources(data_generator)


def _raise_if_cancelled(scan_id: int) -> None:
    """检测扫描是否已请求取消，若是则抛出 CancelledError 以触发 Prefect 取消流程。"""
    status = Scan.objects.filter(id=scan_id).values_list("status", flat=True).first()
    if status == ScanStatus.CANCELLED:
        logger.warning("检测到取消信号，终止 Dalfox 漏洞扫描 - scan_id=%s", scan_id)
        raise CancelledError()
