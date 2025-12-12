#!/usr/bin/env python
"""
组织硬删除脚本

用于动态容器执行，硬删除已软删除的组织及其关联数据。
"""
import sys
import argparse
import json
import logging
from apps.common.container_bootstrap import fetch_config_and_setup_django

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def hard_delete_organizations(organization_ids: list[int]) -> dict:
    """
    硬删除组织
    
    Args:
        organization_ids: 组织 ID 列表
        
    Returns:
        删除统计信息
    """
    from apps.targets.services import OrganizationService
    
    service = OrganizationService()
    
    try:
        deleted_count, details = service.hard_delete_organizations(organization_ids)
        
        logger.info(f"✓ 硬删除完成 - 删除数量: {deleted_count}")
        logger.info(f"  详情: {details}")
        
        return {
            'success': True,
            'deleted_count': deleted_count,
            'details': details,
        }
        
    except Exception as e:
        logger.error(f"硬删除失败: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
        }


def main():
    parser = argparse.ArgumentParser(description="硬删除组织")
    parser.add_argument("--organization_ids", type=str, required=True, help="组织 ID 列表 (JSON)")
    
    args = parser.parse_args()
    
    # 解析 organization_ids
    organization_ids = json.loads(args.organization_ids)
    
    logger.info(f"开始硬删除 {len(organization_ids)} 个组织")
    
    # 获取配置并初始化 Django
    fetch_config_and_setup_django()
    
    # 执行删除
    result = hard_delete_organizations(organization_ids)
    
    print(f"删除完成: {result}")
    
    if not result.get('success'):
        sys.exit(1)


if __name__ == "__main__":
    main()
