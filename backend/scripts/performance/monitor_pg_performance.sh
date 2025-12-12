#!/bin/bash

# PostgreSQL 性能监控脚本
# 用法：./monitor_pg_performance.sh [数据库名] [间隔秒数]

# 尝试从 .env 加载数据库配置
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_DIR/.env" ]; then
    export PGHOST=$(grep "^DB_HOST=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    export PGPORT=$(grep "^DB_PORT=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    export PGUSER=$(grep "^DB_USER=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    export PGPASSWORD=$(grep "^DB_PASSWORD=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    PGDATABASE=$(grep "^DB_NAME=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
fi

DB_NAME=${1:-${PGDATABASE:-xingrin}}
INTERVAL=${2:-2}

echo "========================================"
echo "  PostgreSQL 性能监控"
echo "========================================"
echo "数据库: $DB_NAME"
echo "刷新间隔: ${INTERVAL}秒"
echo "按 Ctrl+C 停止监控"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

while true; do
    clear
    echo -e "${BLUE}========================================"
    echo "  PostgreSQL 实时性能监控"
    echo "========================================${NC}"
    echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # 1. 数据库连接数
    echo -e "${GREEN}[1] 连接数统计${NC}"
    psql -d $DB_NAME -c "
        SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active,
            count(*) FILTER (WHERE state = 'idle') as idle,
            count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = '$DB_NAME';
    " -t
    
    # 2. 当前活跃查询
    echo -e "${GREEN}[2] 活跃查询 (Top 5)${NC}"
    psql -d $DB_NAME -c "
        SELECT 
            pid,
            usename,
            application_name,
            state,
            EXTRACT(EPOCH FROM (now() - query_start))::int as duration_sec,
            LEFT(query, 60) as query_preview
        FROM pg_stat_activity 
        WHERE datname = '$DB_NAME' 
          AND state != 'idle'
          AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY query_start 
        LIMIT 5;
    "
    
    # 3. 表级统计（插入速度）
    echo -e "${GREEN}[3] 表插入统计${NC}"
    psql -d $DB_NAME -c "
        SELECT 
            schemaname || '.' || relname as table_name,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            n_live_tup as live_rows
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
          AND relname IN ('subdomain', 'ip_address', 'port', 'website', 'endpoint', 'directory')
        ORDER BY n_tup_ins DESC;
    "
    
    # 4. 锁等待
    echo -e "${GREEN}[4] 锁等待情况${NC}"
    psql -d $DB_NAME -c "
        SELECT 
            COUNT(*) as waiting_queries
        FROM pg_stat_activity 
        WHERE wait_event_type = 'Lock' 
          AND datname = '$DB_NAME';
    " -t
    
    # 5. 数据库大小
    echo -e "${GREEN}[5] 数据库大小${NC}"
    psql -d $DB_NAME -c "
        SELECT 
            pg_size_pretty(pg_database_size('$DB_NAME')) as database_size;
    " -t
    
    # 6. 缓存命中率
    echo -e "${GREEN}[6] 缓存命中率${NC}"
    psql -d $DB_NAME -c "
        SELECT 
            sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 as cache_hit_ratio
        FROM pg_statio_user_tables;
    " -t
    
    # 7. IO 统计
    echo -e "${GREEN}[7] 磁盘 IO 统计${NC}"
    psql -d $DB_NAME -c "
        SELECT 
            sum(heap_blks_read) as blocks_read,
            sum(heap_blks_hit) as blocks_hit,
            sum(idx_blks_read) as idx_blocks_read,
            sum(idx_blks_hit) as idx_blocks_hit
        FROM pg_statio_user_tables;
    " -t
    
    # 8. 长时间运行的事务
    echo -e "${YELLOW}[8] 长时间运行事务 (>30秒)${NC}"
    psql -d $DB_NAME -c "
        SELECT 
            pid,
            usename,
            EXTRACT(EPOCH FROM (now() - xact_start))::int as transaction_duration_sec,
            state,
            LEFT(query, 50) as query_preview
        FROM pg_stat_activity 
        WHERE datname = '$DB_NAME' 
          AND state != 'idle'
          AND xact_start IS NOT NULL
          AND EXTRACT(EPOCH FROM (now() - xact_start)) > 30
        ORDER BY xact_start;
    "
    
    echo ""
    echo -e "${BLUE}下次刷新: ${INTERVAL}秒后...${NC}"
    sleep $INTERVAL
done
