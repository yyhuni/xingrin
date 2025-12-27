#!/bin/bash
# ============================================
# XingRin 系统更新脚本
# 用途：更新代码 + 同步版本 + 重启服务
# ============================================
#
# 版本同步流程：
# 1. git pull 拉取最新代码（包含新的 VERSION 文件）
# 2. 读取 VERSION 文件，更新 .env 的 IMAGE_TAG
# 3. 重启服务，server 使用新代码 + 新镜像版本
# 4. 分发任务时，远程 Worker 自动拉取新版本镜像
#
# 用法:
#   ./update.sh                 生产模式更新（拉取 Docker Hub 镜像）
#   ./update.sh --dev           开发模式更新（本地构建镜像）
#   ./update.sh --no-frontend   更新后只启动后端
#   ./update.sh --dev --no-frontend     开发环境更新后只启动后端

cd "$(dirname "$0")"

# 跨平台 sed -i（兼容 macOS 和 Linux）
sed_inplace() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# 解析参数判断模式
DEV_MODE=false
for arg in "$@"; do
    case $arg in
        --dev) DEV_MODE=true ;;
    esac
done

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 合并 .env 新配置项（保留用户已有值）
merge_env_config() {
    local example_file="docker/.env.example"
    local env_file="docker/.env"
    
    if [ ! -f "$example_file" ] || [ ! -f "$env_file" ]; then
        return
    fi
    
    local new_keys=0
    
    while IFS= read -r line || [ -n "$line" ]; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        local key="${line%%=*}"
        [[ -z "$key" || "$key" == "$line" ]] && continue
        
        if ! grep -q "^${key}=" "$env_file"; then
            echo "$line" >> "$env_file"
            echo -e "    ${GREEN}+${NC} 新增: $key"
            ((new_keys++))
        fi
    done < "$example_file"
    
    if [ $new_keys -gt 0 ]; then
        echo -e "    ${GREEN}OK${NC} 已添加 $new_keys 个新配置项"
    else
        echo -e "    ${GREEN}OK${NC} 配置已是最新"
    fi
}

echo ""
echo -e "${BOLD}${BLUE}╔════════════════════════════════════════╗${NC}"
if [ "$DEV_MODE" = true ]; then
    echo -e "${BOLD}${BLUE}║       开发环境更新（本地构建）          ║${NC}"
else
    echo -e "${BOLD}${BLUE}║       生产环境更新（Docker Hub）        ║${NC}"
fi
echo -e "${BOLD}${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 测试性功能警告
echo -e "${BOLD}${YELLOW}[!] 警告：此功能为测试性功能，可能会导致升级失败${NC}"
echo -e "${YELLOW}    建议运行 ./uninstall.sh 后重新执行 ./install.sh 进行全新安装${NC}"
echo ""
echo -n -e "${YELLOW}是否继续更新？(y/N) ${NC}"
read -r ans_continue
ans_continue=${ans_continue:-N}

if [[ ! $ans_continue =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}已取消更新。${NC}"
    exit 0
fi
echo ""

echo -e "${CYAN}[1/4]${NC} 停止服务..."
./stop.sh 2>&1 | sed 's/^/    /'

echo ""
echo -e "${CYAN}[2/4]${NC} 拉取代码..."
git pull --rebase 2>&1 | sed 's/^/    /'

echo ""
echo -e "${CYAN}[3/4]${NC} 检查配置更新..."
merge_env_config

# 版本同步：从 VERSION 文件更新 IMAGE_TAG
# 确保 server 代码和 worker 镜像版本一致
if [ -f "VERSION" ]; then
    NEW_VERSION=$(cat VERSION | tr -d '[:space:]')
    if [ -n "$NEW_VERSION" ]; then
        # 更新 .env 中的 IMAGE_TAG（所有节点将使用此版本的镜像）
        if grep -q "^IMAGE_TAG=" "docker/.env"; then
            sed_inplace "s/^IMAGE_TAG=.*/IMAGE_TAG=$NEW_VERSION/" "docker/.env"
            echo -e "    ${GREEN}+${NC} 版本同步: IMAGE_TAG=$NEW_VERSION"
        else
            echo "IMAGE_TAG=$NEW_VERSION" >> "docker/.env"
            echo -e "    ${GREEN}+${NC} 新增版本: IMAGE_TAG=$NEW_VERSION"
        fi
    fi
fi

echo ""
echo -e "${CYAN}[4/4]${NC} 启动服务..."
./start.sh "$@"

echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  更新完成！${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo ""
