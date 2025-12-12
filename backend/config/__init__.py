"""
配置包初始化

确保 Prefect 配置在 Django 启动时被加载
"""

# 延迟导入，避免在 ASGI 启动时出现循环依赖
# configure_prefect() 会在 Django 应用就绪时自动调用

__all__ = ('configure_prefect',)

