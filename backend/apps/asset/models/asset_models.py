
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator, MaxValueValidator


class Subdomain(models.Model):
    """
    子域名模型（纯资产表）
    
    设计特点：
    - 只存储子域名资产信息
    - 与其他资产表（IPAddress、Port）无直接关联
    - 扫描历史记录存储在 SubdomainSnapshot 快照表中
    """

    id = models.AutoField(primary_key=True)
    target = models.ForeignKey(
        'targets.Target',  # 使用字符串引用避免循环导入
        on_delete=models.CASCADE,
        related_name='subdomains',
        help_text='所属的扫描目标（主关联字段，表示所属关系，不能为空）'
    )
    name = models.CharField(max_length=1000, help_text='子域名名称')
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='首次发现时间')

    class Meta:
        db_table = 'subdomain'
        verbose_name = '子域名'
        verbose_name_plural = '子域名'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['-discovered_at']),
            models.Index(fields=['name', 'target']),  # 复合索引，优化 get_by_names_and_target_id 批量查询
            models.Index(fields=['target']),     # 优化从target_id快速查找下面的子域名
            models.Index(fields=['name']),            # 优化从name快速查找子域名，搜索场景
        ]
        constraints = [
            # 普通唯一约束：name + target 组合唯一
            models.UniqueConstraint(
                fields=['name', 'target'],
                name='unique_subdomain_name_target'
            )
        ]

    def __str__(self):
        return str(self.name or f'Subdomain {self.id}')


class Endpoint(models.Model):
    """端点模型"""

    id = models.AutoField(primary_key=True)
    target = models.ForeignKey(
        'targets.Target',  # 使用字符串引用
        on_delete=models.CASCADE,
        related_name='endpoints',
        help_text='所属的扫描目标（主关联字段，表示所属关系，不能为空）'
    )
    
    url = models.CharField(max_length=2000, help_text='最终访问的完整URL')
    host = models.CharField(
        max_length=253,
        blank=True,
        default='',
        help_text='主机名（域名或IP地址）'
    )
    location = models.CharField(
        max_length=1000,
        blank=True,
        default='',
        help_text='重定向地址（HTTP 3xx 响应头 Location）'
    )
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='发现时间')
    title = models.CharField(
        max_length=1000,
        blank=True,
        default='',
        help_text='网页标题（HTML <title> 标签内容）'
    )
    webserver = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='服务器类型（HTTP 响应头 Server 值）'
    )
    body_preview = models.CharField(
        max_length=1000,
        blank=True,
        default='',
        help_text='响应正文前N个字符（默认100个字符）'
    )
    content_type = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='响应类型（HTTP Content-Type 响应头）'
    )
    tech = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='技术栈（服务器/框架/语言等）'
    )
    status_code = models.IntegerField(
        null=True,
        blank=True,
        help_text='HTTP状态码'
    )
    content_length = models.IntegerField(
        null=True,
        blank=True,
        help_text='响应体大小（单位字节）'
    )
    vhost = models.BooleanField(
        null=True,
        blank=True,
        help_text='是否支持虚拟主机'
    )
    matched_gf_patterns = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='匹配的GF模式列表，用于识别敏感端点（如api, debug, config等）'
    )

    class Meta:
        db_table = 'endpoint'
        verbose_name = '端点'
        verbose_name_plural = '端点'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['-discovered_at']),
            models.Index(fields=['target']),       # 优化从target_id快速查找下面的端点（主关联字段）
            models.Index(fields=['url']),          # URL索引，优化查询性能
            models.Index(fields=['host']),         # host索引，优化根据主机名查询
            models.Index(fields=['status_code']),  # 状态码索引，优化筛选
        ]
        constraints = [
            # 普通唯一约束：url + target 组合唯一
            models.UniqueConstraint(
                fields=['url', 'target'],
                name='unique_endpoint_url_target'
            )
        ]

    def __str__(self):
        return str(self.url or f'Endpoint {self.id}')


class WebSite(models.Model):
    """站点模型"""

    id = models.AutoField(primary_key=True)
    target = models.ForeignKey(
        'targets.Target',  # 使用字符串引用
        on_delete=models.CASCADE,
        related_name='websites',
        help_text='所属的扫描目标（主关联字段，表示所属关系，不能为空）'
    )

    url = models.CharField(max_length=2000, help_text='最终访问的完整URL')
    host = models.CharField(
        max_length=253,
        blank=True,
        default='',
        help_text='主机名（域名或IP地址）'
    )
    location = models.CharField(
        max_length=1000,
        blank=True,
        default='',
        help_text='重定向地址（HTTP 3xx 响应头 Location）'
    )
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='发现时间')
    title = models.CharField(
        max_length=1000,
        blank=True,
        default='',
        help_text='网页标题（HTML <title> 标签内容）'
    )
    webserver = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='服务器类型（HTTP 响应头 Server 值）'
    )
    body_preview = models.CharField(
        max_length=1000,
        blank=True,
        default='',
        help_text='响应正文前N个字符（默认100个字符）'
    )
    content_type = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='响应类型（HTTP Content-Type 响应头）'
    )
    tech = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='技术栈（服务器/框架/语言等）'
    )
    status_code = models.IntegerField(
        null=True,
        blank=True,
        help_text='HTTP状态码'
    )
    content_length = models.IntegerField(
        null=True,
        blank=True,
        help_text='响应体大小（单位字节）'
    )
    vhost = models.BooleanField(
        null=True,
        blank=True,
        help_text='是否支持虚拟主机'
    )

    class Meta:
        db_table = 'website'
        verbose_name = '站点'
        verbose_name_plural = '站点'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['-discovered_at']),
            models.Index(fields=['url']),  # URL索引，优化查询性能
            models.Index(fields=['host']),  # host索引，优化根据主机名查询
            models.Index(fields=['target']),     # 优化从target_id快速查找下面的站点
        ]
        constraints = [
            # 普通唯一约束：url + target 组合唯一
            models.UniqueConstraint(
                fields=['url', 'target'],
                name='unique_website_url_target'
            )
        ]

    def __str__(self):
        return str(self.url or f'Website {self.id}')


