FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖 (用于编译某些 Python 包)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# 安装 Docker CLI（用于本地 Worker 任务分发）
RUN curl -fsSL https://get.docker.com | sh

# 安装 uv（超快的 Python 包管理器）
RUN pip install uv

# 安装 Python 依赖（使用 uv 并行下载，速度快 10-100 倍）
COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -r requirements.txt

# 复制后端代码
COPY backend /app/backend
ENV PYTHONPATH=/app/backend

# 暴露端口
# 8888: Django/uvicorn
EXPOSE 8888

# 复制启动脚本
COPY docker/server/start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
