#!/bin/bash

# 性能测试快速启动脚本
# 用法：./start_performance_test.sh

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "========================================"
echo "  PostgreSQL 性能测试工具"
echo "========================================"
echo ""

# 加载 .env 文件中的数据库配置
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "加载数据库配置..."
    export PGHOST=$(grep "^DB_HOST=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    export PGPORT=$(grep "^DB_PORT=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    export PGUSER=$(grep "^DB_USER=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    export PGPASSWORD=$(grep "^DB_PASSWORD=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    export PGDATABASE=$(grep "^DB_NAME=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    
    echo "  主机: $PGHOST:$PGPORT"
    echo "  用户: $PGUSER"
    echo "  数据库: $PGDATABASE"
else
    echo "[WARN]  未找到 .env 文件"
fi
echo ""

# 检查 PostgreSQL 连接
echo "检查数据库连接..."
cd "$PROJECT_DIR"
if ! source "$PROJECT_DIR/../.venv/bin/activate" && python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db import connection
try:
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        print('✓ 数据库连接正常')
except Exception as e:
    print(f'[ERROR] 数据库连接失败: {e}')
    exit(1)
" > /dev/null 2>&1; then
    echo "[ERROR] 无法连接到数据库 $PGDATABASE"
    echo ""
    echo "请检查："
    echo "  1. VPS 防火墙是否开放 5432 端口"
    echo "  2. PostgreSQL 的 pg_hba.conf 是否允许远程连接"
    echo "  3. .env 文件中的数据库配置是否正确"
    echo "  4. Django 设置是否正确"
    echo ""
    echo "手动测试连接："
    echo "  cd $PROJECT_DIR && source $PROJECT_DIR/../.venv/bin/activate && python manage.py dbshell"
    exit 1
fi
echo "✓ 数据库连接正常"
echo ""

# 菜单选择
echo "请选择操作："
echo "  1) 测试批次大小（推荐先执行）"
echo "  2) 生成 1 万条测试数据"
echo "  3) 生成 10 万条测试数据"
echo "  4) 生成 100 万条测试数据"
echo "  5) 启动实时监控（独立运行）"
echo "  6) 查看测试前基准数据"
echo "  7) 查看测试后统计数据"
echo "  8) 完整测试流程（自动化）"
echo "  0) 退出"
echo ""
read -p "请输入选项 (0-8): " choice

case $choice in
    1)
        echo ""
        echo "开始测试批次大小..."
        cd "$PROJECT_DIR"
        source "$PROJECT_DIR/../.venv/bin/activate"
        
        # 自动创建测试目标
        echo "创建测试目标..."
        python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.targets.models import Target, Organization

# 创建默认组织
org, _ = Organization.objects.get_or_create(
    name='测试组织',
    defaults={'description': '性能测试专用组织'}
)

# 创建测试目标
for i in range(1, 4):
    target_name = f'test{i}.com'
    target, created = Target.objects.get_or_create(
        name=target_name
    )
    if created:
        # 将目标添加到组织
        org.targets.add(target)
        print(f'✓ 创建目标: {target_name}')
    else:
        print(f'✓ 目标已存在: {target_name}')
"
        echo ""
        
        python manage.py generate_test_data --target test1.com --count 10000 --test-batch-sizes
        ;;
    2)
        echo ""
        echo "使用默认批次大小: 5000"
        echo "开始生成 1 万条数据..."
        cd "$PROJECT_DIR"
        source "$PROJECT_DIR/../.venv/bin/activate"
        
        # 自动创建测试目标
        echo "创建测试目标..."
        python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.targets.models import Target, Organization

# 创建默认组织
org, _ = Organization.objects.get_or_create(
    name='测试组织',
    defaults={'description': '性能测试专用组织'}
)

# 创建测试目标
for i in range(1, 4):
    target_name = f'test{i}.com'
    target, created = Target.objects.get_or_create(
        name=target_name
    )
    if created:
        # 将目标添加到组织
        org.targets.add(target)
        print(f'✓ 创建目标: {target_name}')
    else:
        print(f'✓ 目标已存在: {target_name}')
"
        echo ""
        
        python manage.py generate_test_data \
            --target test1.com \
            --count 10000 \
            --batch-size 5000 \
            --benchmark
        ;;
    3)
        echo ""
        echo "使用默认批次大小: 5000"
        echo "开始生成 10 万条数据..."
        cd "$PROJECT_DIR"
        source "$PROJECT_DIR/../.venv/bin/activate"
        
        # 自动创建测试目标
        echo "创建测试目标..."
        python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.targets.models import Target, Organization

