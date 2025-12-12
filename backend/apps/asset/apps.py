from django.apps import AppConfig


class AssetConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.asset'
    
    def ready(self):
        # 导入所有模型以确保Django发现并注册
        from . import models
