#!/bin/bash
set -e

echo "[START] 启动 XingRin Server..."

# 1. 生成和迁移数据库
echo "  [1/3] 生成数据库迁移文件..."
cd /app/backend
python manage.py makemigrations
echo "  ✓ 迁移文件生成完成"

echo "  [1.1/3] 执行数据库迁移..."
python manage.py migrate --noinput
echo "  ✓ 数据库迁移完成"

echo "  [1.2/3] 初始化默认扫描引擎..."
python manage.py init_default_engine
echo "  ✓ 默认扫描引擎已就绪"

echo "  [1.3/3] 初始化默认目录字典..."
python manage.py init_wordlists
echo "  ✓ 默认目录字典已就绪"

# 2. 启动 Django uvicorn 服务 (ASGI)
# 定时任务由内置 APScheduler 处理，在 Django 启动时自动启动
echo "  [2/3] 启动 Django uvicorn (ASGI)..."
uvicorn config.asgi:application --host 0.0.0.0 --port 8888
