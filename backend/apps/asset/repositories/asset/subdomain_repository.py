import logging
from typing import List, Iterator

from django.db import transaction, IntegrityError, OperationalError, DatabaseError
from django.utils import timezone
from typing import Tuple, Dict

from apps.asset.models.asset_models import Subdomain
from apps.asset.dtos import SubdomainDTO
from apps.common.decorators import auto_ensure_db_connection

logger = logging.getLogger(__name__)


@auto_ensure_db_connection
class DjangoSubdomainRepository:
    """基于 Django ORM 的子域名仓储实现。"""

    def bulk_create_ignore_conflicts(self, items: List[SubdomainDTO]) -> None:
        """
        批量创建子域名，忽略冲突
        
        Args:
            items: 子域名 DTO 列表
            
        Raises:
            IntegrityError: 数据完整性错误（如唯一约束冲突）
            OperationalError: 数据库操作错误（如连接失败）
            DatabaseError: 其他数据库错误
        """
        if not items:
            return

        try:
            subdomain_objects = [
                Subdomain(
                    name=item.name,
                    target_id=item.target_id,
                )
                for item in items
            ]

            with transaction.atomic():
                # 使用 ignore_conflicts 策略：
                # - 新子域名：INSERT 完整记录
                # - 已存在子域名：忽略（不更新，因为没有探测字段数据）
                # 注意：ignore_conflicts 无法返回实际创建的数量
                Subdomain.objects.bulk_create(  # type: ignore[attr-defined]
                    subdomain_objects,
                    ignore_conflicts=True,  # 忽略重复记录
                )

            logger.debug(f"成功处理 {len(items)} 条子域名记录")

        except IntegrityError as e:
            logger.error(
                f"批量插入子域名失败 - 数据完整性错误: {e}, "
                f"记录数: {len(items)}, "
                f"示例域名: {items[0].name if items else 'N/A'}"
            )
            raise

        except OperationalError as e:
            logger.error(
                f"批量插入子域名失败 - 数据库操作错误: {e}, "
                f"记录数: {len(items)}"
            )
            raise

        except DatabaseError as e:
            logger.error(
                f"批量插入子域名失败 - 数据库错误: {e}, "
                f"记录数: {len(items)}"
            )
            raise

        except Exception as e:
            logger.error(
                f"批量插入子域名失败 - 未知错误: {e}, "
                f"记录数: {len(items)}, "
                f"错误类型: {type(e).__name__}",
                exc_info=True
            )
            raise
    
    def get_or_create(self, name: str, target_id: int) -> Tuple[Subdomain, bool]:
        """
        获取或创建子域名
        
        Args:
            name: 子域名名称
            target_id: 目标 ID
        
        Returns:
            (Subdomain对象, 是否新创建)
        """
        return Subdomain.objects.get_or_create(
            name=name,
            target_id=target_id,
        )
    
    def get_domains_for_export(self, target_id: int, batch_size: int = 1000) -> Iterator[str]:
        """
        流式导出域名（用于生成扫描工具输入文件）
        
        使用 iterator() 进行流式查询，避免一次性加载所有数据到内存
        
        Args:
            target_id: 目标 ID
            batch_size: 每次从数据库读取的行数
            
        Yields:
            str: 域名
        """
        queryset = Subdomain.objects.filter(
            target_id=target_id
        ).only('name').iterator(chunk_size=batch_size)
        
        for subdomain in queryset:
            yield subdomain.name
    
    def get_by_target(self, target_id: int):
        return Subdomain.objects.filter(target_id=target_id).order_by('-discovered_at')
    
    def count_by_target(self, target_id: int) -> int:
        """
        统计目标下的域名数量
        
        Args:
            target_id: 目标 ID
            
        Returns:
            int: 域名数量
        """
        return Subdomain.objects.filter(target_id=target_id).count()
    
    def get_by_names_and_target_id(self, names: set, target_id: int) -> dict:
        """
        根据域名列表和目标ID批量查询 Subdomain
        
        Args:
            names: 域名集合
            target_id: 目标 ID
            
        Returns:
            dict: {domain_name: Subdomain对象}
        """
        subdomains = Subdomain.objects.filter(
            name__in=names,
            target_id=target_id
        ).only('id', 'name')
        
        return {sd.name: sd for sd in subdomains}
    
    def get_all(self):
        """
        获取所有子域名
        
        Returns:
            QuerySet: 子域名查询集
        """
        return Subdomain.objects.all()
    
    def soft_delete_by_ids(self, subdomain_ids: List[int]) -> int:
        """
        根据 ID 列表批量软删除子域名
        
        Args:
            subdomain_ids: 子域名 ID 列表
        
        Returns:
            软删除的记录数
        
        Note:
            - 使用软删除：只标记为已删除，不真正删除数据库记录
            - 保留所有关联数据，可恢复
        """
        try:
            updated_count = (
                Subdomain.objects
                .filter(id__in=subdomain_ids)
                .update(deleted_at=timezone.now())
            )
            logger.debug(
                "批量软删除子域名成功 - Count: %s, 更新记录: %s",
                len(subdomain_ids),
                updated_count
            )
            return updated_count
        except Exception as e:
            logger.error(
                "批量软删除子域名失败 - IDs: %s, 错误: %s",
                subdomain_ids,
                e
            )
            raise
    
    def hard_delete_by_ids(self, subdomain_ids: List[int]) -> Tuple[int, Dict[str, int]]:
        """
        根据 ID 列表硬删除子域名（使用数据库级 CASCADE）
        
        Args:
            subdomain_ids: 子域名 ID 列表
        
        Returns:
            (删除的记录数, 删除详情字典)
        
        Strategy:
            使用数据库级 CASCADE 删除，性能最优
        
        Note:
            - 硬删除：从数据库中永久删除
            - 数据库自动处理所有外键级联删除
            - 不触发 Django 信号（pre_delete/post_delete）
        """
        try:
            batch_size = 1000  # 每批处理1000个子域名
            total_deleted = 0
            
            logger.debug(f"开始批量删除 {len(subdomain_ids)} 个子域名（数据库 CASCADE）...")
            
            # 分批处理子域名ID，避免单次删除过多
            for i in range(0, len(subdomain_ids), batch_size):
                batch_ids = subdomain_ids[i:i + batch_size]
                
                # 直接删除子域名，数据库自动级联删除所有关联数据
                count, _ = Subdomain.all_objects.filter(id__in=batch_ids).delete()
                total_deleted += count
                
                logger.debug(f"批次删除完成: {len(batch_ids)} 个子域名，删除 {count} 条记录")
            
            # 由于使用数据库 CASCADE，无法获取详细统计
            deleted_details = {
                'subdomains': len(subdomain_ids),
                'total': total_deleted,
                'note': 'Database CASCADE - detailed stats unavailable'
            }
            
            logger.debug(
                "批量硬删除成功（CASCADE）- 子域名数: %s, 总删除记录: %s",
                len(subdomain_ids),
                total_deleted
            )
            
            return total_deleted, deleted_details
        
        except Exception as e:
            logger.error(
                "批量硬删除失败（CASCADE）- 子域名数: %s, 错误: %s",
                len(subdomain_ids),
                str(e),
                exc_info=True
            )
            raise


