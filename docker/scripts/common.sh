#!/bin/bash
# 公共函数库 - 被其他脚本 source 引用

# ==================== 颜色定义 ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ==================== 日志函数 ====================
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==================== Docker 环境检查 ====================
check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        log_error "未检测到 docker 命令，请先安装 Docker。"
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        log_error "Docker 守护进程未运行，请先启动 Docker。"
        exit 1
    fi
}

# ==================== Docker Compose 命令检测 ====================
detect_compose_cmd() {
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        log_error "未检测到 docker-compose 或 docker compose。"
        exit 1
    fi
    export COMPOSE_CMD
}

# ==================== 环境变量文件检查 ====================
check_env_file() {
    if [ ! -f .env ]; then
        log_error "未找到 .env 配置文件。"
        echo "   请先根据 .env.example 创建 .env 文件。"
        exit 1
    fi
}

# ==================== 数据库配置检测 ====================
detect_db_profile() {
    DB_HOST=$(grep -E "^DB_HOST=" .env | cut -d'=' -f2 | tr -d ' "'"'" || echo "postgres")
    
    if [[ "$DB_HOST" == "postgres" || "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ]]; then
        echo "[DB] 使用本地 PostgreSQL 容器"
        PROFILE_ARG="--profile local-db"
    else
        echo "[DB] 使用远程 PostgreSQL: $DB_HOST"
        PROFILE_ARG=""
    fi
    export PROFILE_ARG
}


# ==================== 获取 docker 目录路径 ====================
get_docker_dir() {
    # common.sh 位于 docker/scripts/，所以 docker 目录是上一级
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "$(dirname "$script_dir")"
}

# ==================== 初始化检查（一次性调用） ====================
init_docker_env() {
    DOCKER_DIR="$(get_docker_dir)"
    cd "$DOCKER_DIR"
    check_docker
    detect_compose_cmd
    export DOCKER_DIR
}

init_docker_env_with_env_check() {
    init_docker_env
    check_env_file
}
