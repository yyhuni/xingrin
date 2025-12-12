#!/usr/bin/env python
"""
清理任务脚本

用于动态容器执行清理任务，目前支持：
- results: 清理过期的扫描结果目录

如需添加其他清理任务，添加对应的 cleanup_xxx() 函数即可。

注意：此脚本只做文件清理，不需要 Django 环境。
"""
import argparse
import shutil
import logging
from datetime import datetime, timedelta
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def cleanup_results(results_dir: str, retention_days: int) -> dict:
    """
    清理过期的扫描结果目录
    
    Args:
        results_dir: 扫描结果根目录
        retention_days: 保留天数
        
    Returns:
        清理统计信息
    """
    results_path = Path(results_dir)
    if not results_path.exists():
        logger.warning(f"扫描结果目录不存在: {results_dir}")
        return {'deleted': 0, 'failed': 0, 'skipped': 0}
    
    cutoff_date = datetime.now() - timedelta(days=retention_days)
    stats = {'deleted': 0, 'failed': 0, 'skipped': 0, 'freed_bytes': 0}
    
    logger.info(f"开始清理扫描结果 - 目录: {results_dir}, 保留天数: {retention_days}")
    logger.info(f"清理截止时间: {cutoff_date}")
    
    for item in results_path.iterdir():
        if not item.is_dir():
            continue
        
        # 只处理 scan_ 开头的目录
        if not item.name.startswith('scan_'):
            stats['skipped'] += 1
            continue
        
        try:
            # 获取目录修改时间
            mtime = datetime.fromtimestamp(item.stat().st_mtime)
            
            if mtime < cutoff_date:
                # 计算目录大小
                dir_size = sum(f.stat().st_size for f in item.rglob('*') if f.is_file())
                
                # 删除目录
                shutil.rmtree(item)
                stats['deleted'] += 1
                stats['freed_bytes'] += dir_size
                
                logger.info(f"  已删除: {item.name} (修改时间: {mtime}, 大小: {dir_size / 1024 / 1024:.2f} MB)")
            else:
                stats['skipped'] += 1
                
        except Exception as e:
            logger.error(f"  删除失败: {item.name} - {e}")
            stats['failed'] += 1
    
    logger.info(f"清理完成 - 删除: {stats['deleted']}, 失败: {stats['failed']}, 跳过: {stats['skipped']}")
    logger.info(f"释放空间: {stats['freed_bytes'] / 1024 / 1024:.2f} MB")
    
    return stats


def main():
    parser = argparse.ArgumentParser(description="清理任务")
    parser.add_argument("--results_dir", type=str, default="/app/backend/results", help="扫描结果目录")
    parser.add_argument("--retention_days", type=int, default=7, help="保留天数")
    
    args = parser.parse_args()
    
    stats = cleanup_results(args.results_dir, args.retention_days)
    
    print(f"清理完成: {stats}")


if __name__ == "__main__":
    main()
