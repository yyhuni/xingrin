"""
扫描任务服务

负责 Scan 模型的所有业务逻辑
"""

from __future__ import annotations

import logging
import uuid
from typing import Dict, List, TYPE_CHECKING
from datetime import datetime
from pathlib import Path
from django.conf import settings
from django.db import transaction
from django.db.utils import DatabaseError, IntegrityError, OperationalError
from django.core.exceptions import ValidationError, ObjectDoesNotExist

from apps.scan.models import Scan
from apps.scan.repositories import DjangoScanRepository
from apps.targets.repositories import DjangoTargetRepository, DjangoOrganizationRepository
from apps.engine.repositories import DjangoEngineRepository
from apps.targets.models import Target
from apps.engine.models import ScanEngine
from apps.common.definitions import ScanStatus

logger = logging.getLogger(__name__)


class ScanService:
    """
    扫描任务服务（协调者）
    
    职责：
    - 协调各个子服务
    - 提供统一的公共接口
    - 保持向后兼容
    
    注意：
    - 具体业务逻辑已拆分到子服务
    - 本类主要负责委托和协调
    """
    
    # 终态集合：这些状态一旦设置，不应该被覆盖
    FINAL_STATUSES = {
        ScanStatus.COMPLETED,
        ScanStatus.FAILED,
        ScanStatus.CANCELLED
    }
    
    def __init__(self):
        """
        初始化服务
        """
        # 初始化子服务
        from apps.scan.services.scan_creation_service import ScanCreationService
        from apps.scan.services.scan_state_service import ScanStateService
        from apps.scan.services.scan_control_service import ScanControlService
        from apps.scan.services.scan_stats_service import ScanStatsService
        
        self.creation_service = ScanCreationService()
        self.state_service = ScanStateService()
        self.control_service = ScanControlService()
        self.stats_service = ScanStatsService()
        
        # 保留 ScanRepository（用于 get_scan 方法）
        self.scan_repo = DjangoScanRepository()
    
    def get_scan(self, scan_id: int, prefetch_relations: bool) -> Scan | None:
        """
        获取扫描任务（包含关联对象）
        
        自动预加载 engine 和 target，避免 N+1 查询问题
        
        Args:
            scan_id: 扫描任务 ID
        
        Returns:
            Scan 对象（包含 engine 和 target）或 None
        """
        return self.scan_repo.get_by_id(scan_id, prefetch_relations)
    
    def get_all_scans(self, prefetch_relations: bool = True):
        return self.scan_repo.get_all(prefetch_relations=prefetch_relations)
    
    def prepare_initiate_scan(
        self,
        organization_id: int | None = None,
        target_id: int | None = None,
        engine_id: int | None = None
    ) -> tuple[List[Target], ScanEngine]:
        """
        为创建扫描任务做准备，返回所需的目标列表和扫描引擎
        """
        return self.creation_service.prepare_initiate_scan(
            organization_id, target_id, engine_id
        )
    
    def create_scans(
        self,
        targets: List[Target],
        engine: ScanEngine,
        scheduled_scan_name: str | None = None
    ) -> List[Scan]:
        """批量创建扫描任务（委托给 ScanCreationService）"""
        return self.creation_service.create_scans(targets, engine, scheduled_scan_name)
    
    # ==================== 状态管理方法（委托给 ScanStateService） ====================
    
    def update_status(
        self, 
        scan_id: int, 
        status: ScanStatus, 
        error_message: str | None = None,
        stopped_at: datetime | None = None
    ) -> bool:
        """更新 Scan 状态（委托给 ScanStateService）"""
        return self.state_service.update_status(
            scan_id, status, error_message, stopped_at
        )
    
    def update_status_if_match(
        self,
        scan_id: int,
        current_status: ScanStatus,
        new_status: ScanStatus,
        stopped_at: datetime | None = None
    ) -> bool:
        """条件更新 Scan 状态（委托给 ScanStateService）"""
        return self.state_service.update_status_if_match(
            scan_id, current_status, new_status, stopped_at
        )
    
    def update_cached_stats(self, scan_id: int) -> dict | None:
        """更新缓存统计数据（委托给 ScanStateService），返回统计数据字典"""
        return self.state_service.update_cached_stats(scan_id)
    
    # ==================== 进度跟踪方法（委托给 ScanStateService） ====================
    
    def init_stage_progress(self, scan_id: int, stages: list[str]) -> bool:
        """初始化阶段进度（委托给 ScanStateService）"""
        return self.state_service.init_stage_progress(scan_id, stages)
    
    def start_stage(self, scan_id: int, stage: str) -> bool:
        """开始执行某个阶段（委托给 ScanStateService）"""
        return self.state_service.start_stage(scan_id, stage)
    
    def complete_stage(self, scan_id: int, stage: str, detail: str | None = None) -> bool:
        """完成某个阶段（委托给 ScanStateService）"""
        return self.state_service.complete_stage(scan_id, stage, detail)
    
    def fail_stage(self, scan_id: int, stage: str, error: str | None = None) -> bool:
        """标记某个阶段失败（委托给 ScanStateService）"""
        return self.state_service.fail_stage(scan_id, stage, error)
    
    def cancel_running_stages(self, scan_id: int, final_status: str = "cancelled") -> bool:
        """取消所有正在运行的阶段（委托给 ScanStateService）"""
        return self.state_service.cancel_running_stages(scan_id, final_status)
    
    # ==================== 删除和控制方法（委托给 ScanControlService） ====================
    
    def delete_scans_two_phase(self, scan_ids: List[int]) -> dict:
        """两阶段删除扫描任务（委托给 ScanControlService）"""
        return self.control_service.delete_scans_two_phase(scan_ids)
    
    def stop_scan(self, scan_id: int) -> tuple[bool, int]:
        """停止扫描任务（委托给 ScanControlService）"""
        return self.control_service.stop_scan(scan_id)
    
    def hard_delete_scans(self, scan_ids: List[int]) -> tuple[int, Dict[str, int]]:
        """
        硬删除扫描任务（真正删除数据）
        
        用于 Worker 容器中执行，删除已软删除的扫描及其关联数据。
        
        Args:
            scan_ids: 扫描任务 ID 列表
            
        Returns:
            (删除数量, 详情字典)
        """
        return self.scan_repo.hard_delete_by_ids(scan_ids)
    
    # ==================== 统计方法（委托给 ScanStatsService） ====================
    
    def get_statistics(self) -> dict:
        """获取扫描统计数据（委托给 ScanStatsService）"""
        return self.stats_service.get_statistics()
    


# 导出接口
__all__ = ['ScanService']
