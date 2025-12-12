"""
initiate_scan_flow 状态处理器

负责 initiate_scan_flow 生命周期的状态同步：
- on_running: Flow 开始运行时更新扫描状态为 RUNNING
- on_completion: Flow 成功完成时更新扫描状态为 COMPLETED
- on_failure: Flow 失败时更新扫描状态为 FAILED（包括超时、异常、docker stop 等）

策略：快速失败（Fail-Fast）
- 任何子任务失败都会导致 Flow 失败
- Flow 成功 = 所有任务成功
"""

import logging
from prefect import Flow
from prefect.client.schemas import FlowRun, State

logger = logging.getLogger(__name__)



def on_initiate_scan_flow_running(flow: Flow, flow_run: FlowRun, state: State) -> None:
    """
    initiate_scan_flow 开始运行时的回调
    
    职责：更新 Scan 状态为 RUNNING + 发送通知
    
    触发时机：
    - Prefect Flow 状态变为 Running 时自动触发
    - 在 Flow 函数体执行之前调用
    
    Args:
        flow: Prefect Flow 对象
        flow_run: Flow 运行实例
        state: Flow 当前状态
    """
    logger.info("🚀 initiate_scan_flow_running 回调开始运行 - Flow Run: %s", flow_run.id)
    
    scan_id = flow_run.parameters.get('scan_id')
    target_name = flow_run.parameters.get('target_name')
    engine_name = flow_run.parameters.get('engine_name')
    scheduled_scan_name = flow_run.parameters.get('scheduled_scan_name')
    
    if not scan_id:
        logger.warning(
            "Flow 参数中缺少 scan_id，跳过状态更新 - Flow Run: %s",
            flow_run.id
        )
        return
    
    def _update_running_status():
        from apps.scan.services import ScanService
        from apps.common.definitions import ScanStatus
        
        service = ScanService()
        success = service.update_status(
            scan_id, 
            ScanStatus.RUNNING
        )
        
        if success:
            logger.info(
                "✓ Flow 状态回调：扫描状态已更新为 RUNNING - Scan ID: %s, Flow Run: %s",
                scan_id,
                flow_run.id
            )
        else:
            logger.error(
                "✗ Flow 状态回调：更新扫描状态失败 - Scan ID: %s",
                scan_id
            )
        return success
    
    # 执行状态更新（Repository 层已有 @auto_ensure_db_connection 保证连接可靠性）
    _update_running_status()
    
    # 发送通知
    logger.info("准备发送扫描开始通知 - Scan ID: %s, Target: %s", scan_id, target_name)
    try:
        from apps.scan.notifications import create_notification, NotificationLevel, NotificationCategory
        
        # 根据是否为定时扫描构建不同的标题和消息
        if scheduled_scan_name:
            title = f"⏰ {target_name} 扫描开始"
            message = f"定时任务：{scheduled_scan_name}\n引擎：{engine_name}"
        else:
            title = f"{target_name} 扫描开始"
            message = f"引擎：{engine_name}"
        
        create_notification(
            title=title,
            message=message,
            level=NotificationLevel.MEDIUM,
            category=NotificationCategory.SCAN
        )
        logger.info("✓ 扫描开始通知已发送 - Scan ID: %s, Target: %s", scan_id, target_name)
    except Exception as e:
        logger.error(f"发送扫描开始通知失败 - Scan ID: {scan_id}: {e}", exc_info=True)


