from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator, MaxValueValidator


class SubdomainSnapshot(models.Model):
    """子域名快照"""

    id = models.AutoField(primary_key=True)
    scan = models.ForeignKey(
        'scan.Scan',
        on_delete=models.CASCADE,
        related_name='subdomain_snapshots',
        help_text='所属的扫描任务'
    )
    
    name = models.CharField(max_length=1000, help_text='子域名名称')
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='发现时间')
    
    class Meta:
        db_table = 'subdomain_snapshot'
        verbose_name = '子域名快照'
        verbose_name_plural = '子域名快照'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['scan']),
            models.Index(fields=['name']),
            models.Index(fields=['-discovered_at']),
        ]
        constraints = [
            # 唯一约束：同一次扫描中，同一个子域名只能记录一次
            models.UniqueConstraint(
                fields=['scan', 'name'],
                name='unique_subdomain_per_scan_snapshot'
            ),
        ]

    def __str__(self):
        return f'{self.name} (Scan #{self.scan_id})'

class WebsiteSnapshot(models.Model):
    """
    网站快照
    
    记录：某次扫描中发现的网站
    """

    id = models.AutoField(primary_key=True)
    scan = models.ForeignKey(
        'scan.Scan',
        on_delete=models.CASCADE,
        related_name='website_snapshots',
        help_text='所属的扫描任务'
    )
    
    # 扫描结果数据
    url = models.CharField(max_length=2000, help_text='站点URL')
    host = models.CharField(max_length=253, blank=True, default='', help_text='主机名（域名或IP地址）')
    title = models.CharField(max_length=500, blank=True, default='', help_text='页面标题')
    status = models.IntegerField(null=True, blank=True, help_text='HTTP状态码')
    content_length = models.BigIntegerField(null=True, blank=True, help_text='内容长度')
    location = models.CharField(max_length=1000, blank=True, default='', help_text='重定向位置')
    web_server = models.CharField(max_length=200, blank=True, default='', help_text='Web服务器')
    content_type = models.CharField(max_length=200, blank=True, default='', help_text='内容类型')
    tech = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='技术栈'
    )
    body_preview = models.TextField(blank=True, default='', help_text='响应体预览')
    vhost = models.BooleanField(null=True, blank=True, help_text='虚拟主机标志')
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='发现时间')

    class Meta:
        db_table = 'website_snapshot'
        verbose_name = '网站快照'
        verbose_name_plural = '网站快照'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['scan']),
            models.Index(fields=['url']),
            models.Index(fields=['host']),  # host索引，优化根据主机名查询
            models.Index(fields=['-discovered_at']),
        ]
        constraints = [
            # 唯一约束：同一次扫描中，同一个URL只能记录一次
            models.UniqueConstraint(
                fields=['scan', 'url'],
                name='unique_website_per_scan_snapshot'
            ),
        ]

    def __str__(self):
        return f'{self.url} (Scan #{self.scan_id})'


class DirectorySnapshot(models.Model):
    """
    目录快照
    
    记录：某次扫描中发现的目录
    """

    id = models.AutoField(primary_key=True)
    scan = models.ForeignKey(
        'scan.Scan',
        on_delete=models.CASCADE,
        related_name='directory_snapshots',
        help_text='所属的扫描任务'
    )
    
    # 扫描结果数据
    url = models.CharField(max_length=2000, help_text='目录URL')
    status = models.IntegerField(null=True, blank=True, help_text='HTTP状态码')
    content_length = models.BigIntegerField(null=True, blank=True, help_text='内容长度')
    words = models.IntegerField(null=True, blank=True, help_text='响应体中单词数量（按空格分割）')
    lines = models.IntegerField(null=True, blank=True, help_text='响应体行数（按换行符分割）')
    content_type = models.CharField(max_length=200, blank=True, default='', help_text='响应头 Content-Type 值')
    duration = models.BigIntegerField(null=True, blank=True, help_text='请求耗时（单位：纳秒）')
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='发现时间')

    class Meta:
        db_table = 'directory_snapshot'
        verbose_name = '目录快照'
        verbose_name_plural = '目录快照'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['scan']),
            models.Index(fields=['url']),
            models.Index(fields=['status']),  # 状态码索引，优化筛选
            models.Index(fields=['-discovered_at']),
        ]
        constraints = [
            # 唯一约束：同一次扫描中，同一个目录URL只能记录一次
            models.UniqueConstraint(
                fields=['scan', 'url'],
                name='unique_directory_per_scan_snapshot'
            ),
        ]

    def __str__(self):
        return f'{self.url} (Scan #{self.scan_id})'