# 创建默认组织
org, _ = Organization.objects.get_or_create(
    name='测试组织',
    defaults={'description': '性能测试专用组织'}
)

# 创建测试目标
for i in range(1, 4):
    target_name = f'test{i}.com'
    target, created = Target.objects.get_or_create(
        name=target_name
    )
    if created:
        # 将目标添加到组织
        org.targets.add(target)
        print(f'✓ 创建目标: {target_name}')
    else:
        print(f'✓ 目标已存在: {target_name}')
"
        echo ""
        
        python manage.py generate_test_data \
            --target test2.com \
            --count 100000 \
            --batch-size 5000 \
            --benchmark
        ;;
    4)
        echo ""
        echo "使用默认批次大小: 5000"
        echo "[WARN]  警告：这将生成 100 万条数据，可能需要 2-4 小时"
        read -p "确认继续? (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            echo ""
            echo "开始生成 100 万条数据..."
            cd "$PROJECT_DIR"
            source "$PROJECT_DIR/../.venv/bin/activate"
            
            # 自动创建测试目标
            echo "创建测试目标..."
            python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.targets.models import Target, Organization

# 创建默认组织
org, _ = Organization.objects.get_or_create(
    name='测试组织',
    defaults={'description': '性能测试专用组织'}
)

# 创建测试目标
for i in range(1, 4):
    target_name = f'test{i}.com'
    target, created = Target.objects.get_or_create(
        name=target_name
    )
    if created:
        # 将目标添加到组织
        org.targets.add(target)
        print(f'✓ 创建目标: {target_name}')
    else:
        print(f'✓ 目标已存在: {target_name}')
"
            echo ""
            
            python manage.py generate_test_data \
                --target test3.com \
                --count 1000000 \
                --batch-size 5000 \
                --benchmark
        fi
        ;;
    5)
        echo ""
        read -p "刷新间隔（秒，推荐 2-5）: " interval
        interval=${interval:-2}
        echo ""
        echo "启动 PostgreSQL 实时监控..."
        echo "按 Ctrl+C 停止监控"
        sleep 2
        "$SCRIPT_DIR/monitor_pg_performance.sh" xingrin "$interval"
        ;;
    6)
        echo ""
        echo "记录测试前基准数据..."
        mkdir -p "$PROJECT_DIR/logs"
        psql -d "$PGDATABASE" -f "$SCRIPT_DIR/pg_stats_before_test.sql" > "$PROJECT_DIR/logs/stats_before.txt"
        echo "✓ 已保存到: $PROJECT_DIR/logs/stats_before.txt"
        echo ""
        read -p "是否查看内容? (y/N): " view
        if [[ $view == [yY] ]]; then
            less "$PROJECT_DIR/logs/stats_before.txt"
        fi
        ;;
    7)
        echo ""
        echo "记录测试后统计数据..."
        mkdir -p "$PROJECT_DIR/logs"
        psql -d "$PGDATABASE" -f "$SCRIPT_DIR/pg_stats_after_test.sql" > "$PROJECT_DIR/logs/stats_after.txt"
        echo "✓ 已保存到: $PROJECT_DIR/logs/stats_after.txt"
        echo ""
        read -p "是否对比测试前后? (y/N): " compare
        if [[ $compare == [yY] ]] && [ -f "$PROJECT_DIR/logs/stats_before.txt" ]; then
            echo ""
            echo "差异对比:"
            diff "$PROJECT_DIR/logs/stats_before.txt" "$PROJECT_DIR/logs/stats_after.txt" || true
        fi
        ;;
    8)
        echo ""
        echo "========================================"
        echo "  完整自动化测试流程"
        echo "========================================"
        echo ""
        echo "步骤 1：创建测试目标"
        cd "$PROJECT_DIR"
        source "$PROJECT_DIR/../.venv/bin/activate"
        python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.targets.models import Target, Organization

# 创建默认组织
org, _ = Organization.objects.get_or_create(
    name='测试组织',
    defaults={'description': '性能测试专用组织'}
)

