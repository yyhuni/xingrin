"""
日志配置模块（改进版 v2）

根据环境（开发/生产）和环境变量配置 Django 日志系统

改进内容：
1. ✅ 结构化日志 - JSON 格式便于日志分析和监控
2. ✅ 性能指标日志 - 专门记录性能相关信息
3. ⚠️  异步日志处理 - 需要额外配置（见下方说明）

环境变量：
- LOG_LEVEL: 全局日志级别 (DEBUG/INFO/WARNING/ERROR/CRITICAL)
- LOG_DIR: 日志文件目录（留空则不输出文件）

开发环境特性：
- 默认 DEBUG 级别
- 控制台彩色输出
- 可选文件输出

生产环境特性：
- 默认 INFO 级别
- 控制台 + 文件输出（配置 LOG_DIR）
- 文件自动轮转（10MB，保留5个备份）
- JSON 结构化日志
- 性能指标日志

依赖安装：
- pip install python-json-logger  # JSON 格式化器

异步日志说明：
- 当前使用标准 RotatingFileHandler（同步写入）
- 如需异步处理，可使用 logging_config_new.py 中的 QueueHandler 方案
- 异步方案需要额外的 QueueListener 配置和生命周期管理

设计说明：
- 直接从环境变量读取配置，避免与 settings.py 循环依赖
- settings.py 在加载时会调用此模块，此时 settings 对象尚未完全初始化
- 这是 Django 配置模块的常见模式
"""

import os
from pathlib import Path


