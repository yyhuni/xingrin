#!/bin/bash
set -e

# ==============================================================================
# 用法:
#   sudo ./install.sh                 生产模式（拉取 Docker Hub 镜像）
#   sudo ./install.sh --dev           开发模式（本地构建 + 调试日志）
#   sudo ./install.sh --no-frontend   安装并只启动后端
#   sudo ./install.sh --dev --no-frontend  开发模式 + 只启动后端
# ==============================================================================

# 解析参数
START_ARGS=""
DEV_MODE=false
for arg in "$@"; do
    case $arg in
        --dev) 
            DEV_MODE=true 
            START_ARGS="$START_ARGS --dev"
            ;;
        --no-frontend) 
            START_ARGS="$START_ARGS --no-frontend" 
            ;;
    esac
done

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
    echo -e "   正确用法: ${BOLD}sudo ./install.sh${RESET}"
    exit 1
fi

# 获取真实用户（通过 sudo 运行时 $SUDO_USER 是真实用户）
REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)

# 项目根目录
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# 显示标题
header "XingRin 一键安装脚本 (Ubuntu)"
info "当前用户: ${BOLD}$REAL_USER${RESET}"
info "项目路径: ${BOLD}$ROOT_DIR${RESET}"

# ==============================================================================
# 工具函数
# ==============================================================================

# 生成随机字符串
generate_random_string() {
    local length="${1:-32}"
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$length" 2>/dev/null | cut -c1-"$length"
    else
        date +%s%N | sha256sum | cut -c1-"$length"
    fi
}

# 更新 .env 文件中的某个键
update_env_var() {
    local file="$1"
    local key="$2"
    local value="$3"
    if grep -q "^$key=" "$file"; then
        sed -i -e "s|^$key=.*|$key=$value|" "$file"
    else
        echo "$key=$value" >> "$file"
    fi
}

# 用于保存生成的密码，方便最后显示
GENERATED_DB_PASSWORD=""
GENERATED_DJANGO_KEY=""

# 生成自签 HTTPS 证书（无域名场景）
generate_self_signed_cert() {
    local ssl_dir="$DOCKER_DIR/nginx/ssl"
    local fullchain="$ssl_dir/fullchain.pem"
    local privkey="$ssl_dir/privkey.pem"

    if [ -f "$fullchain" ] && [ -f "$privkey" ]; then
        success "检测到已有 HTTPS 证书，跳过自签"
        return
    fi

    info "未检测到 HTTPS 证书，正在生成自签证书（localhost）..."
    mkdir -p "$ssl_dir"
    if openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout "$privkey" \
        -out "$fullchain" \
        -subj "/C=CN/ST=NA/L=NA/O=XingRin/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1; then
        success "自签证书已生成: $ssl_dir"
    else
        warn "自签证书生成失败，请检查 openssl 是否可用，或手动放置证书到 $ssl_dir"
    fi
}

# 自动为 docker/.env 填充敏感变量
auto_fill_docker_env_secrets() {
    local env_file="$1"
    info "自动生成 DJANGO_SECRET_KEY 和 DB_PASSWORD..."
    GENERATED_DJANGO_KEY="$(generate_random_string 64)"
    GENERATED_DB_PASSWORD="$(generate_random_string 32)"
    update_env_var "$env_file" "DJANGO_SECRET_KEY" "$GENERATED_DJANGO_KEY"
    update_env_var "$env_file" "DB_PASSWORD" "$GENERATED_DB_PASSWORD"
    success "密钥生成完成"
}

