from django.db import models


class WorkerNode(models.Model):
    """Worker 节点模型 - 分布式扫描执行器"""
    
    # 状态选项（前后端统一）
    STATUS_CHOICES = [
        ('pending', '待部署'),
        ('deploying', '部署中'),
        ('online', '在线'),
        ('offline', '离线'),
    ]
    
    name = models.CharField(max_length=100, help_text='节点名称')
    # 本地节点会自动填入 127.0.0.1 或容器 IP
    ip_address = models.GenericIPAddressField(help_text='IP 地址（本地节点为 127.0.0.1）')
    ssh_port = models.IntegerField(default=22, help_text='SSH 端口')
    username = models.CharField(max_length=50, default='root', help_text='SSH 用户名')
    password = models.CharField(max_length=200, blank=True, default='', help_text='SSH 密码')
    
    # 本地节点标记（Docker 容器内的 Worker）
    is_local = models.BooleanField(default=False, help_text='是否为本地节点（Docker 容器内）')
    
    # 状态（前后端统一）
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='pending', 
        help_text='状态: pending/deploying/online/offline'
    )
    
    # 心跳数据存储在 Redis（worker:load:{id}），不再使用数据库字段
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'worker_node'
        verbose_name = 'Worker 节点'
        ordering = ['-created_at']
        constraints = [
            # 远程节点 IP 唯一（本地节点不限制，因为都是 127.0.0.1）
            models.UniqueConstraint(
                fields=['ip_address'],
                condition=models.Q(is_local=False),
                name='unique_remote_worker_ip'
            ),
            # 名称全局唯一
            models.UniqueConstraint(
                fields=['name'],
                name='unique_worker_name'
            ),
        ]
    
    def __str__(self):
        if self.is_local:
            return f"{self.name} (本地)"
        return f"{self.name} ({self.ip_address or '未知'})"


class ScanEngine(models.Model):
    """扫描引擎模型"""
    
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, unique=True, help_text='引擎名称')
    configuration = models.CharField(max_length=10000, blank=True, default='', help_text='引擎配置，yaml 格式')
    created_at = models.DateTimeField(auto_now_add=True, help_text='创建时间')
    updated_at = models.DateTimeField(auto_now=True, help_text='更新时间')

    class Meta:
        db_table = 'scan_engine'
        verbose_name = '扫描引擎'
        verbose_name_plural = '扫描引擎'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
        ]
    def __str__(self):
        return str(self.name or f'ScanEngine {self.id}')


class Wordlist(models.Model):
    """字典文件模型"""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, unique=True, help_text='字典名称，唯一')
    description = models.CharField(max_length=200, blank=True, default='', help_text='字典描述')
    file_path = models.CharField(max_length=500, help_text='后端保存的字典文件绝对路径')
    file_size = models.BigIntegerField(default=0, help_text='文件大小（字节）')
    line_count = models.IntegerField(default=0, help_text='字典行数')
    file_hash = models.CharField(max_length=64, blank=True, default='', help_text='文件 SHA-256 哈希，用于缓存校验')
    created_at = models.DateTimeField(auto_now_add=True, help_text='创建时间')
    updated_at = models.DateTimeField(auto_now=True, help_text='更新时间')

    class Meta:
        db_table = 'wordlist'
        verbose_name = '字典文件'
        verbose_name_plural = '字典文件'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
        ]

    def __str__(self) -> str:
        return self.name


class NucleiTemplateRepo(models.Model):
    """Nuclei 模板 Git 仓库模型（多仓库）"""

    name = models.CharField(max_length=200, unique=True, help_text="仓库名称，用于前端展示和配置引用")
    repo_url = models.CharField(max_length=500, help_text="Git 仓库地址")
    local_path = models.CharField(max_length=500, blank=True, default='', help_text="本地工作目录绝对路径")
    commit_hash = models.CharField(max_length=40, blank=True, default='', help_text="最后同步的 Git commit hash，用于 Worker 版本校验")
    last_synced_at = models.DateTimeField(null=True, blank=True, help_text="最后一次成功同步时间")
    created_at = models.DateTimeField(auto_now_add=True, help_text="创建时间")
    updated_at = models.DateTimeField(auto_now=True, help_text="更新时间")

    class Meta:
        db_table = "nuclei_template_repo"
        verbose_name = "Nuclei 模板仓库"
        verbose_name_plural = "Nuclei 模板仓库"

    def __str__(self) -> str:  # pragma: no cover - 简单表示
        return f"NucleiTemplateRepo({self.id}, {self.name})"