class Directory(models.Model):
    """
    目录模型
    """

    id = models.AutoField(primary_key=True)
    target = models.ForeignKey(
        'targets.Target',
        on_delete=models.CASCADE,
        related_name='directories',
        help_text='所属的扫描目标'
    )
    
    url = models.CharField(
        null=False,
        blank=False,
        max_length=2000,
        help_text='完整请求 URL'
    )
    status = models.IntegerField(
        null=True,
        blank=True,
        help_text='HTTP 响应状态码'
    )
    content_length = models.BigIntegerField(
        null=True,
        blank=True,
        help_text='响应体字节大小（Content-Length 或实际长度）'
    )
    words = models.IntegerField(
        null=True,
        blank=True,
        help_text='响应体中单词数量（按空格分割）'
    )
    lines = models.IntegerField(
        null=True,
        blank=True,
        help_text='响应体行数（按换行符分割）'
    )
    content_type = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='响应头 Content-Type 值'
    )
    duration = models.BigIntegerField(
        null=True,
        blank=True,
        help_text='请求耗时（单位：纳秒）'
    )
    
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='发现时间')

    class Meta:
        db_table = 'directory'
        verbose_name = '目录'
        verbose_name_plural = '目录'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['-discovered_at']),
            models.Index(fields=['target']),     # 优化从target_id快速查找下面的目录
            models.Index(fields=['url']),        # URL索引，优化搜索和唯一约束
            models.Index(fields=['status']),     # 状态码索引，优化筛选
        ]
        constraints = [
            # 普通唯一约束：target + url 组合唯一
            models.UniqueConstraint(
                fields=['target', 'url'],
                name='unique_directory_url_target'
            ),
        ]

    def __str__(self):
        return str(self.url or f'Directory {self.id}')


class HostPortMapping(models.Model):
    """
    主机端口映射表
    
    设计特点：
    - 存储主机（host）、IP、端口的三元映射关系
    - 只关联 target_id，不关联其他资产表
    - target + host + ip + port 组成复合唯一约束
    """

    id = models.AutoField(primary_key=True)
    
    # ==================== 关联字段 ====================
    target = models.ForeignKey(
        'targets.Target',
        on_delete=models.CASCADE,
        related_name='host_port_mappings',
        help_text='所属的扫描目标'
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
        db_table = 'host_port_mapping'
        verbose_name = '主机端口映射'
        verbose_name_plural = '主机端口映射'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['target']),           # 优化按目标查询
            models.Index(fields=['host']),             # 优化按主机名查询
            models.Index(fields=['ip']),               # 优化按IP查询
            models.Index(fields=['port']),             # 优化按端口查询
            models.Index(fields=['host', 'ip']),       # 优化组合查询
            models.Index(fields=['-discovered_at']),   # 优化时间排序
        ]
        constraints = [
            # 复合唯一约束：target + host + ip + port 组合唯一
            models.UniqueConstraint(
                fields=['target', 'host', 'ip', 'port'],
                name='unique_target_host_ip_port'
            ),
        ]

    def __str__(self):
        return f'{self.host} ({self.ip}:{self.port})'


class Vulnerability(models.Model):
    """
    漏洞模型（资产表）
    
    存储发现的漏洞资产，与 Target 关联。
    扫描历史记录存储在 VulnerabilitySnapshot 快照表中。
    """
    
    # 延迟导入避免循环引用
    from apps.common.definitions import VulnSeverity

    id = models.AutoField(primary_key=True)
    target = models.ForeignKey(
        'targets.Target',
        on_delete=models.CASCADE,
        related_name='vulnerabilities',
        help_text='所属的扫描目标'
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
    discovered_at = models.DateTimeField(auto_now_add=True, help_text='首次发现时间')

    class Meta:
        db_table = 'vulnerability'
        verbose_name = '漏洞'
        verbose_name_plural = '漏洞'
        ordering = ['-discovered_at']
        indexes = [
            models.Index(fields=['target']),
            models.Index(fields=['vuln_type']),
            models.Index(fields=['severity']),
            models.Index(fields=['source']),
            models.Index(fields=['-discovered_at']),
        ]

    def __str__(self):
        return f'{self.vuln_type} - {self.url[:50]}'
