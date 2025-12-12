# 第一阶段：使用 Go 官方镜像编译工具
FROM golang:1.24 AS go-builder

ENV GOPROXY=https://goproxy.cn,direct
# Naabu 需要 CGO 和 libpcap
ENV CGO_ENABLED=1

# 安装编译依赖（libpcap-dev 用于 naabu，git/build-essential 用于编译 massdns）
RUN apt-get update && apt-get install -y \
    libpcap-dev \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 安装 massdns（puredns 依赖）
RUN git clone https://github.com/blechschmidt/massdns.git /tmp/massdns && \
    cd /tmp/massdns && \
    make && \
    cp bin/massdns /usr/local/bin/massdns

# 安装 ProjectDiscovery 等 Go 工具（需要 CGO 的工具如 naabu）
RUN go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest && \
    go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
    go install -v github.com/projectdiscovery/katana/cmd/katana@latest && \
    go install -v github.com/tomnomnom/assetfinder@latest && \
    go install -v github.com/ffuf/ffuf/v2@latest && \
    go install -v github.com/d3mondev/puredns/v2@latest

# 安装 Amass v5（禁用 CGO 以跳过 libpostal 依赖）
RUN CGO_ENABLED=0 go install -v github.com/owasp-amass/amass/v5/cmd/amass@main

# 安装漏洞扫描器
RUN go install github.com/hahwul/dalfox/v2@latest

# 第二阶段：运行时镜像
FROM ubuntu:24.04

# 避免交互式提示
ENV DEBIAN_FRONTEND=noninteractive

# 设置工作目录
WORKDIR /app

# 1. 安装基础工具和 Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    pipx \
    git \
    curl \
    wget \
    unzip \
    jq \
    tmux \
    nmap \
    masscan \
    libpcap-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 建立 python 软链接
RUN ln -s /usr/bin/python3 /usr/bin/python

# 2. 使用 pipx 安装 Python 扫描工具
ENV PATH="/root/.local/bin:$PATH"
RUN pipx install uro && \
    pipx install waymore && \
    pipx install dnsgen

# 3. 安装 Sublist3r（统一放在 /opt/xingrin/tools 下）
RUN git clone https://github.com/aboul3la/Sublist3r.git /opt/xingrin/tools/Sublist3r && \
    pip3 install --no-cache-dir -r /opt/xingrin/tools/Sublist3r/requirements.txt --break-system-packages

# 4. 从 go-builder 阶段复制 Go 环境和编译好的工具
ENV GOPATH=/root/go
ENV PATH=/usr/local/go/bin:$PATH:$GOPATH/bin
ENV GOPROXY=https://goproxy.cn,direct

# 5. 安装 uv（超快的 Python 包管理器）
RUN pip install uv --break-system-packages

# 安装 Python 依赖（使用 uv 并行下载，速度快 10-100 倍）
COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -r requirements.txt --break-system-packages && \
    rm -f /usr/local/lib/python3.*/dist-packages/argparse.py && \
    rm -rf /usr/local/lib/python3.*/dist-packages/__pycache__/argparse*

COPY --from=go-builder /usr/local/go /usr/local/go
COPY --from=go-builder /go/bin/* /usr/local/bin/
COPY --from=go-builder /usr/local/bin/massdns /usr/local/bin/massdns

# 6. 复制后端代码
COPY backend /app/backend
ENV PYTHONPATH=/app/backend

# 工作目录设置为 backend，方便运行 python -m 命令
WORKDIR /app/backend

# 默认命令（实际由 TaskDistributor 指定具体脚本）
CMD ["python", "--version"]