class HostPortMappingSnapshot(models.Model):
    """
    主机端口映射快照表
    
    设计特点：
    - 存储某次扫描中发现的主机（host）、IP、端口的三元映射关系
    - 主关联 scan_id，记录扫描历史
    - scan + host + ip + port 组成复合唯一约束
    """

    id = models.AutoField(primary_key=True)
    
    # ==================== 关联字段 ====================
    scan = models.ForeignKey(
        'scan.Scan',
        on_delete=models.CASCADE,
        related_name='host_port_mapping_snapshots',
        help_text='所属的扫描任务（主关联）'
    )
    
    # ==================== 核心字段 ====================
    host = models.CharField(
        max_length=1000,
        blank=False,
        help_text='主机名（域名或IP）'
    )
    ip = models.GenericIPAddressField(
        blank=False,
        help_text='IP地址'
    )
    port = models.IntegerField(
        blank=False,
        validators=[
            MinValueValidator(1, message='端口号必须大于等于1'),
            MaxValueValidator(65535, message='端口号必须小于等于65535')
        ],
        help_text='端口号（1-65535）'
    )
    
    # ==================== 时间字段 ====================
    discovered_at = models.DateTimeField(
        auto_now_add=True,
        help_text='发现时间'
    )

    class Meta:
        db_table = 'host_port_mapping_snapshot'
        verbose_name = '主机端口映射快照'
        verbose_name_plural = '主机端口映射快照'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['scan']),             # 优化按扫描查询
            models.Index(fields=['host']),             # 优化按主机名查询
            models.Index(fields=['ip']),               # 优化按IP查询
            models.Index(fields=['port']),             # 优化按端口查询
            models.Index(fields=['host', 'ip']),       # 优化组合查询
            models.Index(fields=['scan', 'host']),     # 优化扫描+主机查询
            models.Index(fields=['-discovered_at']),   # 优化时间排序
        ]
        constraints = [
            # 复合唯一约束：同一次扫描中，scan + host + ip + port 组合唯一
            models.UniqueConstraint(
                fields=['scan', 'host', 'ip', 'port'],
                name='unique_scan_host_ip_port_snapshot'
            ),
        ]

    def __str__(self):
        return f'{self.host} ({self.ip}:{self.port}) [Scan #{self.scan_id}]'


class EndpointSnapshot(models.Model):
    """
    端点快照
    
    记录：某次扫描中发现的端点
    """

    id = models.AutoField(primary_key=True)
    scan = models.ForeignKey(
        'scan.Scan',
        on_delete=models.CASCADE,
        related_name='endpoint_snapshots',
        help_text='所属的扫描任务'
    )
    
    # 扫描结果数据
    url = models.CharField(max_length=2000, help_text='端点URL')
    host = models.CharField(
        max_length=253,
        blank=True,
        default='',
        help_text='主机名（域名或IP地址）'
    )
    title = models.CharField(max_length=1000, blank=True, default='', help_text='页面标题')
    status_code = models.IntegerField(null=True, blank=True, help_text='HTTP状态码')
    content_length = models.IntegerField(null=True, blank=True, help_text='内容长度')
    location = models.CharField(max_length=1000, blank=True, default='', help_text='重定向位置')
    webserver = models.CharField(max_length=200, blank=True, default='', help_text='Web服务器')
    content_type = models.CharField(max_length=200, blank=True, default='', help_text='内容类型')
    tech = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='技术栈'
    )
    body_preview = models.CharField(max_length=1000, blank=True, default='', help_text='响应体预览')
    vhost = models.BooleanField(null=True, blank=True, help_text='虚拟主机标志')
    matched_gf_patterns = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='匹配的GF模式列表'
    )
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='发现时间')

    class Meta:
        db_table = 'endpoint_snapshot'
        verbose_name = '端点快照'
        verbose_name_plural = '端点快照'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['scan']),
            models.Index(fields=['url']),
            models.Index(fields=['host']),  # host索引，优化根据主机名查询
            models.Index(fields=['status_code']),  # 状态码索引，优化筛选
            models.Index(fields=['-discovered_at']),
        ]
        constraints = [
            # 唯一约束：同一次扫描中，同一个URL只能记录一次
            models.UniqueConstraint(
                fields=['scan', 'url'],
                name='unique_endpoint_per_scan_snapshot'
            ),
        ]

    def __str__(self):
        return f'{self.url} (Scan #{self.scan_id})'


class VulnerabilitySnapshot(models.Model):
    """
    漏洞快照
    
    记录：某次扫描中发现的漏洞
    """
    
    # 延迟导入避免循环引用
    from apps.common.definitions import VulnSeverity

    id = models.AutoField(primary_key=True)
    scan = models.ForeignKey(
        'scan.Scan',
        on_delete=models.CASCADE,
        related_name='vulnerability_snapshots',
        help_text='所属的扫描任务'
    )
    
    # ==================== 核心字段 ====================
    url = models.TextField(help_text='漏洞所在的URL')
    vuln_type = models.CharField(max_length=100, help_text='漏洞类型（如 xss, sqli）')
    severity = models.CharField(
        max_length=20,
        choices=VulnSeverity.choices,
        default=VulnSeverity.UNKNOWN,
        help_text='严重性（未知/信息/低/中/高/危急）'
    )
    source = models.CharField(max_length=50, blank=True, default='', help_text='来源工具（如 dalfox, nuclei, crlfuzz）')
    cvss_score = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True, help_text='CVSS 评分（0.0-10.0）')
    description = models.TextField(blank=True, default='', help_text='漏洞描述')
    raw_output = models.JSONField(blank=True, default=dict, help_text='工具原始输出')
    
    # ==================== 时间字段 ====================
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='发现时间')

    class Meta:
        db_table = 'vulnerability_snapshot'
        verbose_name = '漏洞快照'
        verbose_name_plural = '漏洞快照'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['scan']),
            models.Index(fields=['vuln_type']),
            models.Index(fields=['severity']),
            models.Index(fields=['source']),
            models.Index(fields=['-discovered_at']),
        ]

    def __str__(self):
        return f'{self.vuln_type} - {self.url[:50]} (Scan #{self.scan_id})'