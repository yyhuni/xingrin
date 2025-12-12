#!/bin/bash
# ============================================
# XingRin Agent
# 用途：心跳上报 + 负载监控
# 适用：远程 VPS 或 Docker 容器内
# ============================================

# 检查是否禁用 Agent
if [ "${AGENT_DISABLED:-false}" = "true" ]; then
    echo "[AGENT] 已禁用，跳过启动"
    exit 0
fi

# 配置
MARKER_DIR="/opt/xingrin"
SRC_DIR="${MARKER_DIR}/src"
ENV_FILE="${SRC_DIR}/backend/.env"
INTERVAL=${AGENT_INTERVAL:-3}

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] [AGENT] $1"
}

# 检测运行模式：容器内 or 远程 VPS
# 如果 /.dockerenv 存在，说明在容器内
if [ -f "/.dockerenv" ]; then
    RUN_MODE="container"
    log "运行模式: Docker 容器内"
else
    RUN_MODE="remote"
    log "运行模式: 远程 VPS"
    
    # 远程模式：检测 Docker 命令
    if docker info >/dev/null 2>&1; then
        DOCKER_CMD="docker"
    else
        DOCKER_CMD="sudo docker"
    fi
fi

# 加载环境变量（远程模式从文件，容器模式从环境变量）
if [ "$RUN_MODE" = "remote" ] && [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# 获取配置
# SERVER_URL: 后端 API 地址（容器内用 http://server:8888，远程用公网地址）
API_URL="${HEARTBEAT_API_URL:-${SERVER_URL:-}}"
WORKER_NAME="${WORKER_NAME:-}"
IS_LOCAL="${IS_LOCAL:-false}"

# 容器模式默认标记为本地节点
if [ "$RUN_MODE" = "container" ]; then
    IS_LOCAL="true"
fi

log "${GREEN}Agent 启动...${NC}"
log "心跳间隔: ${INTERVAL}s"

if [ -z "$API_URL" ]; then
    log "${RED}错误: 未配置 API 地址 (HEARTBEAT_API_URL 或 SERVER_URL)${NC}"
    exit 1
fi

log "API 地址: ${API_URL}"

# ============================================
# 自注册功能（如果 WORKER_ID 未设置）
# ============================================
register_worker() {
    if [ -z "$WORKER_NAME" ]; then
        WORKER_NAME="Worker-$(hostname)"
    fi
    
    log "注册 Worker: ${WORKER_NAME}..."
    
    REGISTER_DATA=$(cat <<EOF
{
    "name": "$WORKER_NAME",
    "is_local": $IS_LOCAL
}
EOF
)
    
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$REGISTER_DATA" \
        "${API_URL}/api/workers/register/" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # 解析返回的 workerId（API 使用 camelCase）
        WORKER_ID=$(echo "$RESPONSE" | grep -oE '"workerId":\s*[0-9]+' | grep -oE '[0-9]+')
        if [ -n "$WORKER_ID" ]; then
            log "${GREEN}注册成功: ${WORKER_NAME} (ID: ${WORKER_ID})${NC}"
            return 0
        fi
    fi
    
    log "${RED}注册失败: ${RESPONSE}${NC}"
    return 1
}

# 如果没有 WORKER_ID，执行自注册
if [ -z "$WORKER_ID" ]; then
    # 等待 Server 就绪
    log "等待 Server 就绪..."
    for i in $(seq 1 30); do
        if curl -s "${API_URL}/api/" > /dev/null 2>&1; then
            log "${GREEN}Server 已就绪${NC}"
            break
        fi
        log "Server 未就绪，等待... ($i/30)"
        sleep 5
    done
    
    # 注册
    while ! register_worker; do
        log "${YELLOW}注册失败，5 秒后重试...${NC}"
        sleep 5
    done
fi

log "Worker ID: ${WORKER_ID}"

# ============================================
# 心跳循环
# Agent 独立运行，始终发送心跳
# 主服务器根据心跳数据选择负载最低的节点分发任务
# ============================================
while true; do
    # 收集系统负载（CPU + 内存）
    # 容器内使用挂载的 /host/proc 获取宿主机数据
    if [ -d "/host/proc" ]; then
        PROC_DIR="/host/proc"
    else
        PROC_DIR="/proc"
    fi
    
    # CPU 使用率（百分比数值）
    # /proc/stat 是累计值，需要两次采样计算差值
    CPU_STAT1=$(grep 'cpu ' ${PROC_DIR}/stat | awk '{print $2,$3,$4,$5,$6,$7,$8}')
    sleep 0.5
    CPU_STAT2=$(grep 'cpu ' ${PROC_DIR}/stat | awk '{print $2,$3,$4,$5,$6,$7,$8}')
    CPU_PERCENT=$(echo "$CPU_STAT1 $CPU_STAT2" | awk '{
        user1=$1; nice1=$2; sys1=$3; idle1=$4; iowait1=$5; irq1=$6; softirq1=$7;
        user2=$8; nice2=$9; sys2=$10; idle2=$11; iowait2=$12; irq2=$13; softirq2=$14;
        total1=user1+nice1+sys1+idle1+iowait1+irq1+softirq1;
        total2=user2+nice2+sys2+idle2+iowait2+irq2+softirq2;
        idle_diff=idle2-idle1;
        total_diff=total2-total1;
        if(total_diff>0) printf "%.1f", (1-idle_diff/total_diff)*100;
        else printf "0.0";
    }')
    
    # 内存使用率（百分比数值）
    if [ -d "/host/proc" ]; then
        # 从 /host/proc/meminfo 读取
        MEM_TOTAL=$(grep 'MemTotal' ${PROC_DIR}/meminfo | awk '{print $2}')
        MEM_AVAILABLE=$(grep 'MemAvailable' ${PROC_DIR}/meminfo | awk '{print $2}')
        MEM_PERCENT=$(awk "BEGIN {printf \"%.1f\", 100 - ($MEM_AVAILABLE / $MEM_TOTAL * 100)}")
    else
        # 使用 free 命令
        MEM_PERCENT=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100}')
    fi

    # 构建 JSON 数据（使用数值而非字符串，便于比较和排序）
    JSON_DATA=$(cat <<EOF
{
    "cpu_percent": $CPU_PERCENT,
    "memory_percent": $MEM_PERCENT
}
EOF
)
    
    # 发送心跳
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$JSON_DATA" \
        "${API_URL}/api/workers/${WORKER_ID}/heartbeat/" 2>/dev/null || echo "000")
        
    if [ "$RESPONSE" != "200" ] && [ "$RESPONSE" != "201" ]; then
        log "${YELLOW}心跳发送失败 (HTTP $RESPONSE)${NC}"
    fi

    # 休眠
    sleep $INTERVAL
done
