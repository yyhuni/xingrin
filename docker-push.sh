#!/bin/bash
# ============================================
# Docker Hub 镜像推送脚本
# 用途：构建并推送所有服务镜像到 Docker Hub

# 多架构构建：./docker-push.sh -p linux/amd64,linux/arm64 worker
# ============================================

set -e

# 启用 BuildKit（支持高级缓存功能）
export DOCKER_BUILDKIT=1

# ==================== 配置 ====================
# 切换到脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 从 VERSION 文件读取版本号（单一版本源）
VERSION_FILE="${SCRIPT_DIR}/VERSION"
if [ -f "$VERSION_FILE" ]; then
    FILE_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')
else
    echo -e "\033[0;31m[ERROR]\033[0m VERSION 文件不存在，请先创建版本文件"
    echo "    示例: echo 'v1.0.0' > VERSION"
    exit 1
fi

# Docker Hub 用户名（修改为你的用户名）
DOCKER_USER="${DOCKER_USER:-yyhuni}"
# 镜像版本标签（从 VERSION 文件读取，确保版本一致性）
VERSION="$FILE_VERSION"
# 是否推送（默认 yes，设为 no 则只构建不推送）
PUSH="${PUSH:-yes}"
# 构建平台（默认当前架构，可设为 linux/amd64,linux/arm64 进行多架构构建）
PLATFORM="${PLATFORM:-}"

# 镜像列表
IMAGES=(
    "xingrin-server:docker/server/Dockerfile"
    "xingrin-frontend:docker/frontend/Dockerfile"
    "xingrin-nginx:docker/nginx/Dockerfile"
    "xingrin-worker:docker/worker/Dockerfile"
    "xingrin-agent:docker/agent/Dockerfile"
)

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==================== 帮助信息 ====================
show_help() {
    cat << EOF
用法: $0 [选项] [镜像名...]

版本号从 VERSION 文件读取，修改版本请编辑该文件。

选项:
  -u, --user USER      Docker Hub 用户名 (默认: $DOCKER_USER)
  -p, --platform PLAT  构建平台 (如: linux/amd64,linux/arm64)
  --no-push            只构建不推送
  -h, --help           显示帮助

镜像名 (可选，不指定则构建全部):
  server    后端服务
  frontend  前端服务
  nginx     Nginx 反向代理
  worker    扫描 Worker
  agent     心跳上报 Agent（轻量）

示例:
  $0                             # 构建并推送所有镜像
  $0 server frontend             # 只构建 server 和 frontend
  $0 --no-push                   # 只构建不推送
  $0 -p linux/amd64,linux/arm64  # 多架构构建

环境变量:
  DOCKER_USER   Docker Hub 用户名
  PUSH          是否推送 (yes/no)
  PLATFORM      构建平台
EOF
    exit 0
}

# ==================== 解析参数 ====================
SELECTED_IMAGES=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--user)
            DOCKER_USER="$2"
            shift 2
            ;;
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        --no-push)
            PUSH="no"
            shift
            ;;
        -h|--help)
            show_help
            ;;
        server|frontend|nginx|worker|agent)
            SELECTED_IMAGES+=("$1")
            shift
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            ;;
    esac
done

# ==================== 检查 Docker 登录 ====================
check_docker_login() {
    if [ "$PUSH" = "yes" ]; then
        log_info "检查 Docker Hub 登录状态..."
        if ! docker info 2>/dev/null | grep -q "Username"; then
            log_warn "未登录 Docker Hub，请先执行: docker login"
            read -p "是否现在登录？(y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker login
            else
                log_error "需要登录才能推送镜像"
                exit 1
            fi
        fi
        log_success "Docker Hub 已登录"
    fi
}

# ==================== 构建镜像 ====================
build_image() {
    local name=$1
    local dockerfile=$2
    local full_name="${DOCKER_USER}/${name}:${VERSION}"
    
    log_info "构建镜像: $full_name"
    log_info "  Dockerfile: $dockerfile"
    
    # 构建命令
    local build_cmd="docker build"
    
    # 多架构构建使用 buildx
    if [ -n "$PLATFORM" ]; then
        build_cmd="docker buildx build --platform $PLATFORM"
        if [ "$PUSH" = "yes" ]; then
            build_cmd="$build_cmd --push"
        fi
    fi
    
    # 执行构建（只打版本标签，不打 latest）
    $build_cmd \
        -t "$full_name" \
        -f "$dockerfile" \
        .
    
    if [ $? -eq 0 ]; then
        log_success "构建成功: $full_name"
    else
        log_error "构建失败: $full_name"
        exit 1
    fi
    
    # 推送（非 buildx 模式）
    if [ "$PUSH" = "yes" ] && [ -z "$PLATFORM" ]; then
        log_info "推送镜像: $full_name"
        docker push "$full_name"
        log_success "推送成功: $full_name"
    fi
}

# ==================== 主流程 ====================
main() {
    echo ""
    echo "=========================================="
    echo "  Docker Hub 镜像构建与推送"
    echo "=========================================="
    echo ""
    log_info "用户: $DOCKER_USER"
    log_warn "版本: ${VERSION}"
    log_info "推送: $PUSH"
    [ -n "$PLATFORM" ] && log_info "平台: $PLATFORM"
    echo ""
    
    # 确认版本号，防止误覆盖
    if [ "$PUSH" = "yes" ]; then
        echo -e "${YELLOW}[!] 请确认版本号 ${VERSION} 是否正确${NC}"
        echo -e "${YELLOW}    如需修改，请编辑 VERSION 文件${NC}"
        read -p "确认推送？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "已取消"
            exit 0
        fi
    fi
    
    check_docker_login
    
    # 切换到项目根目录
    cd "$(dirname "$0")"
    
    # 如果指定了特定镜像，只构建那些
    if [ ${#SELECTED_IMAGES[@]} -gt 0 ]; then
        for sel in "${SELECTED_IMAGES[@]}"; do
            for item in "${IMAGES[@]}"; do
                name="${item%%:*}"
                dockerfile="${item##*:}"
                if [[ "$name" == "xingrin-$sel" ]]; then
                    build_image "$name" "$dockerfile"
                fi
            done
        done
    else
        # 构建所有镜像
        for item in "${IMAGES[@]}"; do
            name="${item%%:*}"
            dockerfile="${item##*:}"
            build_image "$name" "$dockerfile"
        done
    fi
    
    echo ""
    echo "=========================================="
    log_success "  完成！"
    echo "=========================================="
    echo ""
    
    if [ "$PUSH" = "yes" ]; then
        log_info "镜像已推送到 Docker Hub:"
        for item in "${IMAGES[@]}"; do
            name="${item%%:*}"
            echo "  - docker pull ${DOCKER_USER}/${name}:${VERSION}"
        done
    fi
}

main
