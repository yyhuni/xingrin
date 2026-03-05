import logging
from django.core.management.base import BaseCommand

from apps.engine.services.task_distributor import get_task_distributor
from apps.scan.repositories import DjangoScanRepository
from apps.scan.services.scan_recovery_service import (
    reclaim_stuck_initiated_scans,
    get_recoverable_scans_queryset,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "恢复扫描任务：先回收 initiated 僵尸占位，再重分发 status=initiated 且未绑定 worker 的任务"

    def handle(self, *args, **options):
        distributor = get_task_distributor()
        repo = DjangoScanRepository()

        reclaimed = reclaim_stuck_initiated_scans()
        if reclaimed > 0:
            self.stdout.write(
                self.style.WARNING(f"已回收 {reclaimed} 个 initiated 僵尸占位任务（worker_id 已释放）")
            )

        pending = get_recoverable_scans_queryset()

        if not pending.exists():
            self.stdout.write(self.style.SUCCESS("暂无需要恢复的扫描任务"))
            return

        self.stdout.write(self.style.WARNING(f"发现 {pending.count()} 个待恢复扫描任务，开始重新分发..."))

        for scan in pending:
            engine_name = ", ".join(scan.engine_names) if scan.engine_names else "unknown"
            try:
                success, message, container_id, worker_id = distributor.execute_scan_flow(
                    scan_id=scan.id,
                    target_name=scan.target.name,
                    target_id=scan.target.id,
                    scan_workspace_dir=scan.results_dir,
                    engine_name=engine_name,
                )
                if success:
                    if container_id:
                        repo.append_container_id(scan.id, container_id)
                    if worker_id:
                        repo.update_worker(scan.id, worker_id)
                    logger.info(
                        "已恢复扫描任务 - scan_id=%s, worker_id=%s, container_id=%s",
                        scan.id,
                        worker_id,
                        container_id,
                    )
                else:
                    logger.warning(
                        "恢复扫描任务失败 - scan_id=%s, message=%s", scan.id, message
                    )
            except Exception as exc:  # pragma: no cover - 防御性日志
                logger.exception("恢复扫描任务异常 - scan_id=%s, err=%s", scan.id, exc)

        self.stdout.write(self.style.SUCCESS("恢复任务处理完成"))
