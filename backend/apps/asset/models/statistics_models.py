from django.db import models


class AssetStatistics(models.Model):
    """
    资产统计表
    
    存储预聚合的全局统计数据，避免仪表盘实时 COUNT 大表。
    由定时任务（Prefect Flow）定期刷新。
    """

    id = models.AutoField(primary_key=True)
    
    # ==================== 当前统计字段 ====================
    total_targets = models.IntegerField(default=0, help_text='目标总数')
    total_subdomains = models.IntegerField(default=0, help_text='子域名总数')
    total_ips = models.IntegerField(default=0, help_text='IP地址总数')
    total_endpoints = models.IntegerField(default=0, help_text='端点总数')
    total_websites = models.IntegerField(default=0, help_text='网站总数')
    total_vulns = models.IntegerField(default=0, help_text='漏洞总数')
    total_assets = models.IntegerField(default=0, help_text='总资产数（子域名+IP+端点+网站）')
    
    # ==================== 上次统计字段（用于计算趋势）====================
    prev_targets = models.IntegerField(default=0, help_text='上次目标总数')
    prev_subdomains = models.IntegerField(default=0, help_text='上次子域名总数')
    prev_ips = models.IntegerField(default=0, help_text='上次IP地址总数')
    prev_endpoints = models.IntegerField(default=0, help_text='上次端点总数')
    prev_websites = models.IntegerField(default=0, help_text='上次网站总数')
    prev_vulns = models.IntegerField(default=0, help_text='上次漏洞总数')
    prev_assets = models.IntegerField(default=0, help_text='上次总资产数')
    
    # ==================== 时间字段 ====================
    updated_at = models.DateTimeField(auto_now=True, help_text='最后更新时间')

    class Meta:
        db_table = 'asset_statistics'
        verbose_name = '资产统计'
        verbose_name_plural = '资产统计'

    def __str__(self):
        return f'AssetStatistics (updated: {self.updated_at})'

    @classmethod
    def get_or_create_singleton(cls) -> 'AssetStatistics':
        """获取或创建单例统计记录"""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class StatisticsHistory(models.Model):
    """
    统计历史表（用于折线图）
    
    每天记录一条快照，用于展示趋势。
    由定时任务在刷新统计时自动写入。
    """
    
    date = models.DateField(unique=True, help_text='统计日期')
    
    # 各类资产数量
    total_targets = models.IntegerField(default=0, help_text='目标总数')
    total_subdomains = models.IntegerField(default=0, help_text='子域名总数')
    total_ips = models.IntegerField(default=0, help_text='IP地址总数')
    total_endpoints = models.IntegerField(default=0, help_text='端点总数')
    total_websites = models.IntegerField(default=0, help_text='网站总数')
    total_vulns = models.IntegerField(default=0, help_text='漏洞总数')
    total_assets = models.IntegerField(default=0, help_text='总资产数')
    
    created_at = models.DateTimeField(auto_now_add=True, help_text='创建时间')
    updated_at = models.DateTimeField(auto_now=True, help_text='更新时间')
    
    class Meta:
        db_table = 'statistics_history'
        verbose_name = '统计历史'
        verbose_name_plural = '统计历史'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['date']),
        ]
    
    def __str__(self):
        return f'StatisticsHistory ({self.date})'
