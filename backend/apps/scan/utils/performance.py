"""
性能监控工具模块

提供 Flow 层的性能监控能力

功能：
1. Flow 性能监控 - 记录整体流程耗时、系统资源（CPU/内存）
2. 定时采样 - 每 N 秒记录一次系统资源状态

使用方式：
    # Flow 层（在 handlers 中使用）
    from apps.scan.utils.performance import FlowPerformanceTracker
    tracker = FlowPerformanceTracker(flow_name, scan_id)
    tracker.start()
    # ... 执行流程 ...
    tracker.finish(success=True, result=result)
"""

import logging
import threading
import time
import os
from dataclasses import dataclass, field
from typing import Optional

try:
    import psutil
except ImportError:
    psutil = None

# 性能日志使用专门的 logger
perf_logger = logging.getLogger('performance')
logger = logging.getLogger(__name__)

# 采样间隔（秒）
SAMPLE_INTERVAL = 30


def _get_system_stats() -> dict:
    """
    获取当前系统资源状态
    
    Returns:
        dict: {'cpu_percent': float, 'memory_gb': float}
    """
    if not psutil:
        return {'cpu_percent': 0.0, 'memory_gb': 0.0}
    
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        memory_gb = memory.used / (1024 ** 3)
        return {
            'cpu_percent': cpu_percent,
            'memory_gb': memory_gb
        }
    except Exception:
        return {'cpu_percent': 0.0, 'memory_gb': 0.0}


@dataclass
class FlowPerformanceMetrics:
    """Flow 性能指标"""
    flow_name: str
    scan_id: int
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    
    # 时间指标
    start_time: float = 0.0
    end_time: float = 0.0
    duration_seconds: float = 0.0
    
    # 系统资源指标
    cpu_start: float = 0.0
    cpu_end: float = 0.0
    cpu_peak: float = 0.0
    memory_gb_start: float = 0.0
    memory_gb_end: float = 0.0
    memory_gb_peak: float = 0.0
    
    # 执行结果
    success: bool = False
    error_message: Optional[str] = None


