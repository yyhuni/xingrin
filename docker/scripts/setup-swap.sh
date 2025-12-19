#!/bin/bash
#
# Ubuntu/Debian 一键开启交换分区脚本
# 用法: sudo ./setup-swap.sh [大小GB]
# 示例: sudo ./setup-swap.sh 4  # 创建 4GB 交换分区
#       sudo ./setup-swap.sh     # 默认创建与内存相同大小的交换分区
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    log_error "请使用 sudo 运行此脚本"
    exit 1
fi

# 检查是否已有交换分区
CURRENT_SWAP_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
CURRENT_SWAP_GB=$((CURRENT_SWAP_KB / 1024 / 1024))
if [ "$CURRENT_SWAP_GB" -gt 0 ]; then
    log_warn "系统已有 ${CURRENT_SWAP_GB}GB 交换分区"
    swapon --show
    read -p "是否继续添加新的交换分区？(y/N) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "已取消"
        exit 0
    fi
fi

# 获取系统内存大小（GB）
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))

# 确定交换分区大小
if [ -n "$1" ]; then
    SWAP_SIZE_GB=$1
else
    # 默认与内存相同，最小 1GB，最大 8GB
    SWAP_SIZE_GB=$TOTAL_MEM_GB
    [ "$SWAP_SIZE_GB" -lt 1 ] && SWAP_SIZE_GB=1
    [ "$SWAP_SIZE_GB" -gt 8 ] && SWAP_SIZE_GB=8
fi

SWAP_FILE="/swapfile_xingrin"

log_info "系统内存: ${TOTAL_MEM_GB}GB"
log_info "将创建 ${SWAP_SIZE_GB}GB 交换分区: $SWAP_FILE"

# 检查磁盘空间
AVAILABLE_GB=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
if [ "$AVAILABLE_GB" -lt "$SWAP_SIZE_GB" ]; then
    log_error "磁盘空间不足！可用: ${AVAILABLE_GB}GB，需要: ${SWAP_SIZE_GB}GB"
    exit 1
fi

# 创建交换文件
log_info "正在创建交换文件（可能需要几分钟）..."
dd if=/dev/zero of=$SWAP_FILE bs=1G count=$SWAP_SIZE_GB status=progress

# 设置权限
chmod 600 $SWAP_FILE

# 格式化为交换分区
mkswap $SWAP_FILE

# 启用交换分区
swapon $SWAP_FILE

# 添加到 fstab（开机自动挂载）
if ! grep -q "$SWAP_FILE" /etc/fstab; then
    echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
    log_info "已添加到 /etc/fstab，开机自动启用"
fi

# 优化 swappiness（降低交换倾向，优先使用内存）
SWAPPINESS=10
if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
    echo "vm.swappiness=$SWAPPINESS" >> /etc/sysctl.conf
fi
sysctl vm.swappiness=$SWAPPINESS >/dev/null

log_info "交换分区创建成功！"
echo ""
echo "当前交换分区状态:"
swapon --show
echo ""
free -h
