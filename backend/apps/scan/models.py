from django.db import models
from django.contrib.postgres.fields import ArrayField

from ..common.definitions import ScanStatus




class SoftDeleteManager(models.Manager):
    """软删除管理器：默认只返回未删除的记录"""
    
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Scan(models.Model):
    """扫描任务模型"""

    id = models.AutoField(primary_key=True)

    target = models.ForeignKey('targets.Target', on_delete=models.CASCADE, related_name='scans', help_text='扫描目标')

    engine = models.ForeignKey(
        'engine.ScanEngine',
        on_delete=models.CASCADE,
        related_name='scans',
        help_text='使用的扫描引擎'
    )

    created_at = models.DateTimeField(auto_now_add=True, help_text='任务创建时间')
    stopped_at = models.DateTimeField(null=True, blank=True, help_text='扫描结束时间')

    status = models.CharField(
        max_length=20,
        choices=ScanStatus.choices,
        default=ScanStatus.INITIATED,
        db_index=True,
        help_text='任务状态'
    )

    results_dir = models.CharField(max_length=100, blank=True, default='', help_text='结果存储目录')

    container_ids = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='容器 ID 列表（Docker Container ID）'
    )
    
    worker = models.ForeignKey(
        'engine.WorkerNode',
        on_delete=models.SET_NULL,
        related_name='scans',
        null=True,
        blank=True,
        help_text='执行扫描的 Worker 节点'
    )

    error_message = models.CharField(max_length=2000, blank=True, default='', help_text='错误信息')

    # ==================== 软删除字段 ====================
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True, help_text='删除时间（NULL表示未删除）')

    # ==================== 管理器 ====================
    objects = SoftDeleteManager()  # 默认管理器：只返回未删除的记录
    all_objects = models.Manager()  # 全量管理器：包括已删除的记录（用于硬删除）

    # ==================== 进度跟踪字段 ====================
    progress = models.IntegerField(default=0, help_text='扫描进度 0-100')
    current_stage = models.CharField(max_length=50, blank=True, default='', help_text='当前扫描阶段')
    stage_progress = models.JSONField(default=dict, help_text='各阶段进度详情')

    # ==================== 缓存统计字段 ====================
    cached_subdomains_count = models.IntegerField(default=0, help_text='缓存的子域名数量')
    cached_websites_count = models.IntegerField(default=0, help_text='缓存的网站数量')
    cached_endpoints_count = models.IntegerField(default=0, help_text='缓存的端点数量')
    cached_ips_count = models.IntegerField(default=0, help_text='缓存的IP地址数量')
    cached_directories_count = models.IntegerField(default=0, help_text='缓存的目录数量')
    cached_vulns_total = models.IntegerField(default=0, help_text='缓存的漏洞总数')
    cached_vulns_critical = models.IntegerField(default=0, help_text='缓存的严重漏洞数量')
    cached_vulns_high = models.IntegerField(default=0, help_text='缓存的高危漏洞数量')
    cached_vulns_medium = models.IntegerField(default=0, help_text='缓存的中危漏洞数量')
    cached_vulns_low = models.IntegerField(default=0, help_text='缓存的低危漏洞数量')
    stats_updated_at = models.DateTimeField(null=True, blank=True, help_text='统计数据最后更新时间')

    class Meta:
        db_table = 'scan'
        verbose_name = '扫描任务'
        verbose_name_plural = '扫描任务'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),  # 优化按创建时间降序排序（list 查询的默认排序）
            models.Index(fields=['target']),  # 优化按目标查询扫描任务
            models.Index(fields=['deleted_at', '-created_at']),  # 软删除 + 时间索引
        ]

    def __str__(self):
        return f"Scan #{self.id} - {self.target.name}"


class ScheduledScan(models.Model):
    """
    定时扫描任务模型
    
    调度机制：
    - APScheduler 每分钟检查 next_run_time
    - 到期任务通过 task_distributor 分发到 Worker 执行
    - 支持 cron 表达式进行灵活调度
    
    扫描模式（二选一）：
    - 组织扫描：设置 organization，执行时动态获取组织下所有目标
    - 目标扫描：设置 target，扫描单个目标
    - organization 优先级高于 target
    """
    
    id = models.AutoField(primary_key=True)
    
    # 基本信息
    name = models.CharField(max_length=200, help_text='任务名称')
    
    # 关联的扫描引擎
    engine = models.ForeignKey(
        'engine.ScanEngine',
        on_delete=models.CASCADE,
        related_name='scheduled_scans',
        help_text='使用的扫描引擎'
    )
    
    # 关联的组织（组织扫描模式：执行时动态获取组织下所有目标）
    organization = models.ForeignKey(
        'targets.Organization',
        on_delete=models.CASCADE,
        related_name='scheduled_scans',
        null=True,
        blank=True,
        help_text='扫描组织（设置后执行时动态获取组织下所有目标）'
    )
    
    # 关联的目标（目标扫描模式：扫描单个目标）
    target = models.ForeignKey(
        'targets.Target',
        on_delete=models.CASCADE,
        related_name='scheduled_scans',
        null=True,
        blank=True,
        help_text='扫描单个目标（与 organization 二选一）'
    )
    
    # 调度配置 - 直接使用 Cron 表达式
    cron_expression = models.CharField(
        max_length=100,
        default='0 2 * * *',
        help_text='Cron 表达式，格式：分 时 日 月 周'
    )
    
    # 状态
    is_enabled = models.BooleanField(default=True, db_index=True, help_text='是否启用')
    
    # 执行统计
    run_count = models.IntegerField(default=0, help_text='已执行次数')
    last_run_time = models.DateTimeField(null=True, blank=True, help_text='上次执行时间')
    next_run_time = models.DateTimeField(null=True, blank=True, help_text='下次执行时间')
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, help_text='创建时间')
    updated_at = models.DateTimeField(auto_now=True, help_text='更新时间')
    
    class Meta:
        db_table = 'scheduled_scan'
        verbose_name = '定时扫描任务'
        verbose_name_plural = '定时扫描任务'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['is_enabled', '-created_at']),
            models.Index(fields=['name']),  # 优化 name 搜索
        ]
    
    def __str__(self):
        return f"ScheduledScan #{self.id} - {self.name}"