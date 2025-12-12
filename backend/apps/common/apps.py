from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.common'  # 因为在 apps/ 目录下
    
    def ready(self):
        """应用就绪时调用"""
        pass
