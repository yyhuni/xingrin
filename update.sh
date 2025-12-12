#!/bin/bash
# 更新服务（停止 → 拉取 → 合并配置 → 启动）
#
# 用法:
#   ./update.sh                 生产模式更新（拉取 Docker Hub 镜像）
#   ./update.sh --dev           开发模式更新（本地构建镜像）
#   ./update.sh --no-frontend   更新后只启动后端
#   ./update.sh --dev --no-frontend     开发环境更新后只启动后端

cd "$(dirname "$0")"

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

echo -e "${CYAN}[1/4]${NC} 停止服务..."
./stop.sh 2>&1 | sed 's/^/    /'

echo ""
echo -e "${CYAN}[2/4]${NC} 拉取代码..."
git pull --rebase 2>&1 | sed 's/^/    /'

echo ""
echo -e "${CYAN}[3/4]${NC} 检查配置更新..."
merge_env_config

echo ""
echo -e "${CYAN}[4/4]${NC} 启动服务..."
./start.sh "$@"

echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  更新完成！${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo ""
