"""
定时扫描任务 Service

业务逻辑层：
- 管理定时扫描任务的 CRUD
- 计算下次执行时间
- APScheduler 会每分钟检查 next_run_time，到期任务通过 task_distributor 分发
"""
import logging
from typing import List, Optional, Tuple
from datetime import datetime

from django.core.exceptions import ValidationError

from apps.scan.models import ScheduledScan
from apps.scan.repositories import DjangoScheduledScanRepository, ScheduledScanDTO
from apps.engine.repositories import DjangoEngineRepository
from apps.targets.services import TargetService


logger = logging.getLogger(__name__)


class ScheduledScanService:
    """
    定时扫描任务服务
    
    职责：
    - 定时扫描任务的 CRUD 操作
    - 调度逻辑处理（基于 next_run_time）
    """
    
    def __init__(self):
        self.repo = DjangoScheduledScanRepository()
        self.engine_repo = DjangoEngineRepository()
        self.target_service = TargetService()
    
    # ==================== 查询方法 ====================
    
    def get_by_id(self, scheduled_scan_id: int) -> Optional[ScheduledScan]:
        """根据 ID 获取定时扫描任务"""
        return self.repo.get_by_id(scheduled_scan_id)
    
    def get_queryset(self):
        """获取所有定时扫描任务的查询集"""
        return self.repo.get_queryset()

    def get_all(self, page: int = 1, page_size: int = 10) -> Tuple[List[ScheduledScan], int]:
        """分页获取所有定时扫描任务"""
        return self.repo.get_all(page, page_size)
    
    # ==================== 创建方法 ====================
    
    def create(self, dto: ScheduledScanDTO) -> ScheduledScan:
        """
        创建定时扫描任务
        
        流程：
        1. 验证参数
        2. 创建数据库记录
        3. 计算并设置 next_run_time
        
        Args:
            dto: 定时扫描 DTO
        
        Returns:
            创建的 ScheduledScan 对象
        
        Raises:
            ValidationError: 参数验证失败
        """
        # 1. 验证参数
        self._validate_create_dto(dto)
        
        # 2. 创建数据库记录
        scheduled_scan = self.repo.create(dto)
        
        # 3. 如果有 cron 表达式且已启用，计算下次执行时间
        if scheduled_scan.cron_expression and scheduled_scan.is_enabled:
            next_run_time = self._calculate_next_run_time(scheduled_scan)
            if next_run_time:
                self.repo.update_next_run_time(scheduled_scan.id, next_run_time)
                scheduled_scan.next_run_time = next_run_time
        
        logger.info(
            "创建定时扫描任务 - ID: %s, 名称: %s, 下次执行: %s",
            scheduled_scan.id, scheduled_scan.name, scheduled_scan.next_run_time
        )
        
        return scheduled_scan
    
    def _validate_create_dto(self, dto: ScheduledScanDTO) -> None:
        """验证创建 DTO"""
        from apps.targets.repositories import DjangoOrganizationRepository
        
        if not dto.name:
            raise ValidationError('任务名称不能为空')
        
        if not dto.engine_id:
            raise ValidationError('必须选择扫描引擎')
        
        if not self.engine_repo.get_by_id(dto.engine_id):
            raise ValidationError(f'扫描引擎 ID {dto.engine_id} 不存在')
        
        # 验证扫描模式（organization_id 和 target_id 互斥）
        if not dto.organization_id and not dto.target_id:
            raise ValidationError('必须选择组织或扫描目标')
        
        if dto.organization_id and dto.target_id:
            raise ValidationError('组织扫描和目标扫描只能选择其中一种')
        
        # 组织扫描模式：验证组织是否存在
        if dto.organization_id:
            org_repo = DjangoOrganizationRepository()
            if not org_repo.get_by_id(dto.organization_id):
                raise ValidationError(f'组织 ID {dto.organization_id} 不存在')
        
        # 目标扫描模式：验证目标是否存在
        if dto.target_id:
            if not self.target_service.get_by_id(dto.target_id):
                raise ValidationError(f'目标 ID {dto.target_id} 不存在')
        
        # 验证 cron 表达式格式（简单校验）
        if dto.cron_expression:
            parts = dto.cron_expression.split()
            if len(parts) != 5:
                raise ValidationError('Cron 表达式格式错误，需要 5 个部分：分 时 日 月 周')
    
    # ==================== 更新方法 ====================
    
    def update(self, scheduled_scan_id: int, dto: ScheduledScanDTO) -> Optional[ScheduledScan]:
        """
        更新定时扫描任务
        
        Args:
            scheduled_scan_id: 定时扫描 ID
            dto: 更新的数据
        
        Returns:
            更新后的 ScheduledScan 对象
        """
        existing = self.repo.get_by_id(scheduled_scan_id)
        if not existing:
            return None
        
        # 更新数据库记录
        scheduled_scan = self.repo.update(scheduled_scan_id, dto)
        if not scheduled_scan:
            return None
        
        # 如果 cron 表达式或启用状态变化，重新计算 next_run_time
        cron_changed = dto.cron_expression is not None and dto.cron_expression != existing.cron_expression
        enabled_changed = dto.is_enabled is not None and dto.is_enabled != existing.is_enabled
        
        if cron_changed or enabled_changed:
            if scheduled_scan.is_enabled and scheduled_scan.cron_expression:
                next_run_time = self._calculate_next_run_time(scheduled_scan)
                self.repo.update_next_run_time(scheduled_scan.id, next_run_time)
                scheduled_scan.next_run_time = next_run_time
            else:
                # 禁用或无 cron 表达式，清空下次执行时间
                self.repo.update_next_run_time(scheduled_scan.id, None)
                scheduled_scan.next_run_time = None
        
        return scheduled_scan
    
    # ==================== 启用/禁用方法 ====================
    
    def toggle_enabled(self, scheduled_scan_id: int, enabled: bool) -> bool:
        """
        切换定时扫描任务的启用状态
        
        Args:
            scheduled_scan_id: 定时扫描 ID
            enabled: 是否启用
        
        Returns:
            是否成功
        """
        scheduled_scan = self.repo.get_by_id(scheduled_scan_id)
        if not scheduled_scan:
            return False
        
        # 更新数据库
        if not self.repo.toggle_enabled(scheduled_scan_id, enabled):
            return False
        
        # 更新 next_run_time
        if enabled and scheduled_scan.cron_expression:
            next_run_time = self._calculate_next_run_time(scheduled_scan)
            self.repo.update_next_run_time(scheduled_scan_id, next_run_time)
        else:
            self.repo.update_next_run_time(scheduled_scan_id, None)
        
        logger.info("切换定时扫描状态 - ID: %s, Enabled: %s", scheduled_scan_id, enabled)
        return True
    
    def record_run(self, scheduled_scan_id: int) -> bool:
        """
        记录一次执行（增加执行次数、更新上次执行时间、计算下次执行时间）
        
        Args:
            scheduled_scan_id: 定时扫描 ID
        
        Returns:
            是否成功
        """
        # 1. 增加执行次数并更新上次执行时间
        if not self.repo.increment_run_count(scheduled_scan_id):
            return False
        
        # 2. 计算并更新下次执行时间
        scheduled_scan = self.repo.get_by_id(scheduled_scan_id)
        if scheduled_scan and scheduled_scan.cron_expression:
            next_run_time = self._calculate_next_run_time(scheduled_scan)
            if next_run_time:
                self.repo.update_next_run_time(scheduled_scan_id, next_run_time)
        
        return True
    
    # ==================== 删除方法 ====================
    
    def delete(self, scheduled_scan_id: int) -> bool:
        """
        删除定时扫描任务
        
        Args:
            scheduled_scan_id: 定时扫描 ID
        
        Returns:
            是否成功
        """
        return self.repo.hard_delete(scheduled_scan_id)
    
    # ==================== 定时触发（APScheduler 调用）====================
    
    def trigger_due_scans(self) -> int:
        """
        检查并触发所有到期的定时扫描任务
        
        由 APScheduler 每分钟调用一次，检查 next_run_time <= now 的任务
        
        Returns:
            触发的任务数量
        """
        from django.utils import timezone
        from croniter import croniter
        
        now = timezone.now()
        triggered_count = 0
        
        # 获取所有启用且到期的定时扫描
        due_scans = ScheduledScan.objects.filter(
            is_enabled=True,
            next_run_time__lte=now,
        )
        
        for scheduled_scan in due_scans:
            try:
                # 1. 先计算并更新下次执行时间（防止重复触发）
                # 这样即使触发过程耗时较长，下一次 APScheduler 调用也不会再次查询到这个任务
                cron = croniter(scheduled_scan.cron_expression, now)
                next_run = cron.get_next(datetime)
                self.repo.update_next_run_time(scheduled_scan.id, next_run)
                
                # 2. 触发扫描
                self._trigger_scan_now(scheduled_scan)
                
                # 3. 更新执行记录（run_count + 1, last_run_time = now）
                self.repo.increment_run_count(scheduled_scan.id)
                
                triggered_count += 1
                logger.info(
                    "定时扫描已触发 - ID: %s, 名称: %s, 下次执行: %s",
                    scheduled_scan.id, scheduled_scan.name, next_run
                )
                
            except Exception as e:
                logger.error(
                    "定时扫描触发失败 - ID: %s, Error: %s",
                    scheduled_scan.id, e
                )
                # 注意：即使触发失败，next_run_time 已更新，任务会在下次计划时间重试
                # 这是合理的行为：避免失败任务被无限重试
        
        return triggered_count
    
    # ==================== 内部方法 ====================
    
    def _trigger_scan_now(self, scheduled_scan: ScheduledScan) -> int:
        """
        立即触发扫描（支持组织扫描和目标扫描两种模式）
        
        复用 ScanService 的逻辑，与 API 调用保持一致。
        """
        from apps.scan.services.scan_service import ScanService
        
        scan_service = ScanService()
        
        # 1. 准备扫描所需数据（复用 API 的逻辑）
        targets, engine = scan_service.prepare_initiate_scan(
            organization_id=scheduled_scan.organization_id,
            target_id=scheduled_scan.target_id,
            engine_id=scheduled_scan.engine_id
        )
        
        # 2. 创建扫描任务，传递定时扫描名称用于通知显示
        created_scans = scan_service.create_scans(
            targets, engine,
            scheduled_scan_name=scheduled_scan.name
        )
        
        logger.info(
            "定时扫描已触发 - ScheduledScan ID: %s, 创建扫描数: %d",
            scheduled_scan.id, len(created_scans)
        )
        return len(created_scans)
    
    # ==================== 辅助方法 ====================
    
    def _calculate_next_run_time(self, scheduled_scan: ScheduledScan) -> Optional[datetime]:
        """
        计算下次执行时间
        
        Args:
            scheduled_scan: 定时扫描对象
        
        Returns:
            下次执行时间，once 类型返回 None
        """
        from croniter import croniter
        from django.utils import timezone
        
        cron_expr = scheduled_scan.cron_expression
        if not cron_expr:
            return None
        
        try:
            cron = croniter(cron_expr, timezone.now())
            return cron.get_next(datetime)
        except Exception as e:
            logger.error("计算下次执行时间失败: %s", e)
            return None
