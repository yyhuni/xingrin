"""通用信号定义

定义项目中使用的自定义信号，用于解耦各模块之间的通信。

使用方式：
1. 发布信号：signal.send(sender=SomeClass, **kwargs)
2. 接收信号：@receiver(signal) def handler(sender, **kwargs): ...
"""

from django.dispatch import Signal


# ==================== 漏洞相关信号 ====================

# 漏洞保存完成信号
# 参数：
#   - items: List[VulnerabilitySnapshotDTO] 保存的漏洞列表
#   - scan_id: int 扫描任务ID
#   - target_id: int 目标ID
vulnerabilities_saved = Signal()


# ==================== Worker 相关信号 ====================

# Worker 删除失败信号（只在失败时发送）
# 参数：
#   - worker_name: str Worker 名称
#   - message: str 失败原因
worker_delete_failed = Signal()