class FlowPerformanceTracker:
    """
    Flow 性能追踪器
    
    用于追踪 Prefect Flow 的执行性能，包括：
    - 执行耗时
    - 系统 CPU 和内存使用
    - 定时采样（每 30 秒）
    
    使用方式：
        tracker = FlowPerformanceTracker("directory_scan", scan_id=1)
        tracker.start(target_id=1, target_name="example.com")
        # ... flow 执行 ...
        tracker.finish(success=True, result={'created_count': 100})
    """
    
    def __init__(self, flow_name: str, scan_id: int):
        self.metrics = FlowPerformanceMetrics(
            flow_name=flow_name,
            scan_id=scan_id
        )
        self._sampler_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._samples: list[dict] = []
    
    def start(
        self, 
        target_id: Optional[int] = None, 
        target_name: Optional[str] = None
    ) -> None:
        """开始追踪"""
        self.metrics.start_time = time.time()
        self.metrics.target_id = target_id
        self.metrics.target_name = target_name
        
        # 记录初始系统状态
        stats = _get_system_stats()
        self.metrics.cpu_start = stats['cpu_percent']
        self.metrics.memory_gb_start = stats['memory_gb']
        self.metrics.cpu_peak = stats['cpu_percent']
        self.metrics.memory_gb_peak = stats['memory_gb']
        
        # 记录开始日志
        perf_logger.info(
            "📊 Flow 开始 - %s, scan_id=%d, 系统: CPU %.1f%%, 内存 %.1fGB",
            self.metrics.flow_name,
            self.metrics.scan_id,
            stats['cpu_percent'],
            stats['memory_gb']
        )
        
        # 启动采样线程
        self._stop_event.clear()
        self._sampler_thread = threading.Thread(
            target=self._sample_loop,
            daemon=True,
            name=f"perf-sampler-{self.metrics.flow_name}-{self.metrics.scan_id}"
        )
        self._sampler_thread.start()
    
    def _sample_loop(self) -> None:
        """定时采样循环"""
        elapsed = 0
        while not self._stop_event.wait(timeout=SAMPLE_INTERVAL):
            elapsed += SAMPLE_INTERVAL
            stats = _get_system_stats()
            
            # 更新峰值
            if stats['cpu_percent'] > self.metrics.cpu_peak:
                self.metrics.cpu_peak = stats['cpu_percent']
            if stats['memory_gb'] > self.metrics.memory_gb_peak:
                self.metrics.memory_gb_peak = stats['memory_gb']
            
            # 记录采样
            self._samples.append({
                'elapsed': elapsed,
                'cpu': stats['cpu_percent'],
                'memory_gb': stats['memory_gb']
            })
            
            # 输出采样日志
            perf_logger.info(
                "📊 Flow 执行中 - %s [%ds], 系统: CPU %.1f%%, 内存 %.1fGB",
                self.metrics.flow_name,
                elapsed,
                stats['cpu_percent'],
                stats['memory_gb']
            )
    
    def finish(
        self,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> None:
        """
        结束追踪并记录性能日志
        
        Args:
            success: 是否成功
            error_message: 错误信息
        """
        # 停止采样线程
        self._stop_event.set()
        if self._sampler_thread and self._sampler_thread.is_alive():
            self._sampler_thread.join(timeout=1.0)
        
        # 记录结束时间和状态
        self.metrics.end_time = time.time()
        self.metrics.duration_seconds = self.metrics.end_time - self.metrics.start_time
        self.metrics.success = success
        self.metrics.error_message = error_message
        
        # 记录结束时的系统状态
        stats = _get_system_stats()
        self.metrics.cpu_end = stats['cpu_percent']
        self.metrics.memory_gb_end = stats['memory_gb']
        
        # 更新峰值（最后一次采样）
        if stats['cpu_percent'] > self.metrics.cpu_peak:
            self.metrics.cpu_peak = stats['cpu_percent']
        if stats['memory_gb'] > self.metrics.memory_gb_peak:
            self.metrics.memory_gb_peak = stats['memory_gb']
        
        # 记录结束日志
        status = "✓" if success else "✗"
        perf_logger.info(
            "📊 Flow 结束 - %s %s, scan_id=%d, 耗时: %.1fs, "
            "CPU: %.1f%%→%.1f%%(峰值%.1f%%), 内存: %.1fGB→%.1fGB(峰值%.1fGB)",
            self.metrics.flow_name,
            status,
            self.metrics.scan_id,
            self.metrics.duration_seconds,
            self.metrics.cpu_start,
            self.metrics.cpu_end,
            self.metrics.cpu_peak,
            self.metrics.memory_gb_start,
            self.metrics.memory_gb_end,
            self.metrics.memory_gb_peak
        )
        
        if not success and error_message:
            perf_logger.warning(
                "📊 Flow 失败原因 - %s: %s",
                self.metrics.flow_name,
                error_message
            )


def _get_process_stats(pid: int) -> dict:
    """
    获取指定进程及其子进程的资源使用（类似 htop 显示）
    
    Args:
        pid: 进程 ID
    
    Returns:
        dict: {
            'cpu_percent': float,  # 进程 CPU 使用率
            'memory_mb': float,    # 进程内存使用 (MB)
            'memory_percent': float  # 进程内存占比
        }
    """
    if not psutil:
        return {'cpu_percent': 0.0, 'memory_mb': 0.0, 'memory_percent': 0.0}
    
    try:
        process = psutil.Process(pid)
        
        # 获取进程及所有子进程
        children = process.children(recursive=True)
        all_processes = [process] + children
        
        total_cpu = 0.0
        total_memory = 0
        
        for p in all_processes:
            try:
                # cpu_percent 需要先调用一次初始化，第二次才有值
                # 这里用 interval=0.1 获取短时间内的 CPU 使用率
                total_cpu += p.cpu_percent(interval=0)
                mem_info = p.memory_info()
                total_memory += mem_info.rss  # RSS: Resident Set Size
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        # 转换为 MB
        memory_mb = total_memory / (1024 * 1024)
        # 计算内存占比
        total_mem = psutil.virtual_memory().total
        memory_percent = (total_memory / total_mem) * 100 if total_mem > 0 else 0.0
        
        return {
            'cpu_percent': total_cpu,
            'memory_mb': memory_mb,
            'memory_percent': memory_percent
        }
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return {'cpu_percent': 0.0, 'memory_mb': 0.0, 'memory_percent': 0.0}
    except Exception:
        return {'cpu_percent': 0.0, 'memory_mb': 0.0, 'memory_percent': 0.0}


class CommandPerformanceTracker:
    """
    命令执行性能追踪器
    
    用于追踪单个命令的执行性能，包括：
    - 执行耗时
    - 进程级 CPU 和内存使用（类似 htop）
    - 系统整体资源状态
    
    使用方式：
        tracker = CommandPerformanceTracker("ffuf", command="ffuf -u http://...")
        tracker.start()
        tracker.set_pid(process.pid)  # 进程启动后设置 PID
        # ... 执行命令 ...
        tracker.finish(success=True, duration=45.2)
    """
    
    def __init__(self, tool_name: str, command: str = ""):
        self.tool_name = tool_name
        self.command = command
        self.start_time: float = 0.0
        self.pid: Optional[int] = None
        # 系统级资源
        self.sys_cpu_start: float = 0.0
        self.sys_memory_gb_start: float = 0.0
        # 进程级资源峰值
        self.proc_cpu_peak: float = 0.0
        self.proc_memory_mb_peak: float = 0.0
    
    def start(self) -> None:
        """开始追踪，记录初始系统状态"""
        self.start_time = time.time()
        stats = _get_system_stats()
        self.sys_cpu_start = stats['cpu_percent']
        self.sys_memory_gb_start = stats['memory_gb']
        
        # 截断过长的命令
        cmd_display = self.command[:200] + "..." if len(self.command) > 200 else self.command
        
        perf_logger.info(
            "📊 命令开始 - %s, 系统: CPU %.1f%%, 内存 %.1fGB, 命令: %s",
            self.tool_name,
            self.sys_cpu_start,
            self.sys_memory_gb_start,
            cmd_display
        )
    
    def set_pid(self, pid: int) -> None:
        """
        设置要追踪的进程 PID
        
        Args:
            pid: 进程 ID
        """
        self.pid = pid
        # 初始化 CPU 采样（psutil 需要先调用一次）
        if psutil and pid:
            try:
                process = psutil.Process(pid)
                process.cpu_percent(interval=0)
                for child in process.children(recursive=True):
                    try:
                        child.cpu_percent(interval=0)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    
    def sample(self) -> dict:
        """
        采样当前进程资源使用（可选，用于长时间运行的命令）
        
        Returns:
            dict: 进程资源使用情况
        """
        if not self.pid:
            return {'cpu_percent': 0.0, 'memory_mb': 0.0, 'memory_percent': 0.0}
        
        stats = _get_process_stats(self.pid)
        
        # 更新峰值
        if stats['cpu_percent'] > self.proc_cpu_peak:
            self.proc_cpu_peak = stats['cpu_percent']
        if stats['memory_mb'] > self.proc_memory_mb_peak:
            self.proc_memory_mb_peak = stats['memory_mb']
        
        return stats
    
    def finish(
        self,
        success: bool = True,
        duration: Optional[float] = None,
        timeout: Optional[int] = None,
        is_timeout: bool = False
    ) -> None:
        """
        结束追踪并记录性能日志
        
        Args:
            success: 是否成功
            duration: 执行耗时（秒），如果不传则自动计算
            timeout: 超时配置（秒）
            is_timeout: 是否超时
        """
        # 计算耗时
        if duration is None:
            duration = time.time() - self.start_time
        
        # 获取结束时的系统状态
        sys_stats = _get_system_stats()
        
        # 获取进程最终资源使用（如果进程还在）
        proc_stats = {'cpu_percent': 0.0, 'memory_mb': 0.0, 'memory_percent': 0.0}
        if self.pid:
            proc_stats = _get_process_stats(self.pid)
            # 更新峰值
            if proc_stats['cpu_percent'] > self.proc_cpu_peak:
                self.proc_cpu_peak = proc_stats['cpu_percent']
            if proc_stats['memory_mb'] > self.proc_memory_mb_peak:
                self.proc_memory_mb_peak = proc_stats['memory_mb']
        
        status = "✓" if success else ("⏱ 超时" if is_timeout else "✗")
        
        # 截断过长的命令
        cmd_display = self.command[:200] + "..." if len(self.command) > 200 else self.command
        
        # 日志格式：进程资源 + 系统资源
        if self.pid and (self.proc_cpu_peak > 0 or self.proc_memory_mb_peak > 0):
            perf_logger.info(
                "📊 命令结束 - %s %s, 耗时: %.2fs%s, "
                "进程: CPU %.1f%%(峰值), 内存 %.1fMB(峰值), "
                "系统: CPU %.1f%%→%.1f%%, 内存 %.1fGB→%.1fGB, "
                "命令: %s",
                self.tool_name,
                status,
                duration,
                f", 超时配置: {timeout}s" if timeout else "",
                self.proc_cpu_peak,
                self.proc_memory_mb_peak,
                self.sys_cpu_start,
                sys_stats['cpu_percent'],
                self.sys_memory_gb_start,
                sys_stats['memory_gb'],
                cmd_display
            )
        else:
            # 没有进程级数据，只显示系统级
            perf_logger.info(
                "📊 命令结束 - %s %s, 耗时: %.2fs%s, "
                "系统: CPU %.1f%%→%.1f%%, 内存 %.1fGB→%.1fGB, "
                "命令: %s",
                self.tool_name,
                status,
                duration,
                f", 超时配置: {timeout}s" if timeout else "",
                self.sys_cpu_start,
                sys_stats['cpu_percent'],
                self.sys_memory_gb_start,
                sys_stats['memory_gb'],
                cmd_display
            )
