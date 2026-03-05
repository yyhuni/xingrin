#!/bin/bash
set -e

echo "[START] 启动 XingRin Server..."

# 1. 执行数据库迁移（迁移文件应提交到仓库，这里只执行 migrate）
echo "  [1/3] 执行数据库迁移..."
cd /app/backend
python manage.py migrate --noinput
echo "  ✓ 数据库迁移完成"

echo "  [1.1/3] 初始化默认扫描引擎..."
python manage.py init_default_engine --force
echo "  ✓ 默认扫描引擎已就绪"

echo "  [1.2/3] 初始化默认目录字典..."
python manage.py init_wordlists
echo "  ✓ 默认目录字典已就绪"

echo "  [1.3/3] 初始化默认指纹库..."
python manage.py init_fingerprints
echo "  ✓ 默认指纹库已就绪"

echo "  [1.4/3] 恢复未分发的扫描任务..."
# 后台异步恢复，避免阻塞 uvicorn 启动
(python manage.py resume_pending_scans >> /opt/xingrin/logs/resume_pending_scans.log 2>&1 || true) &
echo "  ✓ 恢复任务已后台启动（日志: /opt/xingrin/logs/resume_pending_scans.log）"

# 2. 启动 Django uvicorn 服务 (ASGI)
# 定时任务由内置 APScheduler 处理，在 Django 启动时自动启动
echo "  [2/3] 启动 Django uvicorn (ASGI)..."
uvicorn config.asgi:application --host 0.0.0.0 --port 8888
