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
import urllib3

# 禁用自签名证书的 SSL 警告（远程 Worker 场景）
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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
    
    # 通过环境变量声明 Worker 身份（本地/远程）
    is_local = os.environ.get("IS_LOCAL", "false").lower() == "true"
    config_url = f"{server_url}/api/workers/config/?is_local={str(is_local).lower()}"
    print(f"[CONFIG] 正在从配置中心获取配置: {config_url}")
    print(f"[CONFIG] IS_LOCAL={is_local}")
    try:
        # verify=False: 远程 Worker 通过 HTTPS 访问时可能使用自签名证书
        resp = requests.get(config_url, timeout=10, verify=False)
        resp.raise_for_status()
        config = resp.json()
        
        # 数据库配置（必需）
        db_host = config['db']['host']
        db_port = config['db']['port']
        db_name = config['db']['name']
        db_user = config['db']['user']
        
        os.environ.setdefault("DB_HOST", db_host)
        os.environ.setdefault("DB_PORT", db_port)
        os.environ.setdefault("DB_NAME", db_name)
        os.environ.setdefault("DB_USER", db_user)
        os.environ.setdefault("DB_PASSWORD", config['db']['password'])
        
        # Redis 配置
        os.environ.setdefault("REDIS_URL", config['redisUrl'])
        
        # 日志配置
        os.environ.setdefault("LOG_DIR", config['paths']['logs'])
        os.environ.setdefault("LOG_LEVEL", config['logging']['level'])
        os.environ.setdefault("ENABLE_COMMAND_LOGGING", str(config['logging']['enableCommandLogging']).lower())
        os.environ.setdefault("DEBUG", str(config['debug']))
        
        print(f"[CONFIG] ✓ 配置获取成功")
        print(f"[CONFIG]   DB_HOST: {db_host}")
        print(f"[CONFIG]   DB_PORT: {db_port}")
        print(f"[CONFIG]   DB_NAME: {db_name}")
        print(f"[CONFIG]   DB_USER: {db_user}")
        print(f"[CONFIG]   REDIS_URL: {config['redisUrl']}")
        
    except Exception as e:
        print(f"[ERROR] 获取配置失败: {config_url} - {e}", file=sys.stderr)
        sys.exit(1)
    
    # 初始化 Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    import django
    django.setup()
    
    return config
