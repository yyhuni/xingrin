from django.db import models
from django.utils import timezone


class SoftDeleteManager(models.Manager):
    """软删除管理器：默认只返回未删除的记录"""
    
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Organization(models.Model):
    """组织模型"""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=300, blank=True, default='', help_text='组织名称')
    description = models.CharField(max_length=1000, blank=True, default='', help_text='组织描述')
    created_at = models.DateTimeField(auto_now_add=True, help_text='创建时间')
    
    # ==================== 软删除字段 ====================
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True, help_text='删除时间（NULL表示未删除）')

    targets = models.ManyToManyField(
        'Target',
        related_name='organizations',
        blank=True,
        help_text='所属目标列表'
    )
    
    # ==================== 管理器 ====================
    objects = SoftDeleteManager()  # 默认管理器：只返回未删除的记录
    all_objects = models.Manager()  # 全量管理器：包括已删除的记录（用于硬删除）

    class Meta:
        db_table = 'organization'
        verbose_name = '组织'
        verbose_name_plural = '组织'
        ordering = ['-created_at']
        # 部分唯一约束：只对未删除记录生效
        constraints = [
            models.UniqueConstraint(
                fields=['name'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_organization_name_active'
            ),
        ]
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['deleted_at', '-created_at']),  # 软删除 + 时间索引
            models.Index(fields=['name']),  # 优化 name 搜索
        ]

    def __str__(self):
        return str(self.name or f'Organization {self.id}')


class Target(models.Model):
    """扫描目标模型

    核心模型，存储要扫描的目标信息。
    支持多种类型：域名、IP地址、CIDR范围等。
    """

    # ==================== 类型定义 ====================
    class TargetType(models.TextChoices):
        DOMAIN = 'domain', '域名'
        IP = 'ip', 'IP地址'
        CIDR = 'cidr', 'CIDR范围'

    # ==================== 基本字段 ====================
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=300, blank=True, default='', help_text='目标标识（域名/IP/CIDR）')

    type = models.CharField(
        max_length=20,
        choices=TargetType.choices,
        default=TargetType.DOMAIN,
        db_index=True,
        help_text='目标类型'
    )

    # ==================== 时间戳 ====================
    created_at = models.DateTimeField(auto_now_add=True, help_text='创建时间')
    last_scanned_at = models.DateTimeField(null=True, blank=True, help_text='最后扫描时间')
    
    # ==================== 软删除字段 ====================
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True, help_text='删除时间（NULL表示未删除）')
    
    # ==================== 管理器 ====================
    objects = SoftDeleteManager()  # 默认管理器：只返回未删除的记录
    all_objects = models.Manager()  # 全量管理器：包括已删除的记录（用于硬删除）

    class Meta:
        db_table = 'target'
        verbose_name = '扫描目标'
        verbose_name_plural = '扫描目标'
        ordering = ['-created_at']
        # 部分唯一约束：只对未删除记录生效
        constraints = [
            models.UniqueConstraint(
                fields=['name'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_target_name_active'
            ),
        ]
        indexes = [
            models.Index(fields=['type']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['deleted_at', '-created_at']),  # 软删除 + 时间索引
            models.Index(fields=['deleted_at', 'type']),  # 软删除 + 类型索引
            models.Index(fields=['name']),  # 优化 name 搜索
        ]

    def __str__(self):
        return str(self.name or f'Target {self.id}')
