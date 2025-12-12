#!/bin/bash
set -e

cd "$(dirname "$0")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 解析参数
WITH_FRONTEND=true
DEV_MODE=false
for arg in "$@"; do
    case $arg in
        --no-frontend) WITH_FRONTEND=false ;;
        --dev) DEV_MODE=true ;;
    esac
done

# 选择 compose 文件
if [ "$DEV_MODE" = true ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    echo -e "${YELLOW}[MODE]${NC} 开发模式 - 本地构建镜像"
else
    COMPOSE_FILE="docker-compose.yml"
    echo -e "${GREEN}[MODE]${NC} 生产模式 - 使用 Docker Hub 镜像"
fi

# 检查 Docker 环境
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} 未检测到 docker 命令，请先安装 Docker"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Docker 守护进程未运行，请先启动 Docker"
    exit 1
fi

if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}[ERROR]${NC} 未检测到 docker compose，请先安装"
    exit 1
fi

# 检查配置文件
if [ ! -f .env ]; then
    echo -e "${RED}[ERROR]${NC} 未找到 .env 配置文件"
    echo "    请先复制 .env.example 为 .env 并配置"
    exit 1
fi

# 确保数据目录存在
DATA_DIR="/opt/xingrin"
if [ ! -d "$DATA_DIR/results" ] || [ ! -d "$DATA_DIR/logs" ]; then
    echo -e "${CYAN}[INIT]${NC} 创建数据目录: $DATA_DIR"
    sudo mkdir -p "$DATA_DIR/results" "$DATA_DIR/logs"
    sudo chmod -R 755 "$DATA_DIR"
fi

# 读取数据库配置
DB_HOST=$(grep -E "^DB_HOST=" .env | cut -d'=' -f2 | tr -d ' "'"'" || echo "postgres")

if [[ "$DB_HOST" == "postgres" || "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ]]; then
    echo -e "${CYAN}[DB]${NC} 使用本地 PostgreSQL 容器"
    PROFILE_ARG="--profile local-db"
else
    echo -e "${CYAN}[DB]${NC} 使用远程 PostgreSQL: $DB_HOST"
    PROFILE_ARG=""
fi

# 启动服务（启用 BuildKit 缓存 + 并行构建加速）
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_INLINE_CACHE=1

# 使用指定的 compose 文件
COMPOSE_ARGS="-f ${COMPOSE_FILE} ${PROFILE_ARG}"

echo ""
if [ "$DEV_MODE" = true ]; then
    # 开发模式：本地构建
    if [ "$WITH_FRONTEND" = true ]; then
        echo -e "${CYAN}[BUILD]${NC} 并行构建镜像..."
        ${COMPOSE_CMD} ${COMPOSE_ARGS} build --parallel
        echo -e "${CYAN}[START]${NC} 启动全部服务..."
        ${COMPOSE_CMD} ${COMPOSE_ARGS} up -d
    else
        echo -e "${CYAN}[BUILD]${NC} 并行构建后端镜像..."
        ${COMPOSE_CMD} ${COMPOSE_ARGS} build --parallel server scan-worker maintenance-worker
        echo -e "${CYAN}[START]${NC} 启动后端服务..."
        ${COMPOSE_CMD} ${COMPOSE_ARGS} up -d redis server scan-worker maintenance-worker
        if [ -n "$PROFILE_ARG" ]; then
            ${COMPOSE_CMD} ${COMPOSE_ARGS} up -d postgres
        fi
    fi
else
    # 生产模式：拉取 Docker Hub 镜像
    if [ "$WITH_FRONTEND" = true ]; then
        echo -e "${CYAN}[PULL]${NC} 拉取最新镜像..."
        ${COMPOSE_CMD} ${COMPOSE_ARGS} pull
        echo -e "${CYAN}[START]${NC} 启动全部服务..."
        ${COMPOSE_CMD} ${COMPOSE_ARGS} up -d
    else
        echo -e "${CYAN}[PULL]${NC} 拉取后端镜像..."
        ${COMPOSE_CMD} ${COMPOSE_ARGS} pull redis server scan-worker maintenance-worker
        echo -e "${CYAN}[START]${NC} 启动后端服务..."
        ${COMPOSE_CMD} ${COMPOSE_ARGS} up -d redis server scan-worker maintenance-worker
        if [ -n "$PROFILE_ARG" ]; then
            ${COMPOSE_CMD} ${COMPOSE_ARGS} up -d postgres
        fi
    fi
fi
echo -e "${GREEN}[OK]${NC} 服务已启动"

# 数据初始化
./scripts/init-data.sh

# 获取访问地址
PUBLIC_HOST=$(grep "^PUBLIC_HOST=" .env 2>/dev/null | cut -d= -f2)
if [ -n "$PUBLIC_HOST" ] && [ "$PUBLIC_HOST" != "server" ]; then
    ACCESS_HOST="$PUBLIC_HOST"
else
    ACCESS_HOST="localhost"
fi

# 显示结果
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  服务启动成功！${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}访问地址${NC}"
if [ "$WITH_FRONTEND" = true ]; then
    echo -e "  XingRin:  ${CYAN}https://${ACCESS_HOST}/${NC}"
    echo -e "  ${YELLOW}(HTTP 会自动跳转到 HTTPS)${NC}"
else
    echo -e "  API:      ${CYAN}http://${ACCESS_HOST}:8888${NC}"
    echo ""
    echo -e "${YELLOW}[TIP]${NC} 前端未启动，请手动运行:"
    echo "      cd frontend && pnpm dev"
fi
echo ""
echo -e "${BOLD}默认账号${NC}"
echo "  用户名:   admin"
echo "  密码:     admin"
echo -e "  ${YELLOW}[!] 请首次登录后修改密码${NC}"
echo ""
