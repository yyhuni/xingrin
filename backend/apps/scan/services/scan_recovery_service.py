"""扫描任务恢复服务。"""

import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.common.definitions import ScanStatus
from apps.scan.models import Scan

logger = logging.getLogger(__name__)


def get_initiated_stuck_timeout_seconds() -> int:
    """读取 initiated 僵尸任务回收阈值（秒）。<=0 表示禁用自动回收。"""
    return int(getattr(settings, "DISPATCH_INITIATED_STUCK_TIMEOUT_SECONDS", 900))


def reclaim_stuck_initiated_scans(timeout_seconds: int | None = None) -> int:
    """
    回收长时间停留在 initiated 且仍绑定 worker 的任务占位。

    回收策略：
    - status 仍是 initiated
    - worker_id 非空（会被计入 inflight 并占用并发槽位）
    - created_at 超过阈值
    - 仅释放 worker_id，保持 status=initiated，后续由恢复流程重新分发
    """
    timeout = get_initiated_stuck_timeout_seconds() if timeout_seconds is None else int(timeout_seconds)
    if timeout <= 0:
        return 0

    cutoff = timezone.now() - timedelta(seconds=timeout)
    updated = Scan.objects.filter(
        status=ScanStatus.INITIATED,
        worker_id__isnull=False,
        created_at__lt=cutoff,
    ).update(worker_id=None)

    if updated > 0:
        logger.warning(
            "已回收 initiated 僵尸占位任务: %d 个 (timeout=%ds)",
            updated,
            timeout,
        )
    return updated


def get_recoverable_scans_queryset():
    """
    获取可重分发任务。

    当前可恢复集合：status=initiated 且 worker 为空。
    """
    return Scan.objects.filter(
        status=ScanStatus.INITIATED,
        worker__isnull=True,
    ).select_related("target")

