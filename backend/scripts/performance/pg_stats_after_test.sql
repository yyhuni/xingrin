-- 测试后记录对比数据
-- 用法：psql -d xingrin -f pg_stats_after_test.sql > stats_after.txt

\echo '========================================'
\echo '  PostgreSQL 测试后统计数据'
\echo '========================================'
\echo ''

\echo '当前时间:'
SELECT now();

\echo ''
\echo '表记录数（测试后）:'
SELECT 
    schemaname || '.' || relname as table_name,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname IN ('subdomain', 'ip_address', 'port', 'website', 'endpoint', 'directory', 'scan')
ORDER BY n_live_tup DESC;

\echo ''
\echo '表膨胀检查:'
SELECT 
    schemaname || '.' || relname as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    CASE 
        WHEN n_live_tup = 0 THEN 0
        ELSE round((n_dead_tup::numeric / n_live_tup) * 100, 2)
    END as dead_ratio_percent
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname IN ('subdomain', 'ip_address', 'port', 'website', 'endpoint', 'directory')
ORDER BY n_dead_tup DESC;

\echo ''
\echo '索引使用情况:'
SELECT 
    schemaname || '.' || relname as table_name,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as rows_read,
    idx_tup_fetch as rows_fetched,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
  AND relname IN ('subdomain', 'ip_address', 'port', 'website', 'endpoint', 'directory')
ORDER BY idx_scan DESC;

\echo ''
\echo '表统计增量（本次测试产生）:'
SELECT 
    schemaname || '.' || relname as table_name,
    n_tup_ins as total_inserts,
    n_tup_upd as total_updates,
    n_tup_del as total_deletes,
    n_tup_hot_upd as hot_updates
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname IN ('subdomain', 'ip_address', 'port', 'website', 'endpoint', 'directory')
ORDER BY n_tup_ins DESC;

\echo ''
\echo '缓存命中率（测试后）:'
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
\echo 'IO 统计:'
SELECT 
    sum(heap_blks_read) as heap_blocks_read_from_disk,
    sum(heap_blks_hit) as heap_blocks_hit_in_cache,
    sum(idx_blks_read) as index_blocks_read_from_disk,
    sum(idx_blks_hit) as index_blocks_hit_in_cache
FROM pg_statio_user_tables
WHERE schemaname = 'public';

\echo ''
\echo '长时间运行查询:'
SELECT 
    pid,
    usename,
    application_name,
    state,
    EXTRACT(EPOCH FROM (now() - query_start))::int as duration_seconds,
    query
FROM pg_stat_activity 
WHERE datname = current_database()
  AND state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;

\echo ''
\echo '数据库总大小:'
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as database_size;

\echo ''
\echo '========================================'
