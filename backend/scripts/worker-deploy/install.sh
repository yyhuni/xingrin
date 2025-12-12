#!/bin/bash
# ============================================
# XingRin 远程节点安装脚本
# 用途：安装 Docker 环境
# 支持：Ubuntu / Debian
# 
# 新架构说明：
# - 只需安装 Docker
# - agent 通过 docker run 启动
# - 扫描任务由主服务器 SSH docker run 执行
# ============================================

set -e

MARKER_DIR="/opt/xingrin"
DOCKER_MARKER="${MARKER_DIR}/.docker_installed"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[XingRin]${NC} $1"; }
log_success() { echo -e "${GREEN}[XingRin]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[XingRin]${NC} $1"; }
log_error() { echo -e "${RED}[XingRin]${NC} $1"; }

# 等待 apt 锁释放
wait_for_apt_lock() {
    local max_wait=60
    local waited=0
    while sudo fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || \
          sudo fuser /var/lib/dpkg/lock >/dev/null 2>&1 || \
          sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
        if [ $waited -eq 0 ]; then
            log_info "等待 apt 锁释放..."
        fi
        sleep 2
        waited=$((waited + 2))
        if [ $waited -ge $max_wait ]; then
            log_warn "等待 apt 锁超时，继续尝试..."
            break
        fi
    done
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    
    if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
        log_error "仅支持 Ubuntu/Debian 系统"
        exit 1
    fi
}

# 安装 Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker 已安装: $(docker --version)"
        return 0
    fi
    
    log_info "安装 Docker..."
    
    wait_for_apt_lock
    
    # 安装依赖
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release >/dev/null 2>&1
    
    # 添加 Docker GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/${OS}/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    
    # 添加 Docker 源
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS} $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装 Docker
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null 2>&1
    
    # 启动 Docker
    sudo systemctl enable docker >/dev/null 2>&1 || true
    sudo systemctl start docker >/dev/null 2>&1 || true
    
    # 添加当前用户到 docker 组
    sudo usermod -aG docker $USER 2>/dev/null || true
    
    log_success "Docker 安装完成"
}

# 创建数据目录
create_dirs() {
    log_info "创建数据目录..."
    sudo mkdir -p "${MARKER_DIR}/results"
    sudo mkdir -p "${MARKER_DIR}/logs"
    sudo chmod -R 755 "${MARKER_DIR}"
    log_success "数据目录已创建"
}

# 清理旧容器
cleanup_old_containers() {
    log_info "清理旧容器..."
    
    # 停止并删除旧的 agent 容器
    docker stop xingrin-agent 2>/dev/null || true
    docker rm xingrin-agent 2>/dev/null || true
    
    # 兼容旧名称
    docker stop xingrin-watchdog 2>/dev/null || true
    docker rm xingrin-watchdog 2>/dev/null || true
    
    log_success "旧容器已清理"
}

# 拉取镜像
pull_image() {
    log_info "拉取 Worker 镜像..."
    sudo docker pull yyhuni/xingrin-worker:latest
    log_success "镜像拉取完成"
}

# 主流程
main() {
    log_info "=========================================="
    log_info "  XingRin 节点安装"
    log_info "=========================================="
    
    detect_os
    install_docker
    cleanup_old_containers
    create_dirs
    pull_image
    
    touch "$DOCKER_MARKER"
    
    log_success "=========================================="
    log_success "  ✓ 安装完成"
    log_success "=========================================="
}

main "$@"
