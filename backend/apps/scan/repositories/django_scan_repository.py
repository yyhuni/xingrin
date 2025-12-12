"""
Scan 数据访问层 Django ORM 实现

基于 Django ORM 的 Scan Repository 实现类
"""

from __future__ import annotations

import logging
from typing import List, Tuple, Dict
from datetime import datetime

from django.db import transaction, DatabaseError
from django.db.models import QuerySet, F, Value, Func, Count
from django.utils import timezone

from apps.scan.models import Scan
from apps.targets.models import Target
from apps.engine.models import ScanEngine
from apps.common.definitions import ScanStatus
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoScanRepository:
    """基于 Django ORM 的 Scan 数据访问层实现"""
    
    # ==================== 基础 CRUD 操作 ====================
    
    
    def get_by_id(self,
        scan_id: int, 
        prefetch_relations: bool = False,
        for_update: bool = False
    ) -> Scan | None:
        """
        根据 ID 获取扫描任务
        
        Args:
            scan_id: 扫描任务 ID
            prefetch_relations: 是否预加载关联对象（engine, target）
                              默认 False，只在需要展示关联信息时设为 True
            for_update: 是否加锁（用于更新场景）
        
        Returns:
            Scan 对象或 None
        """
        try:
            # 根据是否需要更新来决定是否加锁
            if for_update:
                queryset = Scan.objects.select_for_update()  # type: ignore  # pylint: disable=no-member
            else:
                queryset = Scan.objects  # type: ignore  # pylint: disable=no-member
            
            # 预加载关联对象（性能优化：默认不加载）
            if prefetch_relations:
                queryset = queryset.select_related('engine', 'target')
            
            return queryset.get(id=scan_id)
        except Scan.DoesNotExist:  # type: ignore  # pylint: disable=no-member
            logger.warning("Scan 不存在 - Scan ID: %s", scan_id)
            return None
    
    
    def get_by_id_for_update(self, scan_id: int) -> Scan | None:
        """
        根据 ID 获取扫描任务（加锁）
        
        用于需要更新的场景，避免并发冲突。
        不预加载关联对象，保持查询最小化，提高加锁性能。
        
        Args:
            scan_id: 扫描任务 ID
        
        Returns:
            Scan 对象或 None
        
        Note:
            - 使用默认的阻塞模式（等待锁释放）
            - 不包含关联对象（engine, target），如需关联对象请使用 get_by_id()
        """
        try:
            return Scan.objects.select_for_update().get(id=scan_id)  # type: ignore  # pylint: disable=no-member
        except Scan.DoesNotExist:  # type: ignore  # pylint: disable=no-member
            logger.warning("Scan 不存在 - Scan ID: %s", scan_id)
            return None
    
    
    def exists(self, scan_id: int) -> bool:
        """
        检查扫描任务是否存在
        
        Args:
            scan_id: 扫描任务 ID
        
        Returns:
            是否存在
        """
        return Scan.objects.filter(id=scan_id).exists()
    
    
    def create(self,
        target: Target,
        engine: ScanEngine,
        results_dir: str,
        status: ScanStatus = ScanStatus.INITIATED
    ) -> Scan:
        """
        创建扫描任务
        
        Args:
            target: 扫描目标
            engine: 扫描引擎
            results_dir: 结果目录
            status: 初始状态
        
        Returns:
            创建的 Scan 对象
        """
        scan = Scan(
            target=target,
            engine=engine,
            results_dir=results_dir,
            status=status,
            container_ids=[]
        )
        scan.save()
        logger.debug("创建 Scan - ID: %s, Target: %s", scan.id, target.name)
        return scan
    
    
    def bulk_create(self, scans: List[Scan]) -> List[Scan]:
        """
        批量创建扫描任务
        
        Args:
            scans: Scan 对象列表
        
        Returns:
            创建的 Scan 对象列表
        """
        created_scans = Scan.objects.bulk_create(scans)  # type: ignore  # pylint: disable=no-member
        logger.debug("批量创建 Scan - 数量: %d", len(created_scans))
        return created_scans
    
    
    def soft_delete_by_ids(self, scan_ids: List[int]) -> int:
        """
        根据 ID 列表批量软删除 Scan
        
        Args:
            scan_ids: Scan ID 列表
        
        Returns:
            软删除的记录数
        """
        try:
            updated_count = (
                Scan.objects
                .filter(id__in=scan_ids)
                .update(deleted_at=timezone.now())
            )
            logger.debug(
                "批量软删除 Scan 成功 - Count: %s, 更新记录: %s",
                len(scan_ids),
                updated_count
            )
            return updated_count
        except Exception as e:
            logger.error(
                "批量软删除 Scan 失败 - IDs: %s, 错误: %s",
                scan_ids,
                e
            )
            raise

    def hard_delete_by_ids(self, scan_ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        根据 ID 列表硬删除 Scan（使用数据库级 CASCADE）
        
        Args:
            scan_ids: Scan ID 列表
        
        Returns:
            (删除的记录数, 删除详情字典)
        """
        try:
            batch_size = 1000
            total_deleted = 0
            
            logger.debug(f"开始批量删除 {len(scan_ids)} 个 Scan（数据库 CASCADE）...")
            
            for i in range(0, len(scan_ids), batch_size):
                batch_ids = scan_ids[i:i + batch_size]
                count, _ = Scan.all_objects.filter(id__in=batch_ids).delete()
                total_deleted += count
                logger.debug(f"批次删除完成: {len(batch_ids)} 个 Scan，删除 {count} 条记录")
            
            deleted_details = {
                'scans': len(scan_ids),
                'total': total_deleted,
                'note': 'Database CASCADE - detailed stats unavailable'
            }
            
            logger.debug(
                "批量硬删除成功（CASCADE）- Scan数: %s, 总删除记录: %s",
                len(scan_ids),
                total_deleted
            )
            
            return total_deleted, deleted_details
        
        except Exception as e:
            logger.error(
                "批量硬删除失败（CASCADE）- Scan数: %s, 错误: %s",
                len(scan_ids),
                str(e),
                exc_info=True
            )
            raise
    

    
    # ==================== 查询操作 ====================
    
    
    def get_all(self, prefetch_relations: bool = True) -> QuerySet[Scan]:
        """
        获取所有扫描任务
        
        Args:
            prefetch_relations: 是否预加载关联对象（engine, target）
        
        Returns:
            Scan QuerySet
        """
        queryset = Scan.objects.all()  # type: ignore  # pylint: disable=no-member
        if prefetch_relations:
            queryset = queryset.select_related('engine', 'target')
        return queryset.order_by('-created_at')
    
    
    def get_statistics(self) -> dict:
        """
        获取扫描任务统计数据
        
        Returns:
            统计数据字典
        
        Note:
            使用缓存字段聚合，性能优异
        """
        from django.db.models import Sum
        
        # 基础统计
        total_scans = Scan.objects.count()  # type: ignore  # pylint: disable=no-member
        
        # 按状态统计
        running_scans = Scan.objects.filter(status='running').count()  # type: ignore  # pylint: disable=no-member
        completed_scans = Scan.objects.filter(status='completed').count()  # type: ignore  # pylint: disable=no-member
        failed_scans = Scan.objects.filter(status='failed').count()  # type: ignore  # pylint: disable=no-member
        
        # 使用缓存字段聚合统计（只统计已完成的扫描）
        aggregated = Scan.objects.filter(status='completed').aggregate(  # type: ignore  # pylint: disable=no-member
            total_vulns=Sum('cached_vulns_total'),
            total_subdomains=Sum('cached_subdomains_count'),
            total_endpoints=Sum('cached_endpoints_count'),
            total_websites=Sum('cached_websites_count'),
            total_ips=Sum('cached_ips_count'),
        )
        
        total_vulns = aggregated['total_vulns'] or 0
        total_subdomains = aggregated['total_subdomains'] or 0
        total_endpoints = aggregated['total_endpoints'] or 0
        total_websites = aggregated['total_websites'] or 0
        total_ips = aggregated['total_ips'] or 0
        
        return {
            'total': total_scans,
            'running': running_scans,
            'completed': completed_scans,
            'failed': failed_scans,
            'total_vulns': total_vulns,
            'total_subdomains': total_subdomains,
            'total_endpoints': total_endpoints,
            'total_websites': total_websites,
            'total_ips': total_ips,
            'total_assets': total_subdomains + total_endpoints + total_websites + total_ips,
        }
    
    
    
    # ==================== 状态更新操作 ====================
    
    
    @transaction.atomic
    def update_status(self,
        scan_id: int,
        status: ScanStatus,
        error_message: str | None = None,
        stopped_at: datetime | None = None
    ) -> bool:
        """
        更新扫描任务状态
        
        Args:
            scan_id: 扫描任务 ID
            status: 新状态
            error_message: 错误消息（可选）
            stopped_at: 结束时间（可选，由调用方决定是否传递）
        
        Returns:
            是否更新成功
        
        Note:
            Repository 层不判断业务状态,只负责数据更新
            created_at 是自动设置的，不需要手动传递
        """
        scan = self.get_by_id_for_update(scan_id)
        if not scan:
            return False
        
        scan.status = status
        
        if error_message:
            if len(error_message) > 2000:
                scan.error_message = error_message[:1980] + "... (已截断)"
                logger.warning(
                    "错误信息过长（%d 字符），已截断 - Scan ID: %s",
                    len(error_message), scan_id
                )
            else:
                scan.error_message = error_message
        
        # 根据传递的参数更新时间戳（由调用方决定）
        if stopped_at is not None:
            scan.stopped_at = stopped_at
        
        scan.save()
        logger.debug(
            "更新 Scan 状态 - ID: %s, 状态: %s",
            scan_id,
            ScanStatus(status).label
        )
        return True
    
    
    def append_container_id(self, scan_id: int, container_id: str) -> bool:
        """
        追加容器 ID 到 container_ids 数组（并发安全）
        
        使用 PostgreSQL 的 array_append 函数在数据库层面进行原子操作，
        避免并发场景下的 Race Condition。
        
        Args:
            scan_id: 扫描任务 ID
            container_id: Docker 容器 ID
        
        Returns:
            是否追加成功
        
        Note:
            - 使用 F 表达式和 ArrayAppend 确保并发安全
            - 生成的 SQL: UPDATE scan SET container_ids = array_append(container_ids, ?)
        """
        try:
            container_field = Scan._meta.get_field('container_ids')
            updated_count = Scan.objects.filter(id=scan_id).update(  # type: ignore
                container_ids=Func(
                    F('container_ids'),
                    Value(container_id),
                    function='ARRAY_APPEND',
                    output_field=container_field
                )
            )
            
            if updated_count > 0:
                logger.debug("追加容器 ID - Scan ID: %s, Container ID: %s", scan_id, container_id)
                return True
            else:
                logger.warning("Scan 不存在，无法追加容器 ID - Scan ID: %s", scan_id)
                return False
        except DatabaseError as e:
            logger.error("追加容器 ID 失败 - Scan ID: %s, 错误: %s", scan_id, e)
            return False
    
    
    def update_worker(self, scan_id: int, worker_id: int) -> bool:
        """
        更新扫描任务的 Worker ID
        
        Args:
            scan_id: 扫描任务 ID
            worker_id: Worker 节点 ID
        
        Returns:
            是否更新成功
        """
        try:
            updated_count = Scan.objects.filter(id=scan_id).update(worker_id=worker_id)  # type: ignore
            
            if updated_count > 0:
                logger.debug("更新 Worker ID - Scan ID: %s, Worker ID: %s", scan_id, worker_id)
                return True
            else:
                logger.warning("Scan 不存在，无法更新 Worker ID - Scan ID: %s", scan_id)
                return False
        except DatabaseError as e:
            logger.error("更新 Worker ID 失败 - Scan ID: %s, 错误: %s", scan_id, e)
            return False
    
    
    def update_cached_stats(self, scan_id: int) -> dict | None:
        """
        更新扫描任务的缓存统计数据
        
        使用 Django ORM 聚合查询，避免原生 SQL，保持数据库抽象
        
        Args:
            scan_id: 扫描任务 ID
        
        Returns:
            成功返回统计数据字典，失败返回 None
        """
        try:
            from apps.asset.models import VulnerabilitySnapshot

            scan = self.get_by_id(scan_id, prefetch_relations=False)
            if not scan:
                logger.error("Scan 不存在，无法更新缓存统计数据 - Scan ID: %s", scan_id)
                return None
            
            # 统计快照数据（用于扫描历史）
            # IP 数量需要按 IP 去重统计
            ips_count = scan.host_port_mapping_snapshots.values('ip').distinct().count()

            # 漏洞统计：按扫描维度基于 VulnerabilitySnapshot 聚合
            vuln_qs = VulnerabilitySnapshot.objects.filter(scan_id=scan_id)
            total_vulns = vuln_qs.count()

            severity_stats = {
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0,
            }

            for row in vuln_qs.values('severity').annotate(count=Count('id')):
                sev = (row.get('severity') or '').lower()
                count = row.get('count') or 0
                if sev in severity_stats:
                    severity_stats[sev] = count
            
            stats = {
                'subdomains': scan.subdomain_snapshots.count(),
                'websites': scan.website_snapshots.count(), 
                'endpoints': scan.endpoint_snapshots.count(),
                'ips': ips_count,
                'directories': scan.directory_snapshots.count(),
                'vulns_total': total_vulns,
                'vulns_critical': severity_stats['critical'],
                'vulns_high': severity_stats['high'],
                'vulns_medium': severity_stats['medium'],
                'vulns_low': severity_stats['low'],
            }
            
            # 批量更新字段（使用 cached_ 前缀的字段名）
            cached_stats = {
                'cached_subdomains_count': stats['subdomains'],
                'cached_websites_count': stats['websites'], 
                'cached_endpoints_count': stats['endpoints'],
                'cached_ips_count': stats['ips'],
                'cached_directories_count': stats['directories'],
                'cached_vulns_total': stats['vulns_total'],
                'cached_vulns_critical': stats['vulns_critical'],
                'cached_vulns_high': stats['vulns_high'],
                'cached_vulns_medium': stats['vulns_medium'],
                'cached_vulns_low': stats['vulns_low'],
                'stats_updated_at': timezone.now()
            }
            
            for field, value in cached_stats.items():
                setattr(scan, field, value)
            
            scan.save(update_fields=list(cached_stats.keys()))
            
            logger.debug("更新缓存统计数据成功 - Scan ID: %s", scan_id)
            return stats
        except DatabaseError as e:
            logger.exception("数据库错误：更新缓存统计数据失败 - Scan ID: %s", scan_id)
            return None
        except Exception as e:
            logger.error("更新缓存统计数据失败 - Scan ID: %s, 错误: %s", scan_id, e)
            return None
    
    
    def update_status_if_match(self,
        scan_id: int,
        current_status: ScanStatus,
        new_status: ScanStatus,
        stopped_at: datetime | None = None
    ) -> bool:
        """
        条件更新扫描状态（原子操作）
        
        仅当扫描状态匹配 current_status 时才更新为 new_status。
        这是一个原子操作，用于处理并发场景下的状态更新。
        
        Args:
            scan_id: 扫描ID
            current_status: 当前期望的状态
            new_status: 要更新到的新状态
            stopped_at: 停止时间（可选）
        
        Returns:
            bool: 是否更新成功（True=更新了记录，False=未更新）
        """
        try:
            update_fields = {
                'status': new_status,
            }
            
            if stopped_at:
                update_fields['stopped_at'] = stopped_at
            
            # 原子操作：只有状态匹配时才更新
            updated = Scan.objects.filter(
                id=scan_id,
                status=current_status
            ).update(**update_fields)
            
            if updated > 0:
                logger.debug(
                    "条件更新扫描状态成功 - Scan ID: %s, %s → %s",
                    scan_id,
                    current_status.value,
                    new_status.value
                )
                return True
            else:
                logger.debug(
                    "条件更新扫描状态跳过（状态不匹配） - Scan ID: %s, 期望: %s, 目标: %s",
                    scan_id,
                    current_status.value,
                    new_status.value
                )
                return False
                
        except Exception as e:
            logger.error(
                "条件更新扫描状态失败 - Scan ID: %s, %s → %s, 错误: %s",
                scan_id,
                current_status.value,
                new_status.value,
                e
            )
            return False
    
    
    def update_progress(
        self,
        scan_id: int,
        progress: int | None = None,
        current_stage: str | None = None,
        stage_progress: dict | None = None
    ) -> bool:
        """
        更新扫描进度信息
        
        Args:
            scan_id: 扫描任务 ID
            progress: 进度百分比 0-100（可选）
            current_stage: 当前阶段（可选）
            stage_progress: 各阶段详情（可选）
        
        Returns:
            是否更新成功
        """
        try:
            update_fields = {}
            
            if progress is not None:
                update_fields['progress'] = progress
            
            if current_stage is not None:
                update_fields['current_stage'] = current_stage
            
            if stage_progress is not None:
                update_fields['stage_progress'] = stage_progress
            
            if not update_fields:
                return True  # 无需更新
            
            updated = Scan.objects.filter(id=scan_id).update(**update_fields)
            
            if updated > 0:
                logger.debug(
                    "更新扫描进度 - Scan ID: %s, progress: %s, stage: %s",
                    scan_id,
                    progress,
                    current_stage
                )
                return True
            else:
                logger.warning("Scan 不存在，无法更新进度 - Scan ID: %s", scan_id)
                return False
                
        except Exception as e:
            logger.error(
                "更新扫描进度失败 - Scan ID: %s, 错误: %s",
                scan_id,
                e
            )
            return False


# 导出接口
__all__ = ['DjangoScanRepository']
