#!/bin/bash
# 系统监控初始化脚本：8G Swap + Netdata + OOM 保护
# 需要 root 权限运行

set -e

SWAP_SIZE="8G"
SWAP_FILE="/swapfile"

echo "========== 系统监控初始化 =========="

# 1. 设置 Swap
echo "[1/3] 配置 ${SWAP_SIZE} Swap..."
if swapon --show | grep -q "${SWAP_FILE}"; then
    echo "  Swap 已存在，跳过"
else
    fallocate -l ${SWAP_SIZE} ${SWAP_FILE}
    chmod 600 ${SWAP_FILE}
    mkswap ${SWAP_FILE}
    swapon ${SWAP_FILE}
    
    # 添加到 fstab（如果不存在）
    if ! grep -q "${SWAP_FILE}" /etc/fstab; then
        echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
    fi
    echo "  Swap 配置完成"
fi

# 2. 安装 Netdata
echo "[2/3] 安装 Netdata..."
if command -v netdata &> /dev/null; then
    echo "  Netdata 已安装，跳过"
else
    curl -fsSL https://get.netdata.cloud/kickstart.sh -o /tmp/netdata-kickstart.sh
    bash /tmp/netdata-kickstart.sh --non-interactive --stable-channel
    rm -f /tmp/netdata-kickstart.sh
    echo "  Netdata 安装完成"
fi

# 3. 设置 Netdata OOM 保护
echo "[3/3] 配置 OOM 保护..."
OOM_CONF_DIR="/etc/systemd/system/netdata.service.d"
OOM_CONF_FILE="${OOM_CONF_DIR}/oom.conf"

if [ -f "${OOM_CONF_FILE}" ]; then
    echo "  OOM 保护已配置，跳过"
else
    mkdir -p ${OOM_CONF_DIR}
    cat > ${OOM_CONF_FILE} << 'EOF'
[Service]
OOMScoreAdjust=-1000
EOF
    systemctl daemon-reload
    systemctl restart netdata
    echo "  OOM 保护配置完成"
fi

echo ""
echo "========== 配置完成 =========="
echo "Swap:    $(swapon --show --bytes | awk 'NR==2{print $3/1024/1024/1024 " GB"}')"
echo "Netdata: http://$(hostname -I | awk '{print $1}'):19999"
echo ""
