"""
生成测试数据的管理命令

用法：
    python manage.py generate_test_data --target example.com --count 100000
    
性能测试：
    python manage.py generate_test_data --target example.com --count 10000 --batch-size 500 --benchmark
"""

import random
import string
import time
from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.utils import timezone
from apps.targets.models import Target
from apps.scan.models import Scan
from apps.asset.models.asset_models import Subdomain, IPAddress, Port, WebSite, Directory


class Command(BaseCommand):
    help = '为指定目标生成大量测试数据'

    def add_arguments(self, parser):
        parser.add_argument(
            '--target',
            type=str,
            required=True,
            help='目标域名（如 example.com）'
        )
        parser.add_argument(
            '--count',
            type=int,
            default=100000,
            help='每个表生成的记录数（默认 100000）'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='批量插入的批次大小（默认 1000）'
        )
        parser.add_argument(
            '--benchmark',
            action='store_true',
            help='启用性能基准测试模式（显示详细的性能指标）'
        )
        parser.add_argument(
            '--test-batch-sizes',
            action='store_true',
            help='测试不同批次大小的性能（100, 500, 1000, 2000, 5000）'
        )

    def handle(self, *args, **options):
        target_name = options['target']
        count = options['count']
        batch_size = options['batch_size']
        benchmark = options['benchmark']
        test_batch_sizes = options['test_batch_sizes']

        # 如果是测试批次大小模式
        if test_batch_sizes:
            self._test_batch_sizes(target_name, count)
            return

        self.stdout.write(f'\n{"="*60}')
        self.stdout.write(f'  开始生成测试数据')
        self.stdout.write(f'{"="*60}\n')
        self.stdout.write(f'目标: {target_name}')
        self.stdout.write(f'每表记录数: {count:,}')
        self.stdout.write(f'批次大小: {batch_size:,}')
        if benchmark:
            self.stdout.write('模式: 性能基准测试 ⚡')
            self._print_db_info()
        self.stdout.write('')
        
        # 记录总开始时间
        total_start_time = time.time()

        # 1. 获取或创建目标
        try:
            target = Target.objects.get(name=target_name)
            self.stdout.write(self.style.SUCCESS(f'✓ 找到目标: {target.name} (ID: {target.id})'))
        except Target.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'✗ 目标不存在: {target_name}'))
            return

        # 2. 创建新的测试扫描任务
        from apps.engine.models import ScanEngine
        engine = ScanEngine.objects.first()
        if not engine:
            self.stdout.write(self.style.ERROR('✗ 没有可用的扫描引擎'))
            return
        
        scan = Scan.objects.create(
            target=target,
            engine=engine,
            status='completed',
            results_dir=f'/tmp/test_{target_name}_{int(time.time())}'
        )
        self.stdout.write(self.style.SUCCESS(f'✓ 创建新测试扫描任务 (ID: {scan.id})'))

        # 3. 生成子域名
        self.stdout.write(f'\n[1/5] 生成 {count:,} 个子域名...')
        subdomains, stats1 = self._generate_subdomains(target, scan, count, batch_size, benchmark)
        
        # 4. 生成 IP 地址
        self.stdout.write(f'\n[2/5] 生成 {count:,} 个 IP 地址...')
        ips, stats2 = self._generate_ips(target, scan, subdomains, count, batch_size, benchmark)
        
        # 5. 生成端口
        self.stdout.write(f'\n[3/5] 生成 {count:,} 个端口...')
        stats3 = self._generate_ports(scan, ips, subdomains, count, batch_size, benchmark)
        
        # 6. 生成网站
        self.stdout.write(f'\n[4/5] 生成 {count:,} 个网站...')
        websites, stats4 = self._generate_websites(target, scan, subdomains, count, batch_size, benchmark)
        
        # 7. 生成目录
        self.stdout.write(f'\n[5/5] 生成 {count:,} 个目录...')
        stats5 = self._generate_directories(target, scan, websites, count, batch_size, benchmark)

        # 计算总耗时
        total_time = time.time() - total_start_time
        
        self.stdout.write(f'\n{"="*60}')
        self.stdout.write(self.style.SUCCESS('  ✓ 测试数据生成完成！'))
        self.stdout.write(f'{"="*60}')
        self.stdout.write(f'总耗时: {total_time:.2f} 秒 ({total_time/60:.2f} 分钟)\n')
        
        if benchmark:
            self._print_performance_summary([stats1, stats2, stats3, stats4, stats5])

    def _generate_subdomains(self, target, scan, count, batch_size, benchmark=False):
        """生成子域名"""
        subdomains = []
        created_subdomains = []
        start_time = time.time()
        batch_times = []
        
        for i in range(count):
            # 生成唯一的子域名
            subdomain_name = f'test-{i:07d}.{target.name}'
            
            subdomains.append(Subdomain(
                target=target,
                scan=scan,
                name=subdomain_name,
                cname=[],
                is_cdn=random.choice([True, False]),
                cdn_name=random.choice(['', 'cloudflare', 'akamai', 'fastly'])
            ))
            
            # 批量插入
            if len(subdomains) >= batch_size:
                batch_start = time.time()
                with transaction.atomic():
                    created = Subdomain.objects.bulk_create(subdomains, ignore_conflicts=True)
                    created_subdomains.extend(created)
                batch_time = time.time() - batch_start
                batch_times.append(batch_time)
                
                if benchmark:
                    speed = len(subdomains) / batch_time
                    self.stdout.write(f'  插入 {len(subdomains):,} 个 | 耗时: {batch_time:.2f}s | 速度: {speed:.0f} 条/秒')
                else:
                    self.stdout.write(f'  插入 {len(subdomains):,} 个子域名... (进度: {i+1:,}/{count:,})')
                subdomains = []
        
        # 插入剩余的
        if subdomains:
            with transaction.atomic():
                created = Subdomain.objects.bulk_create(subdomains, ignore_conflicts=True)
                created_subdomains.extend(created)
            self.stdout.write(f'  插入 {len(subdomains):,} 个子域名... (进度: {count:,}/{count:,})')
        
        total_time = time.time() - start_time
        avg_batch_time = sum(batch_times) / len(batch_times) if batch_times else 0
        total_speed = len(created_subdomains) / total_time if total_time > 0 else 0
        
        self.stdout.write(self.style.SUCCESS(
            f'  ✓ 完成！共创建 {len(created_subdomains):,} 个 | '
            f'总耗时: {total_time:.2f}s | '
            f'平均速度: {total_speed:.0f} 条/秒'
        ))
        
        return created_subdomains, {
            'name': '子域名',
            'count': len(created_subdomains),
            'time': total_time,
            'speed': total_speed,
            'avg_batch_time': avg_batch_time
        }

    def _generate_ips(self, target, scan, subdomains, count, batch_size, benchmark=False):
        """生成 IP 地址"""
        # 重新从数据库查询 subdomain，确保有 ID
        subdomain_list = list(Subdomain.objects.filter(scan=scan).values_list('id', flat=True))
        
        ips = []
        created_ips = []
        start_time = time.time()
        batch_times = []
        
        for i in range(count):
            # 生成随机 IP
            ip_addr = f'192.168.{random.randint(0, 255)}.{random.randint(1, 254)}'
            subdomain_id = random.choice(subdomain_list) if subdomain_list else None
            
            if subdomain_id:
                ips.append(IPAddress(
                    target=target,
                    scan=scan,
                    subdomain_id=subdomain_id,
                    ip=f'{ip_addr}-{i}',  # 加后缀确保唯一
                    protocol_version='IPv4',
                    is_private=True
                ))
            
            # 批量插入
            if len(ips) >= batch_size:
                batch_start = time.time()
                with transaction.atomic():
                    created = IPAddress.objects.bulk_create(ips, ignore_conflicts=True)
                    created_ips.extend(created)
                batch_time = time.time() - batch_start
                batch_times.append(batch_time)
                
                if benchmark:
                    speed = len(ips) / batch_time
                    self.stdout.write(f'  插入 {len(ips):,} 个 | 耗时: {batch_time:.2f}s | 速度: {speed:.0f} 条/秒')
                else:
                    self.stdout.write(f'  插入 {len(ips):,} 个 IP 地址... (进度: {i+1:,}/{count:,})')
                ips = []
        
        # 插入剩余的
        if ips:
            with transaction.atomic():
                created = IPAddress.objects.bulk_create(ips, ignore_conflicts=True)
                created_ips.extend(created)
            self.stdout.write(f'  插入 {len(ips):,} 个 IP 地址... (进度: {count:,}/{count:,})')
        
        total_time = time.time() - start_time
        avg_batch_time = sum(batch_times) / len(batch_times) if batch_times else 0
        total_speed = len(created_ips) / total_time if total_time > 0 else 0
        
        self.stdout.write(self.style.SUCCESS(
            f'  ✓ 完成！共创建 {len(created_ips):,} 个 | '
            f'总耗时: {total_time:.2f}s | '
            f'平均速度: {total_speed:.0f} 条/秒'
        ))
        
        return created_ips, {
            'name': 'IP地址',
            'count': len(created_ips),
            'time': total_time,
            'speed': total_speed,
            'avg_batch_time': avg_batch_time
        }

    def _generate_ports(self, scan, ips, subdomains, count, batch_size, benchmark=False):
        """生成端口"""
        # 重新查询 IP 和 subdomain 的 ID
        ip_list = list(IPAddress.objects.filter(scan=scan).values_list('id', flat=True))
        subdomain_list = list(Subdomain.objects.filter(scan=scan).values_list('id', flat=True))
        
        ports = []
        total_created = 0
        start_time = time.time()
        batch_times = []
        
        for i in range(count):
            ip_id = random.choice(ip_list) if ip_list else None
            subdomain_id = random.choice(subdomain_list) if subdomain_list else None
            
            if ip_id:
                ports.append(Port(
                    ip_address_id=ip_id,
                    subdomain_id=subdomain_id,
                    number=random.randint(1, 65535),
                    service_name=random.choice(['http', 'https', 'ssh', 'ftp', 'mysql']),
                    is_uncommon=random.choice([True, False])
                ))
            
            # 批量插入
            if len(ports) >= batch_size:
                batch_start = time.time()
                with transaction.atomic():
                    Port.objects.bulk_create(ports, ignore_conflicts=True)
                total_created += len(ports)
                batch_time = time.time() - batch_start
                batch_times.append(batch_time)
                
                if benchmark:
                    speed = len(ports) / batch_time
                    self.stdout.write(f'  插入 {len(ports):,} 个 | 耗时: {batch_time:.2f}s | 速度: {speed:.0f} 条/秒')
                else:
                    self.stdout.write(f'  插入 {len(ports):,} 个端口... (进度: {i+1:,}/{count:,})')
                ports = []
        
        # 插入剩余的
        if ports:
            with transaction.atomic():
                Port.objects.bulk_create(ports, ignore_conflicts=True)
            total_created += len(ports)
            self.stdout.write(f'  插入 {len(ports):,} 个端口... (进度: {count:,}/{count:,})')
        
        total_time = time.time() - start_time
        avg_batch_time = sum(batch_times) / len(batch_times) if batch_times else 0
        total_speed = total_created / total_time if total_time > 0 else 0
        
        self.stdout.write(self.style.SUCCESS(
            f'  ✓ 完成！共创建 {total_created:,} 个 | '
            f'总耗时: {total_time:.2f}s | '
            f'平均速度: {total_speed:.0f} 条/秒'
        ))
        
        return {
            'name': '端口',
            'count': total_created,
            'time': total_time,
            'speed': total_speed,
            'avg_batch_time': avg_batch_time
        }

    def _generate_websites(self, target, scan, subdomains, count, batch_size, benchmark=False):
        """生成网站"""
        # 重新查询 subdomain 信息
        subdomain_data = list(Subdomain.objects.filter(scan=scan).values('id', 'name'))
        
        websites = []
        created_websites = []
        start_time = time.time()
        batch_times = []
        
        for i in range(count):
            subdomain = random.choice(subdomain_data) if subdomain_data else None
            
            if subdomain:
                protocol = random.choice(['http', 'https'])
                url = f'{protocol}://{subdomain["name"]}'
                
                websites.append(WebSite(
                    target=target,
                    scan=scan,
                    subdomain_id=subdomain['id'],
                    url=f'{url}?id={i}',  # 加参数确保唯一
                    title=f'Test Website {i}',
                    status_code=random.choice([200, 301, 302, 404, 500]),
                    content_length=random.randint(1000, 100000),
                    webserver=random.choice(['nginx', 'apache', 'IIS']),
                    content_type='text/html',
                    tech=['Python', 'Django'] if i % 2 == 0 else ['Node.js', 'React'],
                    vhost=random.choice([True, False, None])
                ))
            
            # 批量插入
            if len(websites) >= batch_size:
                batch_start = time.time()
                with transaction.atomic():
                    created = WebSite.objects.bulk_create(websites, ignore_conflicts=True)
                    created_websites.extend(created)
                batch_time = time.time() - batch_start
                batch_times.append(batch_time)
                
                if benchmark:
                    speed = len(websites) / batch_time
                    self.stdout.write(f'  插入 {len(websites):,} 个 | 耗时: {batch_time:.2f}s | 速度: {speed:.0f} 条/秒')
                else:
                    self.stdout.write(f'  插入 {len(websites):,} 个网站... (进度: {i+1:,}/{count:,})')
                websites = []
        
        # 插入剩余的
        if websites:
            with transaction.atomic():
                created = WebSite.objects.bulk_create(websites, ignore_conflicts=True)
                created_websites.extend(created)
            self.stdout.write(f'  插入 {len(websites):,} 个网站... (进度: {count:,}/{count:,})')
        
        total_time = time.time() - start_time
        avg_batch_time = sum(batch_times) / len(batch_times) if batch_times else 0
        total_speed = len(created_websites) / total_time if total_time > 0 else 0
        
        self.stdout.write(self.style.SUCCESS(
            f'  ✓ 完成！共创建 {len(created_websites):,} 个 | '
            f'总耗时: {total_time:.2f}s | '
            f'平均速度: {total_speed:.0f} 条/秒'
        ))
        
        return created_websites, {
            'name': '网站',
            'count': len(created_websites),
            'time': total_time,
            'speed': total_speed,
            'avg_batch_time': avg_batch_time
        }

    def _generate_directories(self, target, scan, websites, count, batch_size, benchmark=False):
        """生成目录"""
        # 重新查询 website 信息
        website_data = list(WebSite.objects.filter(scan=scan).values('id', 'url'))
        
        directories = []
        total_created = 0
        start_time = time.time()
        batch_times = []
        
        for i in range(count):
            website = random.choice(website_data) if website_data else None
            
            if website:
                path = ''.join(random.choices(string.ascii_lowercase, k=10))
                
                directories.append(Directory(
                    target=target,
                    scan=scan,
                    website_id=website['id'],
                    url=f'{website["url"]}/dir/{path}/{i}',  # 加后缀确保唯一
                    status=random.choice([200, 301, 403, 404]),
                    length=random.randint(1000, 50000),
                    words=random.randint(100, 5000),
                    lines=random.randint(50, 1000),
                    content_type='text/html'
                ))
            
            # 批量插入
            if len(directories) >= batch_size:
                batch_start = time.time()
                with transaction.atomic():
                    Directory.objects.bulk_create(directories, ignore_conflicts=True)
                total_created += len(directories)
                batch_time = time.time() - batch_start
                batch_times.append(batch_time)
                
                if benchmark:
                    speed = len(directories) / batch_time
                    self.stdout.write(f'  插入 {len(directories):,} 个 | 耗时: {batch_time:.2f}s | 速度: {speed:.0f} 条/秒')
                else:
                    self.stdout.write(f'  插入 {len(directories):,} 个目录... (进度: {i+1:,}/{count:,})')
                directories = []
        
        # 插入剩余的
        if directories:
            with transaction.atomic():
                Directory.objects.bulk_create(directories, ignore_conflicts=True)
            total_created += len(directories)
            self.stdout.write(f'  插入 {len(directories):,} 个目录... (进度: {count:,}/{count:,})')
        
        total_time = time.time() - start_time
        avg_batch_time = sum(batch_times) / len(batch_times) if batch_times else 0
        total_speed = total_created / total_time if total_time > 0 else 0
        
        self.stdout.write(self.style.SUCCESS(
            f'  ✓ 完成！共创建 {total_created:,} 个 | '
            f'总耗时: {total_time:.2f}s | '
            f'平均速度: {total_speed:.0f} 条/秒'
        ))
        
        return {
            'name': '目录',
            'count': total_created,
            'time': total_time,
            'speed': total_speed,
            'avg_batch_time': avg_batch_time
        }
    
    def _print_db_info(self):
        """打印数据库连接信息"""
        db_settings = connection.settings_dict
        self.stdout.write(f'\n数据库信息:')
        self.stdout.write(f'  主机: {db_settings["HOST"]}')
        self.stdout.write(f'  端口: {db_settings["PORT"]}')
        self.stdout.write(f'  数据库: {db_settings["NAME"]}')
        self.stdout.write(f'  引擎: {db_settings["ENGINE"].split(".")[-1]}')
    
    def _print_performance_summary(self, stats_list):
        """打印性能总结"""
        self.stdout.write(f'\n{"="*60}')
        self.stdout.write('  性能测试报告')
        self.stdout.write(f'{"="*60}\n')
        
        total_records = sum(s['count'] for s in stats_list)
        total_time = sum(s['time'] for s in stats_list)
        overall_speed = total_records / total_time if total_time > 0 else 0
        
        self.stdout.write(f'{"表名":<12} {"记录数":<12} {"耗时(秒)":<12} {"速度(条/秒)":<15} {"平均批次时间(秒)"}')
        self.stdout.write('-' * 65)
        
        for stats in stats_list:
            self.stdout.write(
                f'{stats["name"]:<12} '
                f'{stats["count"]:<12,} '
                f'{stats["time"]:<12.2f} '
                f'{stats["speed"]:<15.0f} '
                f'{stats.get("avg_batch_time", 0):<.3f}'
            )
        
        self.stdout.write('-' * 65)
        self.stdout.write(
            f'{"总计":<12} '
            f'{total_records:<12,} '
            f'{total_time:<12.2f} '
            f'{overall_speed:<15.0f}'
        )
        self.stdout.write('')
    
    def _test_batch_sizes(self, target_name, count):
        """测试不同批次大小的性能"""
        batch_sizes = [100, 500, 1000, 2000, 5000]
        test_count = min(count, 10000)  # 限制测试数据量
        
        self.stdout.write(f'\n{"="*60}')
        self.stdout.write(f'  批次大小性能测试')
        self.stdout.write(f'{"="*60}\n')
        self.stdout.write(f'测试数据量: {test_count:,} 条')
        self.stdout.write(f'测试批次: {batch_sizes}\n')
        
        results = []
        
        for batch_size in batch_sizes:
            self.stdout.write(f'\n测试批次大小: {batch_size}')
            self.stdout.write('-' * 40)
            
            # 这里只测试子域名的插入性能
            try:
                target = Target.objects.get(name=target_name)
            except Target.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'目标不存在: {target_name}'))
                return
            
            scan = Scan.objects.filter(target=target).first()
            if not scan:
                from apps.engine.models import ScanEngine
                engine = ScanEngine.objects.first()
                scan = Scan.objects.create(
                    target=target,
                    engine=engine,
                    status='completed',
                    results_dir=f'/tmp/test_{target_name}'
                )
            
            _, stats = self._generate_subdomains(target, scan, test_count, batch_size, benchmark=True)
            results.append((batch_size, stats))
            
            # 清理测试数据
            Subdomain.objects.filter(scan=scan, name__startswith=f'test-').delete()
        
        # 打印对比结果
        self.stdout.write(f'\n{"="*60}')
        self.stdout.write('  批次大小对比结果')
        self.stdout.write(f'{"="*60}\n')
        self.stdout.write(f'{"批次大小":<12} {"总耗时(秒)":<15} {"速度(条/秒)":<15} {"平均批次时间(秒)"}')
        self.stdout.write('-' * 60)
        
        for batch_size, stats in results:
            self.stdout.write(
                f'{batch_size:<12} '
                f'{stats["time"]:<15.2f} '
                f'{stats["speed"]:<15.0f} '
                f'{stats["avg_batch_time"]:<.3f}'
            )
        
        # 找出最快的批次大小
        fastest = min(results, key=lambda x: x[1]['time'])
        self.stdout.write(f'\n推荐批次大小: {fastest[0]} (最快: {fastest[1]["time"]:.2f}秒)')
        self.stdout.write('')
