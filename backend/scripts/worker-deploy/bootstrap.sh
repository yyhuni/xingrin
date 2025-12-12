#!/bin/bash
# ============================================
# XingRin 环境初始化脚本 (通用)
# 用途：安装基础依赖（git, tmux, curl 等）
# 支持：Ubuntu / Debian
# 适用：主机 & Worker VPS
# 特点：幂等执行，重复运行不会重复安装
# ============================================

set -e

# 版本标记（修改此版本号会触发重新安装）
BOOTSTRAP_VERSION="v1"
MARKER_DIR="/opt/xingrin"
MARKER_FILE="${MARKER_DIR}/.bootstrap_done_${BOOTSTRAP_VERSION}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[XingRin]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[XingRin]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[XingRin]${NC} $1"
}

log_error() {
    echo -e "${RED}[XingRin]${NC} $1"
}

# 等待 apt 锁释放（最多等待 60 秒）
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

# 检查是否已完成初始化（返回 0 表示已完成，返回 1 表示需要初始化）
check_already_done() {
    if [ -f "$MARKER_FILE" ]; then
        log_success "环境已初始化 (${BOOTSTRAP_VERSION})，跳过"
        return 0  # 不要 exit，让后续脚本继续执行
    fi
    return 1
}

# 检查操作系统
check_os() {
    if ! command -v apt-get &> /dev/null; then
        log_error "仅支持 Ubuntu/Debian 系统"
        exit 1
    fi
    log_info "检测到 Ubuntu/Debian 系统"
}

# 安装基础依赖
install_dependencies() {
    log_info "安装基础依赖..."
    
    # 等待 apt 锁释放
    wait_for_apt_lock
    
    # 更新包索引
    sudo apt-get update -qq 2>/dev/null || true
    
    # 安装 git（必须）
    if ! command -v git &> /dev/null; then
        log_info "  - 安装 git..."
        sudo apt-get install -y -qq git >/dev/null 2>&1
    else
        log_info "  - git 已安装"
    fi
    
    # 安装 tmux（会话持久化）
    if ! command -v tmux &> /dev/null; then
        log_info "  - 安装 tmux..."
        sudo apt-get install -y -qq tmux >/dev/null 2>&1
    else
        log_info "  - tmux 已安装"
    fi
    
    # 安装 curl（网络请求）
    if ! command -v curl &> /dev/null; then
        log_info "  - 安装 curl..."
        sudo apt-get install -y -qq curl >/dev/null 2>&1
    else
        log_info "  - curl 已安装"
    fi
    
    # 安装 jq（JSON 处理，可选）
    if ! command -v jq &> /dev/null; then
        log_info "  - 安装 jq..."
        sudo apt-get install -y -qq jq >/dev/null 2>&1
    else
        log_info "  - jq 已安装"
    fi
}

# 创建工作目录
create_directories() {
    log_info "创建工作目录..."
    sudo mkdir -p "$MARKER_DIR"
    sudo mkdir -p "${MARKER_DIR}/logs"
    sudo mkdir -p "${MARKER_DIR}/data"
    sudo chmod 755 "$MARKER_DIR"
    sudo chown -R $USER:$USER "$MARKER_DIR"
}

# 写入完成标记
write_marker() {
    echo "Bootstrap completed at $(date)" | sudo tee "$MARKER_FILE" > /dev/null
    log_success "环境初始化完成"
}

# 主流程
main() {
    log_info "=========================================="
    log_info "  XingRin 环境初始化"
    log_info "=========================================="
    
    # 检查是否已初始化，如果已初始化则跳过初始化步骤（但不退出，让后续部署脚本继续执行）
    if check_already_done; then
        return 0  # 跳过初始化，继续执行后续脚本（Docker 部署、启动容器等）
    fi
    
    check_os
    create_directories
    install_dependencies
    write_marker
    
    log_info "=========================================="
    log_success "  ✓ 初始化完成"
    log_info "=========================================="
}

main "$@"
