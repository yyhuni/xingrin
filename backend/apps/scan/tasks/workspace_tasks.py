"""
工作空间相关的 Prefect Tasks

负责扫描工作空间的创建、验证和管理
"""

from pathlib import Path
from prefect import task
import logging

logger = logging.getLogger(__name__)


@task(
    name="create_scan_workspace",
    description="创建并验证 Scan 工作空间目录",
    retries=2,
    retry_delay_seconds=5
)
def create_scan_workspace_task(scan_workspace_dir: str) -> Path:
    """
    创建并验证 Scan 工作空间目录
    
    Args:
        scan_workspace_dir: Scan 工作空间目录路径
    
    Returns:
        Path: 创建的 Scan 工作空间路径对象
    
    Raises:
        OSError: 目录创建失败或不可写
    """
    scan_workspace_path = Path(scan_workspace_dir)
    
    # 创建目录
    try:
        scan_workspace_path.mkdir(parents=True, exist_ok=True)
        logger.info("✓ Scan 工作空间已创建: %s", scan_workspace_path)
    except OSError as e:
        logger.error("创建 Scan 工作空间失败: %s - %s", scan_workspace_dir, e)
        raise
    
    # 验证目录是否可写
    test_file = scan_workspace_path / ".test_write"
    try:
        test_file.touch()
        test_file.unlink()
        logger.info("✓ Scan 工作空间验证通过（可写）: %s", scan_workspace_path)
    except OSError as e:
        error_msg = f"Scan 工作空间不可写: {scan_workspace_path}"
        logger.error(error_msg)
        raise OSError(error_msg) from e
    
    return scan_workspace_path
