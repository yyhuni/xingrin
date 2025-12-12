#!/bin/bash
# 停止服务（所有服务均在 Docker 中运行）
cd "$(dirname "$0")"
exec ./docker/stop.sh "$@"