# 显示安装总结信息
show_summary() {
    echo
    if [ "$1" == "success" ]; then
        header "服务已成功启动！"
    else
        header "安装完成 Summary"
    fi

    if [ -f "$DOCKER_DIR/.env" ]; then
        # 从 .env 读取配置用于显示
        DB_HOST=$(grep "^DB_HOST=" "$DOCKER_DIR/.env" | cut -d= -f2)
        DB_USER=$(grep "^DB_USER=" "$DOCKER_DIR/.env" | cut -d= -f2)
        DB_PASSWORD=$(grep "^DB_PASSWORD=" "$DOCKER_DIR/.env" | cut -d= -f2)
        
        echo -e "${YELLOW}数据库配置：${RESET}"
        echo -e "------------------------------------------------------------"
        echo -e "  服务器地址: ${DB_HOST:-未知}"
        echo -e "  用户名: ${DB_USER:-未知}"
        echo -e "  密码: ${DB_PASSWORD:-未知}"
        echo -e "------------------------------------------------------------"
        echo
    fi

    # 获取访问地址
    PUBLIC_HOST=$(grep "^PUBLIC_HOST=" "$DOCKER_DIR/.env" 2>/dev/null | cut -d= -f2)
    if [ -n "$PUBLIC_HOST" ] && [ "$PUBLIC_HOST" != "server" ]; then
        ACCESS_HOST="$PUBLIC_HOST"
    else
        ACCESS_HOST="localhost"
    fi
    
    echo -e "${GREEN}访问地址：${RESET}"
    printf "   %-16s %s\n" "XingRin:" "https://${ACCESS_HOST}/"
    echo -e "   ${YELLOW}(HTTP 会自动跳转到 HTTPS)${RESET}"
    echo
    
    echo -e "${YELLOW}默认登录账号：${RESET}"
    printf "   %-16s %s\n" "用户名:" "admin"
    printf "   %-16s %s\n" "密码:" "admin"
    echo -e "${YELLOW}   [!] 请首次登录后修改密码!${RESET}"
    echo
    
    if [ "$1" != "success" ]; then
        echo -e "${GREEN}后续启动命令：${RESET}"
        echo -e "   ./start.sh              # 启动所有服务"
        echo -e "   ./start.sh --no-frontend # 只启动后端"
        echo -e "   ./stop.sh               # 停止所有服务"
        echo -e "   ./update.sh             # 更新系统"
        echo
    fi
}

# ==============================================================================
# 安装流程
# ==============================================================================

step "[1/3] 检查基础命令"
MISSING_CMDS=()
for cmd in git curl jq openssl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        MISSING_CMDS+=("$cmd")
        warn "未安装: $cmd"
    else
        success "已安装: $cmd"
    fi
done

