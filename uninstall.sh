#!/bin/bash
set -e

# ==============================================================================
# 颜色定义
# ==============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ==============================================================================
# 日志函数
# ==============================================================================
info() {
    echo -e "${BLUE}[INFO]${RESET} $1"
}

success() {
    echo -e "${GREEN}[OK]${RESET} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${RESET} $1"
}

error() {
    echo -e "${RED}[ERROR]${RESET} $1"
}

step() {
    echo -e "\n${BOLD}${CYAN}>>> $1${RESET}"
}

header() {
    echo -e "${BOLD}${BLUE}============================================================${RESET}"
    echo -e "${BOLD}${BLUE}   $1${RESET}"
    echo -e "${BOLD}${BLUE}============================================================${RESET}"
}

# ==============================================================================
# 权限检查
# ==============================================================================
if [ "$EUID" -ne 0 ]; then
    error "请使用 sudo 运行此脚本"
    echo -e "   正确用法: ${BOLD}sudo ./uninstall.sh${RESET}"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

header "XingRin 一键卸载脚本 (Ubuntu)"
info "项目路径: ${BOLD}$ROOT_DIR${RESET}"

if [ ! -d "$DOCKER_DIR" ]; then
    error "未找到 docker 目录，请确认项目结构。"
    exit 1
fi

# ==============================================================================
# 1. 停止并删除全部容器/网络
# ==============================================================================
step "[1/6] 是否停止并删除全部容器/网络？(Y/n)"
read -r ans_stop
ans_stop=${ans_stop:-Y}

if [[ $ans_stop =~ ^[Yy]$ ]]; then
    info "正在停止并删除容器/网络..."
    cd "$DOCKER_DIR"
    if command -v docker compose >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    # 先强制停止并删除可能占用网络的容器（xingrin-agent 等）
    docker rm -f xingrin-agent xingrin-watchdog 2>/dev/null || true
    
    # 停止两种模式的容器
    [ -f "docker-compose.yml" ] && ${COMPOSE_CMD} -f docker-compose.yml down 2>/dev/null || true
    [ -f "docker-compose.dev.yml" ] && ${COMPOSE_CMD} -f docker-compose.dev.yml down 2>/dev/null || true
    
    # 手动删除网络（以防 compose 未能删除）
    docker network rm xingrin_network 2>/dev/null || true
    
    success "容器和网络已停止/删除（如存在）。"
else
    warn "已跳过停止/删除容器/网络。"
fi

# ==============================================================================
# 2. 删除扫描日志和结果目录
# ==============================================================================
LOGS_DIR="$ROOT_DIR/backend/logs"
RESULTS_DIR="$ROOT_DIR/backend/results"

step "[2/6] 是否删除扫描日志和结果目录 ($LOGS_DIR, $RESULTS_DIR)？(Y/n)"
read -r ans_logs
ans_logs=${ans_logs:-Y}

if [[ $ans_logs =~ ^[Yy]$ ]]; then
    info "正在删除日志和结果目录..."
    rm -rf "$LOGS_DIR" "$RESULTS_DIR"
    success "已删除日志和结果目录。"
else
    warn "已保留日志和结果目录。"
fi

# ==============================================================================
# 3. 删除 /opt/xingrin/tools 和 /opt/xingrin/wordlists
# ==============================================================================
TOOLS_DIR="/opt/xingrin/tools"
WORDLISTS_DIR="/opt/xingrin/wordlists"

step "[3/6] 是否删除工具目录和字典目录 ($TOOLS_DIR, $WORDLISTS_DIR)？(Y/n)"
read -r ans_tools
ans_tools=${ans_tools:-Y}

if [[ $ans_tools =~ ^[Yy]$ ]]; then
    info "正在删除工具和字典目录..."
    rm -rf "$TOOLS_DIR" "$WORDLISTS_DIR"
    success "已删除 /opt/xingrin/tools 和 /opt/xingrin/wordlists。"
else
    warn "已保留 /opt/xingrin/tools 和 /opt/xingrin/wordlists。"
fi

# ==============================================================================
# 4. 删除 docker/.env 配置文件
# ==============================================================================
ENV_FILE="$DOCKER_DIR/.env"

step "[4/6] 是否删除配置文件 ($ENV_FILE)？(Y/n)"
echo -e "   ${YELLOW}注意：删除后下次安装将生成新的随机密码。${RESET}"
read -r ans_env
ans_env=${ans_env:-Y}

if [[ $ans_env =~ ^[Yy]$ ]]; then
    info "正在删除配置文件..."
    rm -f "$ENV_FILE"
    success "已删除 $ENV_FILE。"
else
    warn "已保留 $ENV_FILE。"
fi

# ==============================================================================
# 5. 删除本地 Postgres 容器及数据卷（如果使用本地 DB）
# ==============================================================================
step "[5/6] 若使用本地 PostgreSQL 容器：是否删除数据库容器和 volume？(Y/n)"
read -r ans_db
ans_db=${ans_db:-Y}

if [[ $ans_db =~ ^[Yy]$ ]]; then
    info "尝试删除与 XingRin 相关的 Postgres 容器和数据卷..."
    # docker-compose 项目名为 docker，常见资源名如下（忽略不存在的情况）：
    # - 容器: docker-postgres-1
    # - 数据卷: docker_postgres_data（对应 compose 中的 postgres_data 卷）
    docker rm -f docker-postgres-1 2>/dev/null || true
    docker volume rm docker_postgres_data 2>/dev/null || true
    success "本地 Postgres 容器及数据卷已尝试删除（不存在会自动忽略）。"
else
    warn "已保留本地 Postgres 容器和 volume。"
fi

step "[6/6] 是否删除与 XingRin 相关的 Docker 镜像？(y/N)"
read -r ans_images
ans_images=${ans_images:-N}

if [[ $ans_images =~ ^[Yy]$ ]]; then
    info "正在删除 Docker 镜像..."
    # 直接删除相关镜像，避免 compose 警告
    docker rmi yyhuni/xingrin-server:latest 2>/dev/null || true
    docker rmi yyhuni/xingrin-frontend:latest 2>/dev/null || true
    docker rmi yyhuni/xingrin-nginx:latest 2>/dev/null || true
    docker rmi yyhuni/xingrin-agent:latest 2>/dev/null || true
    docker rmi yyhuni/xingrin-worker:latest 2>/dev/null || true
    docker rmi redis:7-alpine 2>/dev/null || true
    success "Docker 镜像已删除（如存在）。"
else
    warn "已保留 Docker 镜像。"
fi

success "卸载流程已完成。"
