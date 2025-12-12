#!/bin/bash
set -e

cd "$(dirname "$0")"
source "./scripts/common.sh"
init_docker_env

# 颜色
CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${CYAN}[STOP]${NC} 停止服务..."

# 尝试停止两种模式的容器（生产模式和开发模式）
if [ -f "docker-compose.yml" ]; then
    ${COMPOSE_CMD} -f docker-compose.yml down 2>/dev/null || true
fi
if [ -f "docker-compose.dev.yml" ]; then
    ${COMPOSE_CMD} -f docker-compose.dev.yml down 2>/dev/null || true
fi

echo -e "${GREEN}[OK]${NC} 服务已停止"
