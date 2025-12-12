-- 测试前记录基准数据
-- 用法：psql -d xingrin -f pg_stats_before_test.sql > stats_before.txt

\echo '========================================'
\echo '  PostgreSQL 测试前基准数据'
\echo '========================================'
\echo ''

\echo '当前时间:'
SELECT now();

\echo ''
\echo '数据库连接配置:'
SHOW max_connections;
SHOW shared_buffers;
SHOW work_mem;
SHOW maintenance_work_mem;

\echo ''
\echo '表记录数（测试前）:'
SELECT 
    schemaname || '.' || relname as table_name,
    n_live_tup as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname IN ('subdomain', 'ip_address', 'port', 'website', 'endpoint', 'directory', 'scan')
ORDER BY n_live_tup DESC;

\echo ''
\echo '索引信息:'
SELECT 
    schemaname || '.' || tablename as table_name,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('subdomain', 'ip_address', 'port', 'website', 'endpoint', 'directory')
ORDER BY tablename, indexname;

\echo ''
\echo '当前活跃连接数:'
SELECT 
    count(*) as total,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity 
WHERE datname = current_database();

\echo ''
\echo '表统计信息（累计）:'
SELECT 
    schemaname || '.' || relname as table_name,
    seq_scan as sequential_scans,
    seq_tup_read as seq_rows_read,
    idx_scan as index_scans,
    idx_tup_fetch as idx_rows_fetched,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname IN ('subdomain', 'ip_address', 'port', 'website', 'endpoint', 'directory')
ORDER BY relname;

\echo ''
\echo '缓存命中率:'
SELECT 
    sum(heap_blks_hit) as heap_blocks_hit,
    sum(heap_blks_read) as heap_blocks_read,
    CASE 
        WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0 THEN 0
        ELSE round((sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read))) * 100, 2)
    END as cache_hit_ratio_percent
FROM pg_statio_user_tables
WHERE schemaname = 'public';

\echo ''
\echo '========================================'
