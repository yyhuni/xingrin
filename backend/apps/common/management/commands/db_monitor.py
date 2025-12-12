"""
简化的数据库性能监控命令

专注于可能导致查询延迟的关键指标
"""

import time
from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    """简化的数据库性能监控"""
    
    help = '监控数据库性能关键指标'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=5,
            help='监控间隔（秒，默认: 5）',
        )
        parser.add_argument(
            '--count',
            type=int,
            default=3,
            help='监控次数（默认: 3）',
        )
    
    def handle(self, *args, **options):
        interval = options['interval']
        count = options['count']
        
        self.stdout.write("🔍 数据库性能监控开始...")
        
        for i in range(count):
            if i > 0:
                time.sleep(interval)
            
            self.stdout.write(f"\n=== 第 {i+1} 次监控 ===")
            self.monitor_key_metrics()
    
    def monitor_key_metrics(self):
        """监控关键性能指标"""
        db_connection = connections['default']
        
        try:
            with db_connection.cursor() as cursor:
                # 1. 连接和活动状态
                cursor.execute("""
                    SELECT 
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active,
                        count(*) FILTER (WHERE state = 'idle') as idle,
                        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_trans,
                        count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
                    FROM pg_stat_activity;
                """)
                conn_stats = cursor.fetchone()
                self.stdout.write(f"连接: 总计{conn_stats[0]} | 活跃{conn_stats[1]} | 空闲{conn_stats[2]} | 事务中{conn_stats[3]} | 等待{conn_stats[4]}")
                
                # 2. 锁等待情况
                cursor.execute("""
                    SELECT 
                        count(*) as total_locks,
                        count(*) FILTER (WHERE NOT granted) as waiting_locks
                    FROM pg_locks;
                """)
                lock_stats = cursor.fetchone()
                if lock_stats[1] > 0:
                    self.stdout.write(self.style.WARNING(f"🔒 锁: 总计{lock_stats[0]} | 等待{lock_stats[1]}"))
                else:
                    self.stdout.write(f"🔒 锁: 总计{lock_stats[0]} | 等待{lock_stats[1]}")
                
                # 3. 长时间运行的查询
                cursor.execute("""
                    SELECT 
                        pid,
                        application_name,
                        now() - query_start as duration,
                        state,
                        left(query, 60) as query_preview
                    FROM pg_stat_activity 
                    WHERE state = 'active' 
                    AND query_start < now() - interval '1 second'
                    AND query NOT LIKE '%pg_stat_activity%'
                    ORDER BY query_start;
                """)
                long_queries = cursor.fetchall()
                if long_queries:
                    self.stdout.write(self.style.WARNING(f"⏱️  长查询 ({len(long_queries)} 个):"))
                    for query in long_queries:
                        self.stdout.write(f"   PID {query[0]} ({query[1]}): {query[2]} - {query[4]}...")
                else:
                    self.stdout.write("⏱️  长查询: 无")
                
                # 4. 缓存命中率
                cursor.execute("""
                    SELECT 
                        sum(heap_blks_hit) as cache_hits,
                        sum(heap_blks_read) as disk_reads,
                        CASE 
                            WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0 THEN 0
                            ELSE round(sum(heap_blks_hit) * 100.0 / (sum(heap_blks_hit) + sum(heap_blks_read)), 2)
                        END as hit_ratio
                    FROM pg_statio_user_tables;
                """)
                cache_stats = cursor.fetchone()
                if cache_stats[0] or cache_stats[1]:
                    hit_ratio = cache_stats[2] or 0
                    if hit_ratio < 95:
                        self.stdout.write(self.style.WARNING(f"💾 缓存命中率: {hit_ratio}% (缓存:{cache_stats[0]}, 磁盘:{cache_stats[1]})"))
                    else:
                        self.stdout.write(f"💾 缓存命中率: {hit_ratio}% (缓存:{cache_stats[0]}, 磁盘:{cache_stats[1]})")
                else:
                    self.stdout.write("💾 缓存: 暂无统计数据")
                
                # 5. 检查点活动（尝试获取，如果失败则跳过）
                try:
                    cursor.execute("SELECT * FROM pg_stat_bgwriter LIMIT 1;")
                    bgwriter_cols = [desc[0] for desc in cursor.description]
                    
                    if 'checkpoints_timed' in bgwriter_cols:
                        cursor.execute("""
                            SELECT 
                                checkpoints_timed,
                                checkpoints_req,
                                checkpoint_write_time,
                                checkpoint_sync_time
                            FROM pg_stat_bgwriter;
                        """)
                        bgwriter = cursor.fetchone()
                        total_checkpoints = bgwriter[0] + bgwriter[1]
                        if bgwriter[2] > 10000 or bgwriter[3] > 5000:
                            self.stdout.write(self.style.WARNING(f"📝 检查点: 总计{total_checkpoints} | 写入{bgwriter[2]}ms | 同步{bgwriter[3]}ms"))
                        else:
                            self.stdout.write(f"📝 检查点: 总计{total_checkpoints} | 写入{bgwriter[2]}ms | 同步{bgwriter[3]}ms")
                    else:
                        self.stdout.write("📝 检查点: 统计不可用")
                except Exception:
                    self.stdout.write("📝 检查点: 统计不可用")
                
                # 6. 数据库大小变化
                cursor.execute("SELECT pg_database_size(current_database());")
                db_size = cursor.fetchone()[0]
                db_size_mb = round(db_size / 1024 / 1024, 2)
                self.stdout.write(f"💿 数据库大小: {db_size_mb} MB")
                
                # 7. 测试查询延迟
                start_time = time.time()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                query_latency = (time.time() - start_time) * 1000
                
                if query_latency > 500:
                    self.stdout.write(self.style.ERROR(f"⚡ 查询延迟: {query_latency:.2f}ms (高)"))
                elif query_latency > 200:
                    self.stdout.write(self.style.WARNING(f"⚡ 查询延迟: {query_latency:.2f}ms (中)"))
                else:
                    self.stdout.write(f"⚡ 查询延迟: {query_latency:.2f}ms (正常)")
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"监控失败: {e}"))
