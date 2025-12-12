# ============================================
# XingRin Agent - 轻量心跳上报镜像
# 用途：心跳上报 + 负载监控
# 基础镜像：Alpine Linux (~5MB)
# 最终大小：~10MB
# ============================================

FROM alpine:3.19

# 安装必要工具
RUN apk add --no-cache \
    bash \
    curl \
    procps

# 复制 agent 脚本
COPY backend/scripts/worker-deploy/agent.sh /app/agent.sh
RUN chmod +x /app/agent.sh

# 工作目录
WORKDIR /app

# 默认命令
CMD ["bash", "/app/agent.sh"]
