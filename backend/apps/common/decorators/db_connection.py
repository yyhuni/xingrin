"""
数据库连接装饰器

提供自动数据库连接健康检查的装饰器，确保长时间运行的任务中数据库连接不会失效。

主要功能：
- @auto_ensure_db_connection: 类装饰器，自动为所有公共方法添加连接检查
- @ensure_db_connection: 方法装饰器，单独为某个方法添加连接检查

使用场景：
- Repository 层的数据库操作
- Service 层需要确保数据库连接的操作
- 任何需要数据库连接健康检查的类或方法
"""

import logging
import functools
import time
from django.db import connection
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


def ensure_db_connection(method):
    """
    方法装饰器：自动确保数据库连接健康
    
    在方法执行前自动检查数据库连接，如果连接失效则自动重连。
    
    使用场景：
    - 需要单独装饰某个方法时使用
    - 通常建议使用类装饰器 @auto_ensure_db_connection
    
    示例：
        @ensure_db_connection
        def my_method(self):
            # 会自动检查连接健康
            ...
    """
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        _check_and_reconnect()
        return method(self, *args, **kwargs)
    return wrapper


def auto_ensure_db_connection(cls):
    """
    类装饰器：自动给所有公共方法添加数据库连接检查
    
    自动为类中所有公共方法（不以 _ 开头的方法）添加 @ensure_db_connection 装饰器。
    
    特性：
    - 自动装饰所有公共方法
    - 跳过私有方法（以 _ 开头）
    - 跳过类方法和静态方法
    - 跳过已经装饰过的方法
    
    使用方式：
        @auto_ensure_db_connection
        class MyRepository:
            def bulk_create(self, items):
                # 自动添加连接检查
                ...
            
            def query(self, filters):
                # 自动添加连接检查
                ...
            
            def _private_method(self):
                # 不会添加装饰器
                ...
    
    优势：
    - 无需为每个方法手动添加装饰器
    - 减少代码重复
    - 降低遗漏风险
    """
    for attr_name in dir(cls):
        # 跳过私有方法和魔术方法
        if attr_name.startswith('_'):
            continue
        
        attr = getattr(cls, attr_name)
        
        # 只装饰可调用的实例方法
        if callable(attr) and not isinstance(attr, (staticmethod, classmethod)):
            # 检查是否已经被装饰过（避免重复装饰）
            if not hasattr(attr, '_db_connection_ensured'):
                wrapped = ensure_db_connection(attr)
                wrapped._db_connection_ensured = True
                setattr(cls, attr_name, wrapped)
    
    return cls


def _check_and_reconnect(max_retries=5):
    """
    检查数据库连接健康状态，必要时使用指数退避重新连接
    
    策略：
    1. 尝试执行简单查询测试连接
    2. 如果失败，使用指数退避策略重试（最多5次）
    3. 每次重试的等待时间：2^attempt 秒 (1s, 2s, 4s, 8s, 16s)
    
    异常处理：
    - 连接失效时自动重连
    - 记录警告日志和重试信息
    - 忽略关闭连接时的错误
    - 达到最大重试次数后抛出异常
    """
    last_error = None
    
    for attempt in range(max_retries):
        try:
            connection.ensure_connection()
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            
            # 连接成功
            if attempt > 0:
                logger.info(f"数据库重连成功 (尝试 {attempt + 1}/{max_retries})")
            return
            
        except Exception as e:
            last_error = e
            logger.warning(
                f"数据库连接检查失败 (尝试 {attempt + 1}/{max_retries}): {e}"
            )
            
            # 关闭失效的连接
            try:
                connection.close()
            except Exception:
                pass  # 忽略关闭时的错误
            
            # 如果还有重试机会，使用指数退避等待
            if attempt < max_retries - 1:
                delay = 2 ** attempt  # 指数退避: 1, 2, 4, 8, 16 秒
                logger.info(f"等待 {delay} 秒后重试...")
                time.sleep(delay)
            else:
                # 最后一次尝试也失败，抛出异常
                logger.error(
                    f"数据库重连失败，已达最大重试次数 ({max_retries})"
                )
                raise last_error


async def async_check_and_reconnect(max_retries=5):
    await sync_to_async(_check_and_reconnect, thread_sensitive=True)(max_retries=max_retries)


def ensure_db_connection_async(method):
    @functools.wraps(method)
    async def wrapper(*args, **kwargs):
        await async_check_and_reconnect()
        return await method(*args, **kwargs)
    return wrapper


__all__ = [
    'ensure_db_connection',
    'auto_ensure_db_connection',
    'async_check_and_reconnect',
    'ensure_db_connection_async',
]
