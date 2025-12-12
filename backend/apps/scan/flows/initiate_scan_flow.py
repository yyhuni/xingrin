"""
扫描初始化 Flow

负责编排扫描任务的初始化流程

职责：
- 使用 FlowOrchestrator 解析 YAML 配置
- 在 Prefect Flow 中执行子 Flow（Subflow）
- 按照 YAML 顺序编排工作流
- 不包含具体业务逻辑（由 Tasks 和 FlowOrchestrator 实现）

架构：
- Flow: Prefect 编排层（本文件）
- FlowOrchestrator: 配置解析和执行计划（apps/scan/services/）
- Tasks: 执行层（apps/scan/tasks/）
- Handlers: 状态管理（apps/scan/handlers/）
"""

# Django 环境初始化（导入即生效）
# 注意：动态扫描容器应使用 run_initiate_scan.py 启动，以便在导入前设置环境变量
from apps.common.prefect_django_setup import setup_django_for_prefect

from prefect import flow, task
from pathlib import Path
import logging

from apps.scan.handlers import (
    on_initiate_scan_flow_running,
    on_initiate_scan_flow_completed,
    on_initiate_scan_flow_failed,
)
from prefect.futures import wait
from apps.scan.tasks.workspace_tasks import create_scan_workspace_task
from apps.scan.orchestrators import FlowOrchestrator

logger = logging.getLogger(__name__)


@task(name="run_subflow")
def _run_subflow_task(scan_type: str, flow_func, flow_kwargs: dict):
    """包装子 Flow 的 Task，用于在并行阶段并发执行子 Flow。"""
    logger.info("开始执行子 Flow: %s", scan_type)
    return flow_func(**flow_kwargs)


