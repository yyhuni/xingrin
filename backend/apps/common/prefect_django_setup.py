"""
Prefect Flow Django 环境初始化模块

在所有 Prefect Flow 文件开头导入此模块即可自动配置 Django 环境
"""

import os
import sys


def setup_django_for_prefect():
    """
    为 Prefect Flow 配置 Django 环境
    
    此函数会：
    1. 添加项目根目录到 Python 路径
    2. 设置 DJANGO_SETTINGS_MODULE 环境变量
    3. 调用 django.setup() 初始化 Django
    
    使用方式：
        from apps.common.prefect_django_setup import setup_django_for_prefect
        setup_django_for_prefect()
    """
    # 获取项目根目录（backend 目录）
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(current_dir, '../..')
    backend_dir = os.path.abspath(backend_dir)
    
    # 添加到 Python 路径
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    # 配置 Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    
    # 初始化 Django
    import django
    django.setup()


# 自动执行初始化（导入即生效）
setup_django_for_prefect()
