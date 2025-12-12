import os
from django.apps import AppConfig


class EngineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.engine'
    verbose_name = '扫描引擎'
    
    def ready(self):
        """应用就绪时启动定时调度器"""
        # 只在主进程中启动调度器（避免 autoreload 重复启动）
        # 检查是否在 runserver 的 autoreload 子进程中
        if os.environ.get('RUN_MAIN') == 'true' or not self._is_runserver():
            # 只在 Server 容器中启动调度器（Worker 容器不需要）
            if not os.environ.get('SERVER_URL'):  # Worker 容器有 SERVER_URL
                self._start_scheduler()
    
    def _is_runserver(self):
        """检查是否通过 runserver 启动"""
        import sys
        return 'runserver' in sys.argv
    
    def _start_scheduler(self):
        """启动调度器"""
        try:
            from apps.engine.scheduler import start_scheduler
            start_scheduler()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"调度器启动失败: {e}")