def on_initiate_scan_flow_completed(flow: Flow, flow_run: FlowRun, state: State) -> None:
    """
    initiate_scan_flow 成功完成时的回调
    
    职责：更新 Scan 状态为 COMPLETED
    
    触发时机：
    - Prefect Flow 正常执行完成时自动触发
    - 在 Flow 函数体返回之后调用
    
    策略：快速失败（Fail-Fast）
    - Flow 成功完成 = 所有任务成功 → COMPLETED
    - Flow 执行失败 = 有任务失败 → FAILED (由 on_failed 处理)
    
    竞态条件处理：
    - 如果用户已手动取消（状态已是 CANCELLED），保持终态，不覆盖
    
    Args:
        flow: Prefect Flow 对象
        flow_run: Flow 运行实例
        state: Flow 当前状态
    """
    logger.info("✅ initiate_scan_flow_completed 回调开始运行 - Flow Run: %s", flow_run.id)
    
    scan_id = flow_run.parameters.get('scan_id')
    target_name = flow_run.parameters.get('target_name')
    engine_name = flow_run.parameters.get('engine_name')
    
    if not scan_id:
        return
    
    def _update_completed_status():
        from apps.scan.services import ScanService
        from apps.common.definitions import ScanStatus
        from django.utils import timezone
        
        service = ScanService()
        
        # 仅在运行中时更新为 COMPLETED；其他状态保持不变
        completed_updated = service.update_status_if_match(
            scan_id=scan_id,
            current_status=ScanStatus.RUNNING,
            new_status=ScanStatus.COMPLETED,
            stopped_at=timezone.now()
        )
        
        if completed_updated:
            logger.info(
                "✓ Flow 状态回调：扫描状态已原子更新为 COMPLETED - Scan ID: %s, Flow Run: %s",
                scan_id,
                flow_run.id
            )
            return service.update_cached_stats(scan_id)
        else:
            logger.info(
                "ℹ️ Flow 状态回调：状态未更新（可能已是终态）- Scan ID: %s, Flow Run: %s",
                scan_id,
                flow_run.id
            )
        return None
    
    # 执行状态更新并获取统计数据
    stats = _update_completed_status()
    
    # 发送通知（包含统计摘要）
    logger.info("准备发送扫描完成通知 - Scan ID: %s, Target: %s", scan_id, target_name)
    try:
        from apps.scan.notifications import create_notification, NotificationLevel, NotificationCategory
        
        # 构建通知消息
        message = f"引擎：{engine_name}"
        if stats:
            results = []
            results.append(f"子域名: {stats.get('subdomains', 0)}")
            results.append(f"站点: {stats.get('websites', 0)}")
            results.append(f"IP: {stats.get('ips', 0)}")
            results.append(f"端点: {stats.get('endpoints', 0)}")
            results.append(f"目录: {stats.get('directories', 0)}")
            vulns_total = stats.get('vulns_total', 0)
            if vulns_total > 0:
                results.append(f"漏洞: {vulns_total} (严重:{stats.get('vulns_critical', 0)} 高:{stats.get('vulns_high', 0)} 中:{stats.get('vulns_medium', 0)} 低:{stats.get('vulns_low', 0)})")
            else:
                results.append("漏洞: 0")
            message += f"\n结果：{' | '.join(results)}"
        
        create_notification(
            title=f"{target_name} 扫描完成",
            message=message,
            level=NotificationLevel.MEDIUM,
            category=NotificationCategory.SCAN
        )
        logger.info("✓ 扫描完成通知已发送 - Scan ID: %s, Target: %s", scan_id, target_name)
    except Exception as e:
        logger.error(f"发送扫描完成通知失败 - Scan ID: {scan_id}: {e}", exc_info=True)


def on_initiate_scan_flow_failed(flow: Flow, flow_run: FlowRun, state: State) -> None:
    """
    initiate_scan_flow 失败时的回调
    
    职责：更新 Scan 状态为 FAILED，并记录错误信息
    
    触发时机：
    - Prefect Flow 执行失败或抛出异常时自动触发
    - Flow 超时、任务失败等所有失败场景都会触发此回调
    
    竞态条件处理：
    - 如果用户已手动取消（状态已是 CANCELLED），保持终态，不覆盖
    
    Args:
        flow: Prefect Flow 对象
        flow_run: Flow 运行实例
        state: Flow 当前状态（包含错误信息）
    """
    logger.info("❌ initiate_scan_flow_failed 回调开始运行 - Flow Run: %s", flow_run.id)
    
    scan_id = flow_run.parameters.get('scan_id')
    target_name = flow_run.parameters.get('target_name')
    engine_name = flow_run.parameters.get('engine_name')
    
    if not scan_id:
        return
    
    def _update_failed_status():
        from apps.scan.services import ScanService
        from apps.common.definitions import ScanStatus
        from django.utils import timezone
        
        service = ScanService()
        
        # 提取错误信息
        error_message = str(state.message) if state.message else "Flow 执行失败"
        
        # 仅在运行中时更新为 FAILED；其他状态保持不变
        failed_updated = service.update_status_if_match(
            scan_id=scan_id,
            current_status=ScanStatus.RUNNING,
            new_status=ScanStatus.FAILED,
            stopped_at=timezone.now()
        )
        
        if failed_updated:
            # 成功更新（正常失败流程）
            logger.error(
                "✗ Flow 状态回调：扫描状态已原子更新为 FAILED - Scan ID: %s, Flow Run: %s, 错误: %s",
                scan_id,
                flow_run.id,
                error_message
            )
            # 更新缓存统计数据（终态）
            service.update_cached_stats(scan_id)
        else:
            logger.warning(
                "⚠️ Flow 状态回调：未更新任何记录（可能已被其他进程处理）- Scan ID: %s, Flow Run: %s",
                scan_id,
                flow_run.id
            )
        return True
    
    # 执行状态更新
    _update_failed_status()
    
    # 发送通知
    logger.info("准备发送扫描失败通知 - Scan ID: %s, Target: %s", scan_id, target_name)
    try:
        from apps.scan.notifications import create_notification, NotificationLevel, NotificationCategory
        error_message = str(state.message) if state.message else "未知错误"
        message = f"引擎：{engine_name}\n错误：{error_message}"
        create_notification(
            title=f"{target_name} 扫描失败",
            message=message,
            level=NotificationLevel.HIGH,
            category=NotificationCategory.SCAN
        )
        logger.info("✓ 扫描失败通知已发送 - Scan ID: %s, Target: %s", scan_id, target_name)
    except Exception as e:
        logger.error(f"发送扫描失败通知失败 - Scan ID: {scan_id}: {e}", exc_info=True)