if [ ${#MISSING_CMDS[@]} -gt 0 ]; then
    info "正在安装缺失命令: ${MISSING_CMDS[*]}..."
    apt update -qq
    apt install -y "${MISSING_CMDS[@]}"
    success "基础命令安装完成"
fi

step "[2/3] 检查 Docker 环境"
if command -v docker >/dev/null 2>&1; then
    success "已安装: docker"
else
    info "正在安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker "$REAL_USER"
    success "Docker 安装完成"
fi

# 检查 docker compose
if docker compose version >/dev/null 2>&1; then
    success "已安装: docker compose"
else
    info "正在安装 docker-compose-plugin..."
    apt install -y docker-compose-plugin
    success "docker compose 安装完成"
fi

step "[3/3] 初始化配置"
DOCKER_DIR="$ROOT_DIR/docker"
if [ ! -d "$DOCKER_DIR" ]; then
    error "未找到 docker 目录，请确认项目结构。"
    exit 1
fi

if [ -f "$DOCKER_DIR/.env.example" ]; then
    cp "$DOCKER_DIR/.env.example" "$DOCKER_DIR/.env"
    success "已创建: docker/.env"
    auto_fill_docker_env_secrets "$DOCKER_DIR/.env"
    
    # 开发模式：开启调试日志
    if [ "$DEV_MODE" = true ]; then
        info "开发模式：开启调试配置..."
        update_env_var "$DOCKER_DIR/.env" "DEBUG" "True"
        update_env_var "$DOCKER_DIR/.env" "LOG_LEVEL" "INFO"
        update_env_var "$DOCKER_DIR/.env" "ENABLE_COMMAND_LOGGING" "true"
        success "已开启: DEBUG=True, LOG_LEVEL=INFO, ENABLE_COMMAND_LOGGING=true"
    fi
    
    # 询问数据库配置
    echo ""
    echo -n -e "${BOLD}${CYAN}[?] 是否使用远程 PostgreSQL 数据库？(y/N) ${RESET}"
    read -r use_remote_db
    echo

    if [[ $use_remote_db =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}   请输入远程 PostgreSQL 配置：${RESET}"
        
        # 服务器地址（必填）
        echo -n -e "   ${CYAN}服务器地址: ${RESET}"
        read -r db_host
        if [ -z "$db_host" ]; then
            error "服务器地址不能为空"
            exit 1
        fi
        
        # 端口（可选）
        echo -n -e "   ${CYAN}端口 [5432]: ${RESET}"
        read -r db_port
        db_port=${db_port:-5432}
        
        # 用户名（必填）
        echo -n -e "   ${CYAN}用户名: ${RESET}"
        read -r db_user
        if [ -z "$db_user" ]; then
            error "用户名不能为空"
            exit 1
        fi
        
        # 密码（必填）
        echo -n -e "   ${CYAN}密码: ${RESET}"
        read -r db_password
        if [ -z "$db_password" ]; then
            error "密码不能为空"
            exit 1
        fi
        
        # 验证远程 PostgreSQL 连接（使用官方 postgres 镜像中的 psql）
        echo
        info "正在验证远程 PostgreSQL 连接..."
        # 使用 postgres 默认库验证连接（每个 PostgreSQL 都有这个库）
        if ! docker run --rm \
            -e PGPASSWORD="$db_password" \
            postgres:15 \
            psql "postgresql://$db_user@$db_host:$db_port/postgres" -c 'SELECT 1' >/dev/null 2>&1; then
            echo
            error "无法连接到远程 PostgreSQL，请检查 IP/端口/用户名/密码是否正确"
            echo "       尝试连接: postgresql://$db_user@$db_host:$db_port/postgres"
            exit 1
        fi
        success "远程 PostgreSQL 连接验证通过"
        
        # 尝试创建业务数据库（如果不存在）
        info "检查并创建数据库..."
        db_name=$(grep "^DB_NAME=" "$DOCKER_DIR/.env" | cut -d= -f2)
        db_name=${db_name:-xingrin}
        prefect_db=$(grep "^PREFECT_DB_NAME=" "$DOCKER_DIR/.env" | cut -d= -f2)
        prefect_db=${prefect_db:-prefect}
        
        docker run --rm -e PGPASSWORD="$db_password" postgres:15 \
            psql "postgresql://$db_user@$db_host:$db_port/postgres" \
            -c "CREATE DATABASE $db_name;" 2>/dev/null || true
        docker run --rm -e PGPASSWORD="$db_password" postgres:15 \
            psql "postgresql://$db_user@$db_host:$db_port/postgres" \
            -c "CREATE DATABASE $prefect_db;" 2>/dev/null || true
        success "数据库准备完成"
        
        sed -i "s/^DB_HOST=.*/DB_HOST=$db_host/" "$DOCKER_DIR/.env"
        sed -i "s/^DB_PORT=.*/DB_PORT=$db_port/" "$DOCKER_DIR/.env"
        sed -i "s/^DB_USER=.*/DB_USER=$db_user/" "$DOCKER_DIR/.env"
        sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$db_password/" "$DOCKER_DIR/.env"
        success "已配置远程数据库: $db_user@$db_host:$db_port"
    else
        info "使用本地 PostgreSQL 容器"
    fi

    # 是否为远程 VPS 部署（需要从其它机器 / Worker 访问本系统）
    echo ""
    echo -n -e "${BOLD}${CYAN}[?] 当前是否为远程 VPS 部署？(y/N) ${RESET}"
    read -r set_public_host
    echo
    if [[ $set_public_host =~ ^[Yy]$ ]]; then
        echo -n -e "   ${CYAN}请输入当前远程 vps 的外网 IP 地址（例如 10.1.1.1）: ${RESET}"
        read -r public_host
        if [ -z "$public_host" ]; then
            warn "未输入外网ip地址，将保持 .env 中已有的 PUBLIC_HOST（请确保 Worker 能访问该地址）"
        else
            update_env_var "$DOCKER_DIR/.env" "PUBLIC_HOST" "$public_host"
            success "已配置对外访问地址: $public_host"
        fi
    else
        info "检测为本机 docker 部署，将 PUBLIC_HOST 设置为 server（容器内部访问后端服务名）"
        update_env_var "$DOCKER_DIR/.env" "PUBLIC_HOST" "server"
    fi
else
    error "未找到 docker/.env.example"
    exit 1
fi

# 准备 HTTPS 证书（无域名也可使用自签）
generate_self_signed_cert

# ==============================================================================
# 启动服务
# ==============================================================================
step "正在启动服务..."
"$ROOT_DIR/start.sh" $START_ARGS

# ==============================================================================
# 完成总结
# ==============================================================================
show_summary "success"
