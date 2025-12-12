"""
目录清理工具模块

提供通用的目录清理功能
"""

import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)


def remove_directory(directory: str) -> bool:
    """
    删除目录及其所有内容
    
    Args:
        directory: 目录路径
    
    Returns:
        是否删除成功
    
    Warning:
        此函数会永久删除目录及其所有内容，请谨慎使用！
    
    Example:
        >>> remove_directory('/path/to/directory')
        True
    """
    if not directory:
        logger.warning("目录路径为空，跳过删除")
        return False
    
    try:
        dir_path = Path(directory)
        
        if not dir_path.exists():
            logger.warning("目录不存在，无需删除 - Path: %s", directory)
            return True
        
        # 删除整个目录
        shutil.rmtree(dir_path)
        
        logger.info("✓ 目录已删除 - Path: %s", directory)
        return True
        
    except PermissionError as e:
        logger.error("权限不足，无法删除目录 - Path: %s, 错误: %s", directory, e)
        return False
        
    except Exception as e:  # noqa: BLE001
        logger.exception("删除目录失败 - Path: %s, 错误: %s", directory, e)
        return False


__all__ = [
    'remove_directory',
]

