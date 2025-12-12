#!/bin/bash
# 重启服务（Docker 部署）
cd "$(dirname "$0")"
exec ./docker/restart.sh
