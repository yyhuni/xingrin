"""
容器启动引导模块

提供动态任务容器的通用初始化功能：
- 从 Server 配置中心获取配置
- 设置环境变量
- 初始化 Django 环境

使用方式：
    from apps.common.container_bootstrap import fetch_config_and_setup_django
    fetch_config_and_setup_django()  # 必须在 Django 导入之前调用
"""
import os
import sys
import requests
import logging

logger = logging.getLogger(__name__)


def fetch_config_and_setup_django():
    """
    从配置中心获取配置并初始化 Django
    
    Note:
        必须在 Django 导入之前调用此函数
    """
    server_url = os.environ.get("SERVER_URL")
    if not server_url:
        print("[ERROR] 缺少 SERVER_URL 环境变量", file=sys.stderr)
        sys.exit(1)
    
    config_url = f"{server_url}/api/workers/config/"
    try:
        resp = requests.get(config_url, timeout=10)
        resp.raise_for_status()
        config = resp.json()
        
        # 数据库配置（必需）
        os.environ.setdefault("DB_HOST", config['db']['host'])
        os.environ.setdefault("DB_PORT", config['db']['port'])
        os.environ.setdefault("DB_NAME", config['db']['name'])
        os.environ.setdefault("DB_USER", config['db']['user'])
        os.environ.setdefault("DB_PASSWORD", config['db']['password'])
        
        # Redis 配置
        os.environ.setdefault("REDIS_URL", config['redisUrl'])
        
        # 日志配置
        os.environ.setdefault("LOG_DIR", config['paths']['logs'])
        os.environ.setdefault("LOG_LEVEL", config['logging']['level'])
        os.environ.setdefault("ENABLE_COMMAND_LOGGING", str(config['logging']['enableCommandLogging']).lower())
        os.environ.setdefault("DEBUG", str(config['debug']))
        
        print(f"[CONFIG] 从配置中心获取配置成功: {config_url}")
        
    except Exception as e:
        print(f"[ERROR] 获取配置失败: {config_url} - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 初始化 Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    import django
    django.setup()
    
    return config
