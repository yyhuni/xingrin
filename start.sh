#!/bin/bash
# 启动服务（所有服务均在 Docker 中运行）
#
# 用法:
#   ./start.sh                 生产模式 - 拉取 Docker Hub 镜像启动
#   ./start.sh --dev           开发模式 - 本地构建镜像启动
#   ./start.sh --no-frontend   只启动后端（前端手动启动）
#   ./start.sh --dev --no-frontend  开发模式 + 只启动后端

cd "$(dirname "$0")"
exec ./docker/start.sh "$@"
