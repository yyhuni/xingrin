"""
APScheduler 定时任务调度器

替代 Prefect Work Pool，用于触发定时任务。
实际任务执行通过 task_distributor 分发到各 Worker。
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from django.conf import settings

logger = logging.getLogger(__name__)

# 全局调度器实例
_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    """获取调度器实例"""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(
            timezone=settings.TIME_ZONE,
            job_defaults={
                'coalesce': True,  # 合并错过的任务
                'max_instances': 1,  # 同一任务最多同时运行1个实例
                'misfire_grace_time': 60 * 5,  # 错过5分钟内仍然执行
            }
        )
    return _scheduler


def start_scheduler():
    """启动调度器并注册所有定时任务"""
    scheduler = get_scheduler()
    
    if scheduler.running:
        logger.info("调度器已在运行")
        return
    
    # 注册定时任务
    _register_scheduled_jobs(scheduler)
    
    # 启动调度器
    scheduler.start()
    logger.info("✓ APScheduler 定时调度器已启动")


def shutdown_scheduler():
    """关闭调度器"""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler 调度器已关闭")
    _scheduler = None


def _register_scheduled_jobs(scheduler: BackgroundScheduler):
    """注册所有定时任务"""
    
    # 1. 定时扫描任务（检查并执行到期的定时扫描）
    scheduler.add_job(
        _trigger_scheduled_scans,
        trigger=IntervalTrigger(minutes=1),  # 每分钟检查并触发到期任务
        id='scheduled_scans',
        name='定时扫描任务',
        replace_existing=True,
    )
    logger.info("  - 已注册: 定时扫描任务（每分钟）")
    
    # 2. 资产统计刷新（每小时）
    scheduler.add_job(
        _trigger_statistics_refresh,
        trigger=CronTrigger(minute=0),  # 每小时整点
        id='statistics_refresh',
        name='资产统计刷新',
        replace_existing=True,
    )
    logger.info("  - 已注册: 资产统计刷新（每小时）")
    
    # 3. 扫描结果清理（每天凌晨3点）
    scheduler.add_job(
        _trigger_cleanup,
        trigger=CronTrigger(hour=3, minute=0),
        id='scan_cleanup',
        name='扫描结果清理',
        replace_existing=True,
    )
    logger.info("  - 已注册: 扫描结果清理（每天 03:00）")


def _trigger_scheduled_scans():
    """触发到期的定时扫描任务"""
    try:
        from apps.scan.services.scheduled_scan_service import ScheduledScanService
        
        service = ScheduledScanService()
        triggered_count = service.trigger_due_scans()
        
        if triggered_count > 0:
            logger.info(f"定时扫描: 已触发 {triggered_count} 个任务")
            
    except Exception as e:
        logger.error(f"定时扫描任务执行失败: {e}", exc_info=True)


def _trigger_statistics_refresh():
    """触发资产统计刷新"""
    try:
        from apps.asset.services.statistics_service import AssetStatisticsService
        
        service = AssetStatisticsService()
        service.refresh_statistics()
        
        logger.info("资产统计刷新完成")
        
    except Exception as e:
        logger.error(f"资产统计刷新失败: {e}", exc_info=True)


def _trigger_cleanup():
    """触发扫描结果清理（分发到各 Worker）"""
    try:
        from apps.engine.services.task_distributor import TaskDistributor
        
        distributor = TaskDistributor()
        results = distributor.execute_cleanup_on_all_workers()
        
        logger.info(f"扫描清理任务已分发到 {len(results)} 个 Worker")
        
    except Exception as e:
        logger.error(f"扫描清理任务分发失败: {e}", exc_info=True)