# 创建测试目标
for i in range(1, 4):
    target_name = f'test{i}.com'
    target, created = Target.objects.get_or_create(
        name=target_name
    )
    if created:
        # 将目标添加到组织
        org.targets.add(target)
        print(f'✓ 创建目标: {target_name}')
    else:
        print(f'✓ 目标已存在: {target_name}')
"
        echo "✓ 完成"
        echo ""
        
        echo "步骤 2：记录测试前基准数据"
        mkdir -p "$PROJECT_DIR/logs"
        psql -d "$PGDATABASE" -f "$SCRIPT_DIR/pg_stats_before_test.sql" > "$PROJECT_DIR/logs/stats_before.txt" 2>&1
        echo "✓ 完成"
        echo ""
        
        echo "步骤 3：测试批次大小"
        python manage.py generate_test_data --target test1.com --count 10000 --test-batch-sizes | tee "$PROJECT_DIR/logs/batch_size_test.txt"
        echo ""
        
        # 自动提取最优批次大小，如果没有找到则使用默认值5000
        optimal_batch=$(grep "推荐批次大小:" "$PROJECT_DIR/logs/batch_size_test.txt" | awk '{print $2}' || echo "5000")
        optimal_batch=${optimal_batch:-5000}
        echo "✓ 自动选择最优批次: $optimal_batch"
        echo ""
        
        echo "步骤 4：生成 10 万条数据"
        python manage.py generate_test_data \
            --target test3.com \
            --count 100000 \
            --batch-size "$optimal_batch" \
            --benchmark | tee "$PROJECT_DIR/logs/test_results.txt"
        echo ""
        
        echo "步骤 5：记录测试后统计"
        psql -d "$PGDATABASE" -f "$SCRIPT_DIR/pg_stats_after_test.sql" > "$PROJECT_DIR/logs/stats_after.txt" 2>&1
        echo "✓ 完成"
        echo ""
        
        # 生成性能报告
        echo "步骤 6：生成性能报告"
        report_file="$PROJECT_DIR/logs/performance_report.txt"
        
        echo "========================================" > "$report_file"
        echo "  XingRin 性能测试报告" >> "$report_file"
        echo "========================================" >> "$report_file"
        echo "" >> "$report_file"
        echo "测试时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "$report_file"
        echo "数据库: $PGHOST:$PGPORT/$PGDATABASE" >> "$report_file"
        echo "最优批次: $optimal_batch" >> "$report_file"
        echo "" >> "$report_file"
        
        # 提取批次测试结果
        echo "========================================" >> "$report_file"
        echo "  批次大小性能对比" >> "$report_file"
        echo "========================================" >> "$report_file"
        grep -A 10 "批次大小对比结果" "$PROJECT_DIR/logs/batch_size_test.txt" | tail -n +4 >> "$report_file"
        echo "" >> "$report_file"
        
        # 提取详细测试结果
        echo "========================================" >> "$report_file"
        echo "  10万条数据生成性能" >> "$report_file"
        echo "========================================" >> "$report_file"
        grep "性能测试报告" -A 20 "$PROJECT_DIR/logs/test_results.txt" | tail -n +3 >> "$report_file"
        echo "" >> "$report_file"
        
        # 提取总耗时
        total_time=$(grep "总耗时:" "$PROJECT_DIR/logs/test_results.txt" | head -1)
        echo "========================================" >> "$report_file"
        echo "  总体性能" >> "$report_file"
        echo "========================================" >> "$report_file"
        echo "$total_time" >> "$report_file"
        echo "" >> "$report_file"
        
        echo "========================================" >> "$report_file"
        echo "  测试文件" >> "$report_file"
        echo "========================================" >> "$report_file"
        echo "- 测试前基准: logs/stats_before.txt" >> "$report_file"
        echo "- 批次测试: logs/batch_size_test.txt" >> "$report_file"
        echo "- 性能结果: logs/test_results.txt" >> "$report_file"
        echo "- 测试后统计: logs/stats_after.txt" >> "$report_file"
        echo "- 性能报告: logs/performance_report.txt" >> "$report_file"
        echo "" >> "$report_file"
        
        echo "✓ 性能报告已生成"
        echo ""
        
        echo "========================================"
        echo "  ✓ 自动化测试完成！"
        echo "========================================"
        echo ""
        
        # 显示性能报告
        cat "$report_file"
        echo ""
        echo "详细报告已保存到: $report_file"
        echo ""
        ;;
    0)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效选项"
        exit 1
        ;;
esac

echo ""
echo "完成！"
