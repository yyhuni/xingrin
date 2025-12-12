"""
数据库健康检查管理命令

使用方法:
python manage.py db_health_check                              # 基础延迟测试（5次）
python manage.py db_health_check --test-count=10              # 指定测试次数
python manage.py db_health_check --reconnect                  # 强制重连后测试
python manage.py db_health_check --stats                      # 显示连接统计信息
python manage.py db_health_check --api-test                   # 测试实际API查询性能
python manage.py db_health_check --monitor                    # 监控数据库服务器性能指标
python manage.py db_health_check --db=other                   # 指定数据库别名
python manage.py db_health_check --api-test --test-count=10   # API性能测试10次
python manage.py db_health_check --reconnect --api-test       # 重连后进行API测试

示例:
# 快速延迟检查
python manage.py db_health_check --test-count=3

# 完整性能分析
python manage.py db_health_check --api-test --stats --test-count=5

# 数据库服务器监控
python manage.py db_health_check --monitor
"""

import time
import logging
from django.core.management.base import BaseCommand
from django.db import connection, connections
from django.conf import settings

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """Django管理命令：数据库健康检查"""
    
    help = '检查数据库连接健康状态'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--reconnect',
            action='store_true',
            help='强制重新连接数据库',
        )
        parser.add_argument(
            '--stats',
            action='store_true',
            help='显示连接统计信息',
        )
        parser.add_argument(
            '--db',
            type=str,
            default='default',
            help='指定数据库别名（默认: default）',
        )
        parser.add_argument(
            '--test-count',
            type=int,
            default=5,
            help='延迟测试次数（默认: 5）',
        )
        parser.add_argument(
            '--api-test',
            action='store_true',
            help='测试实际API查询性能',
        )
        parser.add_argument(
            '--monitor',
            action='store_true',
            help='监控数据库服务器性能指标',
        )
    
    def handle(self, *args, **options):
        db_alias = options['db']
        test_count = options['test_count']
        
        self.stdout.write(f"正在测试数据库 '{db_alias}' 连接...")
        
        # 获取数据库连接
        db_connection = connections[db_alias]
        
        if options['reconnect']:
            self.stdout.write("强制重新连接数据库...")
            try:
                db_connection.close()
                db_connection.ensure_connection()
                self.stdout.write(self.style.SUCCESS("✓ 重连成功"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"✗ 重连失败: {e}"))
                return
        
        # 测试数据库延迟
        if options['monitor']:
            self.monitor_database_performance(db_connection)
        elif options['api_test']:
            self.test_api_performance(test_count)
        else:
            self.test_database_latency(db_connection, test_count)
        
        if options['stats']:
            self.show_connection_stats(db_connection)
    
    def test_database_latency(self, db_connection, test_count):
        """测试数据库延迟"""
        self.stdout.write(f"\n开始延迟测试（{test_count} 次）...")
        
        latencies = []
        successful_tests = 0
        connection_times = []
        query_times = []
        
        for i in range(test_count):
            try:
                # 测试连接建立时间
                conn_start = time.time()
                db_connection.ensure_connection()
                conn_end = time.time()
                conn_time = (conn_end - conn_start) * 1000
                connection_times.append(conn_time)
                
                # 测试查询执行时间
                query_start = time.time()
                with db_connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    result = cursor.fetchone()
                query_end = time.time()
                query_time = (query_end - query_start) * 1000
                query_times.append(query_time)
                
                total_time = conn_time + query_time
                latencies.append(total_time)
                successful_tests += 1
                
                self.stdout.write(f"  测试 {i+1}: 总计{total_time:.2f}ms (连接:{conn_time:.2f}ms + 查询:{query_time:.2f}ms) ✓")
                
            except Exception as e:
                self.stdout.write(f"  测试 {i+1}: 失败 - {e}")
        
        # 计算统计信息
        if latencies:
            avg_latency = sum(latencies) / len(latencies)
            min_latency = min(latencies)
            max_latency = max(latencies)
            
            avg_conn_time = sum(connection_times) / len(connection_times)
            avg_query_time = sum(query_times) / len(query_times)
            
            self.stdout.write(f"\n延迟统计:")
            self.stdout.write(f"  成功测试: {successful_tests}/{test_count}")
            self.stdout.write(f"  平均总延迟: {avg_latency:.2f}ms")
            self.stdout.write(f"  平均连接时间: {avg_conn_time:.2f}ms")
            self.stdout.write(f"  平均查询时间: {avg_query_time:.2f}ms")
            self.stdout.write(f"  最小延迟: {min_latency:.2f}ms")
            self.stdout.write(f"  最大延迟: {max_latency:.2f}ms")
            
            # 分析延迟来源
            if avg_conn_time > avg_query_time * 2:
                self.stdout.write(self.style.WARNING("  分析: 连接建立是主要延迟来源"))
            elif avg_query_time > avg_conn_time * 2:
                self.stdout.write(self.style.WARNING("  分析: 查询执行是主要延迟来源"))
            else:
                self.stdout.write("  分析: 连接和查询延迟相当")
            
            # 延迟评估
            if avg_latency < 10:
                self.stdout.write(self.style.SUCCESS("  评估: 延迟很低，连接优秀"))
            elif avg_latency < 50:
                self.stdout.write(self.style.SUCCESS("  评估: 延迟较低，连接良好"))
            elif avg_latency < 200:
                self.stdout.write(self.style.WARNING("  评估: 延迟中等，连接可接受"))
            else:
                self.stdout.write(self.style.ERROR("  评估: 延迟较高，可能影响性能"))
        else:
            self.stdout.write(self.style.ERROR("所有测试都失败了"))
    
    def test_api_performance(self, test_count):
        """测试实际API查询性能"""
        self.stdout.write(f"\n开始API性能测试（{test_count} 次）...")
        
        # 导入必要的模块
        from apps.scan.models import Scan
        from apps.engine.models import ScanEngine
        from apps.targets.models import Target
        from django.db.models import Count
        
        api_latencies = []
        successful_tests = 0
        
        for i in range(test_count):
            try:
                start_time = time.time()
                
                # 测试多种查询类型
                
                # 1. 简单查询 - 引擎列表
                engines = list(ScanEngine.objects.all()[:10])
                
                # 2. 复杂查询 - 扫描列表（即使没有数据也会执行复杂的JOIN）
                scan_queryset = Scan.objects.select_related(
                    'target', 'engine'
                ).annotate(
                    subdomains_count=Count('subdomains', distinct=True),
                    endpoints_count=Count('endpoints', distinct=True),
                    ips_count=Count('ip_addresses', distinct=True)
                ).order_by('-id')[:10]
                scan_list = list(scan_queryset)
                
                # 3. 目标查询
                targets = list(Target.objects.all()[:10])
                
                end_time = time.time()
                latency_ms = (end_time - start_time) * 1000
                api_latencies.append(latency_ms)
                successful_tests += 1
                
                self.stdout.write(f"  API测试 {i+1}: {latency_ms:.2f}ms ✓ (引擎:{len(engines)}, 扫描:{len(scan_list)}, 目标:{len(targets)})")
                
            except Exception as e:
                self.stdout.write(f"  API测试 {i+1}: 失败 - {e}")
        
        # 计算API查询统计信息
        if api_latencies:
            avg_latency = sum(api_latencies) / len(api_latencies)
            min_latency = min(api_latencies)
            max_latency = max(api_latencies)
            
            self.stdout.write(f"\nAPI查询统计:")
            self.stdout.write(f"  成功测试: {successful_tests}/{test_count}")
            self.stdout.write(f"  平均延迟: {avg_latency:.2f}ms")
            self.stdout.write(f"  最小延迟: {min_latency:.2f}ms")
            self.stdout.write(f"  最大延迟: {max_latency:.2f}ms")
            
            # 与简单查询对比
            simple_query_avg = 150  # 基于之前的测试结果
            overhead = avg_latency - simple_query_avg
            self.stdout.write(f"  业务逻辑开销: {overhead:.2f}ms")
            
            # 性能评估
            if avg_latency < 500:
                self.stdout.write(self.style.SUCCESS("  评估: API响应速度良好"))
            elif avg_latency < 1000:
                self.stdout.write(self.style.WARNING("  评估: API响应速度一般"))
            else:
                self.stdout.write(self.style.ERROR("  评估: API响应速度较慢，需要优化"))
        else:
            self.stdout.write(self.style.ERROR("所有API测试都失败了"))
    
    def monitor_database_performance(self, db_connection):
        """监控数据库服务器性能指标"""
        self.stdout.write(f"\n开始监控数据库性能指标...")
        
        try:
            with db_connection.cursor() as cursor:
                # 1. 数据库基本信息
                self.stdout.write(f"\n=== 数据库基本信息 ===")
                cursor.execute("SELECT version();")
                version = cursor.fetchone()[0]
                self.stdout.write(f"PostgreSQL版本: {version}")
                
                cursor.execute("SELECT current_database();")
                db_name = cursor.fetchone()[0]
                self.stdout.write(f"当前数据库: {db_name}")
                
                # 2. 连接信息
                self.stdout.write(f"\n=== 连接状态 ===")
                cursor.execute("""
                    SELECT count(*) as total_connections,
                           count(*) FILTER (WHERE state = 'active') as active_connections,
                           count(*) FILTER (WHERE state = 'idle') as idle_connections
                    FROM pg_stat_activity;
                """)
                conn_stats = cursor.fetchone()
                self.stdout.write(f"总连接数: {conn_stats[0]}")
                self.stdout.write(f"活跃连接: {conn_stats[1]}")
                self.stdout.write(f"空闲连接: {conn_stats[2]}")
                
                # 3. 数据库大小
                self.stdout.write(f"\n=== 数据库大小 ===")
                cursor.execute("""
                    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;
                """)
                db_size = cursor.fetchone()[0]
                self.stdout.write(f"数据库大小: {db_size}")
                
                # 4. 表统计信息
                self.stdout.write(f"\n=== 主要表统计 ===")
                cursor.execute("""
                    SELECT schemaname, relname, 
                           n_tup_ins as inserts,
                           n_tup_upd as updates,
                           n_tup_del as deletes,
                           n_live_tup as live_rows,
                           n_dead_tup as dead_rows
                    FROM pg_stat_user_tables 
                    WHERE schemaname = 'public'
                    ORDER BY n_live_tup DESC
                    LIMIT 10;
                """)
                tables = cursor.fetchall()
                if tables:
                    for table in tables:
                        self.stdout.write(f"  {table[1]}: {table[5]} 行 (插入:{table[2]}, 更新:{table[3]}, 删除:{table[4]}, 死行:{table[6]})")
                else:
                    self.stdout.write("  暂无表统计数据")
                
                # 5. 慢查询统计
                self.stdout.write(f"\n=== 查询性能统计 ===")
                cursor.execute("""
                    SELECT query,
                           calls,
                           total_time,
                           mean_time,
                           rows
                    FROM pg_stat_statements 
                    WHERE query NOT LIKE '%pg_stat_statements%'
                    ORDER BY mean_time DESC 
                    LIMIT 5;
                """)
                try:
                    slow_queries = cursor.fetchall()
                    if slow_queries:
                        for i, query in enumerate(slow_queries, 1):
                            self.stdout.write(f"  {i}. 平均耗时: {query[3]:.2f}ms, 调用次数: {query[1]}")
                            self.stdout.write(f"     查询: {query[0][:100]}...")
                    else:
                        self.stdout.write("  未找到查询统计（可能未启用pg_stat_statements扩展）")
                except Exception:
                    self.stdout.write("  查询统计不可用（需要pg_stat_statements扩展）")
                
                # 6. 锁信息
                self.stdout.write(f"\n=== 锁状态 ===")
                cursor.execute("""
                    SELECT mode, count(*) 
                    FROM pg_locks 
                    GROUP BY mode 
                    ORDER BY count(*) DESC;
                """)
                locks = cursor.fetchall()
                total_locks = sum(lock[1] for lock in locks)
                self.stdout.write(f"总锁数量: {total_locks}")
                for lock in locks:
                    self.stdout.write(f"  {lock[0]}: {lock[1]} 个")
                
                # 7. 缓存命中率
                self.stdout.write(f"\n=== 缓存性能 ===")
                cursor.execute("""
                    SELECT 
                        sum(heap_blks_read) as heap_read,
                        sum(heap_blks_hit) as heap_hit,
                        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
                    FROM pg_statio_user_tables;
                """)
                cache_stats = cursor.fetchone()
                if cache_stats[0] and cache_stats[1]:
                    self.stdout.write(f"缓存命中率: {cache_stats[2]:.2f}%")
                    self.stdout.write(f"磁盘读取: {cache_stats[0]} 块")
                    self.stdout.write(f"缓存命中: {cache_stats[1]} 块")
                else:
                    self.stdout.write("缓存统计: 暂无数据")
                
                # 8. 检查点和WAL
                self.stdout.write(f"\n=== WAL和检查点 ===")
                cursor.execute("""
                    SELECT 
                        checkpoints_timed,
                        checkpoints_req,
                        checkpoint_write_time,
                        checkpoint_sync_time
                    FROM pg_stat_bgwriter;
                """)
                bgwriter = cursor.fetchone()
                self.stdout.write(f"定时检查点: {bgwriter[0]}")
                self.stdout.write(f"请求检查点: {bgwriter[1]}")
                self.stdout.write(f"检查点写入时间: {bgwriter[2]}ms")
                self.stdout.write(f"检查点同步时间: {bgwriter[3]}ms")
                
                # 9. 当前活跃查询
                self.stdout.write(f"\n=== 当前活跃查询 ===")
                cursor.execute("""
                    SELECT pid, 
                           application_name,
                           state,
                           query_start,
                           now() - query_start as duration,
                           left(query, 100) as query_preview
                    FROM pg_stat_activity 
                    WHERE state = 'active' 
                    AND query NOT LIKE '%pg_stat_activity%'
                    ORDER BY query_start;
                """)
                active_queries = cursor.fetchall()
                if active_queries:
                    for query in active_queries:
                        self.stdout.write(f"  PID {query[0]} ({query[1]}): 运行 {query[4]}")
                        self.stdout.write(f"    查询: {query[5]}...")
                else:
                    self.stdout.write("  当前无活跃查询")
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"监控失败: {e}"))
    
    def show_connection_stats(self, db_connection):
        """显示连接统计信息"""
        self.stdout.write(f"\n连接信息:")
        
        # 基本连接信息
        settings_dict = db_connection.settings_dict
        self.stdout.write(f"  数据库类型: {db_connection.vendor}")
        self.stdout.write(f"  主机: {settings_dict.get('HOST', 'localhost')}")
        self.stdout.write(f"  端口: {settings_dict.get('PORT', '5432')}")
        self.stdout.write(f"  数据库名: {settings_dict.get('NAME', '')}")
        self.stdout.write(f"  用户: {settings_dict.get('USER', '')}")
        
        # 连接配置
        conn_max_age = settings_dict.get('CONN_MAX_AGE', 0)
        self.stdout.write(f"  连接最大存活时间: {conn_max_age}秒")
        
        # 查询统计
        if hasattr(db_connection, 'queries'):
            query_count = len(db_connection.queries)
            if query_count > 0:
                total_time = sum(float(q['time']) for q in db_connection.queries)
                self.stdout.write(f"  查询次数: {query_count}")
                self.stdout.write(f"  总查询时间: {total_time:.4f}秒")
        
        # 连接状态
        is_connected = hasattr(db_connection, 'connection') and db_connection.connection is not None
        self.stdout.write(f"  连接状态: {'已连接' if is_connected else '未连接'}")
