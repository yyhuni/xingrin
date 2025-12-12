#!/bin/bash
#
# 数据初始化脚本（公共模块）
#
# 包含：
#   - 数据库迁移
#   - 初始化默认引擎配置
#   - 初始化字典
#   - 初始化 Nuclei 模板仓库
#
# 被以下脚本调用：
#   - install.sh（安装时）
#   - start.sh（启动时）
#   - update.sh（更新时）
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "    ${GREEN}OK${NC} $1"; }
log_warn() { echo -e "    ${YELLOW}!${NC} $1"; }
log_step() { echo -e "  ${CYAN}>>${NC} $1"; }

# 检查服务是否运行
check_server() {
    if ! docker compose ps --status running 2>/dev/null | grep -q "server"; then
        echo "Server 容器未运行，跳过数据初始化"
        return 1
    fi
    return 0
}

# 等待服务就绪
wait_for_server() {
    log_info "等待 Server 服务就绪..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker compose exec -T server python backend/manage.py check &>/dev/null; then
            log_info "Server 服务已就绪"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    log_warn "等待 Server 服务超时"
    return 1
}

# 数据库迁移
run_migrations() {
    log_step "执行数据库迁移..."
    
    # 开发环境：先 makemigrations
    if [ "$DEV_MODE" = "true" ]; then
        docker compose exec -T server python backend/manage.py makemigrations --noinput 2>/dev/null || true
    fi
    
    docker compose exec -T server python backend/manage.py migrate --noinput
    log_info "数据库迁移完成"
}

# 初始化引擎配置
init_engine_config() {
    log_step "初始化引擎配置..."
    docker compose exec -T server python backend/manage.py shell -c "
from apps.engine.models import ScanEngine
from pathlib import Path

yaml_path = Path('/app/backend/apps/scan/configs/engine_config_example.yaml')
if not yaml_path.exists():
    print('未找到配置文件，跳过')
    exit(0)

# 检查是否已有 full scan 引擎
engine = ScanEngine.objects.filter(name='full scan').first()
if engine:
    if not engine.configuration or not engine.configuration.strip():
        engine.configuration = yaml_path.read_text()
        engine.save(update_fields=['configuration'])
        print(f'已初始化引擎配置: {engine.name}')
    else:
        print(f'引擎已有配置，跳过')
else:
    # 创建引擎
    engine = ScanEngine.objects.create(
        name='full scan',
        configuration=yaml_path.read_text(),
    )
    print(f'已创建引擎: {engine.name}')
"
    log_info "引擎配置初始化完成"
}

# 初始化字典
init_wordlists() {
    log_step "初始化字典..."
    docker compose exec -T server python backend/manage.py init_wordlists
    log_info "字典初始化完成"
}

# 初始化 Nuclei 模板仓库
init_nuclei_templates() {
    log_step "初始化 Nuclei 模板仓库..."
    docker compose exec -T server python backend/manage.py init_nuclei_templates --sync
    log_info "Nuclei 模板仓库初始化完成"
}

# 初始化 admin 用户
init_admin_user() {
    log_step "初始化 admin 用户..."
    docker compose exec -T server python backend/manage.py init_admin
    log_info "admin 用户初始化完成"
}

# 主函数
main() {
    # 解析参数
    DEV_MODE=false
    SKIP_MIGRATION=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev) DEV_MODE=true; shift ;;
            --skip-migration) SKIP_MIGRATION=true; shift ;;
            *) shift ;;
        esac
    done

    echo ""
    echo -e "${BOLD}${BLUE}────────────────────────────────────────${NC}"
    echo -e "${BOLD}${BLUE}  数据初始化${NC}"
    echo -e "${BOLD}${BLUE}────────────────────────────────────────${NC}"
    echo ""

    if ! check_server; then
        return 1
    fi

    wait_for_server || return 1

    if [ "$SKIP_MIGRATION" = "false" ]; then
        run_migrations
    fi
    
    init_engine_config
    init_wordlists
    init_nuclei_templates
    init_admin_user

    echo ""
    echo -e "  ${GREEN}数据初始化完成${NC}"
    echo ""
}

# 如果直接执行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
