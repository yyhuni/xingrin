#!/bin/bash
# ============================================
# XingRin 远程节点卸载脚本
# 用途：停止 agent 容器并清理环境
# 支持：Ubuntu / Debian
# ============================================

set -e

MARKER_DIR="/opt/xingrin"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[XingRin]${NC} $1"; }
log_success() { echo -e "${GREEN}[XingRin]${NC} $1"; }

# 停止 agent 容器
stop_agent() {
    log_info "停止 agent 容器..."
    
    # 停止新名称容器
    docker stop xingrin-agent 2>/dev/null || true
    docker rm xingrin-agent 2>/dev/null || true
    
    # 兼容旧名称
    docker stop xingrin-watchdog 2>/dev/null || true
    docker rm xingrin-watchdog 2>/dev/null || true
    
    log_success "Agent 已停止"
}

# 清理数据目录
cleanup_data() {
    log_info "清理数据目录..."
    
    if [ -d "${MARKER_DIR}" ]; then
        sudo rm -rf "${MARKER_DIR}"
        log_success "数据目录已清理"
    fi
}

# 显示完成信息
show_completion() {
    echo ""
    log_success "=========================================="
    log_success "  ✓ 卸载完成"
    log_success "=========================================="
    echo ""
    log_info "注意：Docker 未卸载，如需卸载请手动执行"
}

# 主流程
main() {
    log_info "=========================================="
    log_info "  XingRin 节点卸载"
    log_info "=========================================="
    
    stop_agent
    cleanup_data
    show_completion
}

main "$@"
