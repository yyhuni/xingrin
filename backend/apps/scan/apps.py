from django.apps import AppConfig


class ScanConfig(AppConfig):
    """扫描应用配置类"""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.scan'
    
    def ready(self):
        """应用启动时注册信号接收器"""
        # 导入接收器模块以注册信号处理函数
        from apps.scan.notifications import receivers  # noqa: F401