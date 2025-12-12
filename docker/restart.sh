#!/bin/bash
set -e

cd "$(dirname "$0")"
source "./scripts/common.sh"
init_docker_env_with_env_check

# 颜色
CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${CYAN}[RESTART]${NC} 重启服务..."

# 尝试重启两种模式的容器
if [ -f "docker-compose.yml" ]; then
    ${COMPOSE_CMD} -f docker-compose.yml restart 2>/dev/null || true
fi
if [ -f "docker-compose.dev.yml" ]; then
    ${COMPOSE_CMD} -f docker-compose.dev.yml restart 2>/dev/null || true
fi

echo -e "${GREEN}[OK]${NC} 服务已重启"