@flow(
    name='initiate_scan',
    description='扫描任务初始化流程',
    log_prints=True,
    on_running=[on_initiate_scan_flow_running],
    on_completion=[on_initiate_scan_flow_completed],
    on_failure=[on_initiate_scan_flow_failed],
)
def initiate_scan_flow(
    scan_id: int,
    target_name: str,
    target_id: int,
    scan_workspace_dir: str,
    engine_name: str,
    scheduled_scan_name: str | None = None,
) -> dict:
    """
    初始化扫描任务（动态工作流编排）
    
    根据 YAML 配置动态编排工作流：
    - 从数据库获取 engine_config (YAML)
    - 检测启用的扫描类型
    - 按照定义的阶段执行：
      Stage 1: Discovery (顺序执行)
        - subdomain_discovery
        - port_scan
        - site_scan
      Stage 2: Analysis (并行执行)
        - url_fetch
        - directory_scan
    
    Args:
        scan_id: 扫描任务 ID
        target_name: 目标名称
        target_id: 目标 ID
        scan_workspace_dir: Scan 工作空间目录路径
        engine_name: 引擎名称（用于显示）
        scheduled_scan_name: 定时扫描任务名称（可选，用于通知显示）
    
    Returns:
        dict: 执行结果摘要
    
    Raises:
        ValueError: 参数验证失败或配置无效
        RuntimeError: 执行失败
    """
    try:
        # ==================== 参数验证 ====================
        if not scan_id:
            raise ValueError("scan_id is required")
        if not scan_workspace_dir:
            raise ValueError("scan_workspace_dir is required")
        if not engine_name:
            raise ValueError("engine_name is required")
        
        
        logger.info(
            "="*60 + "\n" +
            "开始初始化扫描任务\n" +
            f"  Scan ID: {scan_id}\n" +
            f"  Target: {target_name}\n" +
            f"  Engine: {engine_name}\n" +
            f"  Workspace: {scan_workspace_dir}\n" +
            "="*60
        )
        
        # ==================== Task 1: 创建 Scan 工作空间 ====================
        scan_workspace_path = create_scan_workspace_task(scan_workspace_dir)
        
        # ==================== Task 2: 获取引擎配置 ====================
        from apps.scan.models import Scan
        scan = Scan.objects.select_related('engine').get(id=scan_id)
        engine_config = scan.engine.configuration
        
        # ==================== Task 3: 解析配置，生成执行计划 ====================
        orchestrator = FlowOrchestrator(engine_config)
        
        # FlowOrchestrator 已经解析了所有工具配置
        enabled_tools_by_type = orchestrator.enabled_tools_by_type
        
        logger.info(
            f"执行计划生成成功：\n"
            f"  扫描类型: {' → '.join(orchestrator.scan_types)}\n"
            f"  总共 {len(orchestrator.scan_types)} 个 Flow"
        )
        
        # ==================== 初始化阶段进度 ====================
        # 在解析完配置后立即初始化，此时已有完整的 scan_types 列表
        from apps.scan.services import ScanService
        scan_service = ScanService()
        scan_service.init_stage_progress(scan_id, orchestrator.scan_types)
        logger.info(f"✓ 初始化阶段进度 - Stages: {orchestrator.scan_types}")
        
        # ==================== 更新 Target 最后扫描时间 ====================
        # 在开始扫描时更新，表示"最后一次扫描开始时间"
        from apps.targets.services import TargetService
        target_service = TargetService()
        target_service.update_last_scanned_at(target_id)
        logger.info(f"✓ 更新 Target 最后扫描时间 - Target ID: {target_id}")
        
        # ==================== Task 3: 执行 Flow（动态阶段执行）====================
        # 注意：各阶段状态更新由 scan_flow_handlers.py 自动处理（running/completed/failed）
        executed_flows = []
        results = {}
        
        # 通用执行参数
        flow_kwargs = {
            'scan_id': scan_id,
            'target_name': target_name,
            'target_id': target_id,
            'scan_workspace_dir': str(scan_workspace_path)
        }

        def record_flow_result(scan_type, result=None, error=None):
            """
            统一的结果记录函数
            
            Args:
                scan_type: 扫描类型名称
                result: 执行结果（成功时）
                error: 异常对象（失败时）
            """
            if error:
                # 失败处理：记录错误但不抛出异常，让扫描继续执行后续阶段
                error_msg = f"{scan_type} 执行失败: {str(error)}"
                logger.warning(error_msg)
                executed_flows.append(f"{scan_type} (失败)")
                results[scan_type] = {'success': False, 'error': str(error)}
                # 不再抛出异常，让扫描继续
            else:
                # 成功处理
                executed_flows.append(scan_type)
                results[scan_type] = result
                logger.info(f"✓ {scan_type} 执行成功")

        def get_valid_flows(flow_names):
            """
            获取有效的 Flow 函数列表，并为每个 Flow 准备专属参数
            
            Args:
                flow_names: 扫描类型名称列表
                
            Returns:
                list: [(scan_type, flow_func, flow_specific_kwargs), ...] 有效的函数列表
            """
            valid_flows = []
            for scan_type in flow_names:
                flow_func = orchestrator.get_flow_function(scan_type)
                if flow_func:
                    # 为每个 Flow 准备专属的参数（包含对应的 enabled_tools）
                    flow_specific_kwargs = dict(flow_kwargs)
                    flow_specific_kwargs['enabled_tools'] = enabled_tools_by_type.get(scan_type, {})
                    valid_flows.append((scan_type, flow_func, flow_specific_kwargs))
                else:
                    logger.warning(f"跳过未实现的 Flow: {scan_type}")
            return valid_flows

        # ---------------------------------------------------------
        # 动态阶段执行（基于 FlowOrchestrator 定义）
        # ---------------------------------------------------------
        for mode, enabled_flows in orchestrator.get_execution_stages():
            if mode == 'sequential':
                # 顺序执行
                logger.info(f"\n{'='*60}\n顺序执行阶段: {', '.join(enabled_flows)}\n{'='*60}")
                for scan_type, flow_func, flow_specific_kwargs in get_valid_flows(enabled_flows):
                    logger.info(f"\n{'='*60}\n执行 Flow: {scan_type}\n{'='*60}")
                    try:
                        result = flow_func(**flow_specific_kwargs)
                        record_flow_result(scan_type, result=result)
                    except Exception as e:
                        record_flow_result(scan_type, error=e)
                    
            elif mode == 'parallel':
                # 并行执行阶段：通过 Task 包装子 Flow，并使用 Prefect TaskRunner 并发运行
                logger.info(f"\n{'='*60}\n并行执行阶段: {', '.join(enabled_flows)}\n{'='*60}")
                futures = []

                # 提交所有并行子 Flow 任务
                for scan_type, flow_func, flow_specific_kwargs in get_valid_flows(enabled_flows):
                    logger.info(f"\n{'='*60}\n提交并行子 Flow 任务: {scan_type}\n{'='*60}")
                    future = _run_subflow_task.submit(
                        scan_type=scan_type,
                        flow_func=flow_func,
                        flow_kwargs=flow_specific_kwargs,
                    )
                    futures.append((scan_type, future))

                # 等待所有并行子 Flow 完成
                if futures:
                    wait([f for _, f in futures])

                    # 检查结果（复用统一的结果处理逻辑）
                    for scan_type, future in futures:
                        try:
                            result = future.result()
                            record_flow_result(scan_type, result=result)
                        except Exception as e:
                            record_flow_result(scan_type, error=e)

        # ==================== 完成 ====================
        logger.info(
            "="*60 + "\n" +
            "✓ 扫描任务初始化完成\n" +
            f"  执行的 Flow: {', '.join(executed_flows)}\n" +
            "="*60
        )
        
        # ==================== 返回结果 ====================
        return {
            'success': True,
            'scan_id': scan_id,
            'target': target_name,
            'scan_workspace_dir': str(scan_workspace_path),
            'executed_flows': executed_flows,
            'results': results
        }
        
    except ValueError as e:
        # 参数错误
        logger.error("参数错误: %s", e)
        raise
    except RuntimeError as e:
        # 执行失败
        logger.error("运行时错误: %s", e)
        raise
    except OSError as e:
        # 文件系统错误（工作空间创建失败）
        logger.error("文件系统错误: %s", e)
        raise
    except Exception as e:
        # 其他未预期错误
        logger.exception("初始化扫描任务失败: %s", e)
        # 注意：失败状态更新由 Prefect State Handlers 自动处理
        raise