def get_logging_config(debug: bool = False):
    """
    获取日志配置字典
    
    Args:
        debug: 是否为 DEBUG 模式
    
    Returns:
        dict: Django LOGGING 配置字典
    """
    # 获取日志配置
    log_level = os.getenv('LOG_LEVEL', 'DEBUG' if debug else 'INFO')
    log_dir = os.getenv('LOG_DIR', '')
    
    # 构建 handlers 配置
    log_handlers = ['console']
    logging_handlers = {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'colored' if debug else 'standard',
            'stream': 'ext://sys.stdout',
        }
    }
    
    # 如果配置了日志目录，添加文件 handler
    if log_dir:
        log_path = Path(log_dir)
        log_path.mkdir(parents=True, exist_ok=True)
        
        # 标准文件日志
        log_handlers.append('file')
        logging_handlers['file'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'formatter': 'standard',
            'filename': str(log_path / 'xingrin.log'),
            'maxBytes': 100 * 1024 * 1024,  # 100MB
            'backupCount': 5,
            'encoding': 'utf-8',
        }
        
        # 错误日志单独记录
        log_handlers.append('error_file')
        logging_handlers['error_file'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'formatter': 'standard',
            'filename': str(log_path / 'xingrin_error.log'),
            'maxBytes': 100 * 1024 * 1024,  # 100MB
            'backupCount': 5,
            'encoding': 'utf-8',
            'level': 'ERROR',  # 只记录 ERROR 及以上级别
        }
        
        # JSON 结构化日志（便于日志分析和监控）
        log_handlers.append('json_file')
        logging_handlers['json_file'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'formatter': 'json',
            'filename': str(log_path / 'xingrin_json.log'),
            'maxBytes': 100 * 1024 * 1024,  # 100MB
            'backupCount': 5,
            'encoding': 'utf-8',
        }
        
        # 性能指标日志（专门记录性能相关信息）
        logging_handlers['performance_file'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'formatter': 'json',
            'filename': str(log_path / 'performance.log'),
            'maxBytes': 100 * 1024 * 1024,  # 100MB
            'backupCount': 5,
            'encoding': 'utf-8',
        }
    
    # 构建完整的 LOGGING 配置
    logging_config = {
        'version': 1,
        'disable_existing_loggers': False,
        
        # 格式化器
        'formatters': {
            'standard': {
                'format': '[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d] %(message)s',
                'datefmt': '%Y-%m-%d %H:%M:%S',
            },
            'colored': {
                'format': '%(log_color)s[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d]%(reset)s %(message)s',
                'datefmt': '%Y-%m-%d %H:%M:%S',
                '()': 'colorlog.ColoredFormatter',
                'log_colors': {
                    'DEBUG': 'cyan',
                    'INFO': 'green',
                    'WARNING': 'yellow',
                    'ERROR': 'red',
                    'CRITICAL': 'red,bg_white',
                },
            },
            # JSON 格式化器（结构化日志）
            'json': {
                '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
                'format': '%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d',
                'datefmt': '%Y-%m-%d %H:%M:%S',
            },
        },
        
        # 处理器
        'handlers': logging_handlers,
        
        # 日志记录器
        'loggers': {
            # Django 核心日志
            'django': {
                'handlers': log_handlers,
                'level': 'INFO',  # Django 框架日志，通常不需要 DEBUG
                'propagate': False,
            },
            'django.request': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 请求错误日志
                'propagate': False,
            },
            'django.server': {
                'handlers': log_handlers,
                'level': 'WARNING',  # Django 开发服务器日志
                'propagate': False,
            },
            'django.db.backends': {
                'handlers': log_handlers,
                'level': 'WARNING' if not debug else 'DEBUG',  # SQL 查询日志（开发环境可启用）
                'propagate': False,
            },
            

            
            # 应用日志 - 扫描模块
            'apps.scan': {
                'handlers': log_handlers,
                'level': log_level,
                'propagate': False,
            },
            
            # 应用日志 - 其他模块（统一级别）
            'apps.asset': {
                'handlers': log_handlers,
                'level': log_level,
                'propagate': False,
            },
            'apps.targets': {
                'handlers': log_handlers,
                'level': log_level,
                'propagate': False,
            },
            'apps.engine': {
                'handlers': log_handlers,
                'level': log_level,
                'propagate': False,
            },
            'apps.common': {
                'handlers': log_handlers,
                'level': log_level,
                'propagate': False,
            },
            
            # 第三方库日志控制
            'websockets': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 WebSocket 的 DEBUG/INFO 日志
                'propagate': False,
            },
            'websockets.client': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 WebSocket 客户端的调试日志
                'propagate': False,
            },
            'httpx': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 HTTP 客户端的详细日志
                'propagate': False,
            },
            'httpcore': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 HTTP 核心库的调试日志
                'propagate': False,
            },
            'httpcore.connection': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 HTTP 连接的调试日志
                'propagate': False,
            },
            'httpcore.http11': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 HTTP/1.1 协议的调试日志
                'propagate': False,
            },
            'prefect': {
                'handlers': log_handlers,
                'level': 'INFO',  # Prefect 框架日志保持 INFO 级别
                'propagate': False,
            },
            'apscheduler': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭定时任务的 INFO 日志（每分钟执行）
                'propagate': False,
            },
            'apscheduler.scheduler': {
                'handlers': log_handlers,
                'level': 'WARNING',
                'propagate': False,
            },
            'apscheduler.executors': {
                'handlers': log_handlers,
                'level': 'WARNING',
                'propagate': False,
            },
            'graphviz': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 graphviz 的 DEBUG 日志
                'propagate': False,
            },
            'graphviz._tools': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 graphviz._tools 的 DEBUG 日志
                'propagate': False,
            },
            
            # Django 框架日志控制
            'django.db.backends': {
                'handlers': log_handlers,
                'level': 'INFO',  # 关闭数据库查询的 DEBUG 日志
                'propagate': False,
            },
            'django.db.backends.schema': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭数据库模式的 DEBUG 日志
                'propagate': False,
            },
            'django.utils.autoreload': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭自动重载的 DEBUG 日志
                'propagate': False,
            },
            'django.request': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 只记录 WARNING 以上的请求日志（错误请求）
                'propagate': False,
            },
            'django.server': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭服务器的 INFO 日志（如访问日志）
                'propagate': False,
            },
            
            # 其他第三方库日志控制
            'asyncio': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 asyncio 的 DEBUG 日志
                'propagate': False,
            },
            'urllib3': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭 urllib3 的详细日志
                'propagate': False,
            },
            'urllib3.connectionpool': {
                'handlers': log_handlers,
                'level': 'WARNING',  # 关闭连接池的详细日志
                'propagate': False,
            },
            
            # 性能指标日志（专门记录性能相关信息）
            'performance': {
                'handlers': ['performance_file'] if log_dir else ['console'],
                'level': 'INFO',
                'propagate': False,
            },
        },
        
        # 根日志记录器（兜底配置）
        'root': {
            'level': log_level,
            'handlers': log_handlers,
        },
    }
    
    return logging_config
