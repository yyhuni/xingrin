<h1 align="center">Xingrin - 星环</h1>

<p align="center">
  <b>一款现代化的企业级漏洞扫描与资产管理平台</b><br>
  提供自动化安全检测、资产发现、漏洞管理等功能
</p>

---

## ✨ 功能特性

### 🎯 目标与资产管理
- **组织管理** - 多层级目标组织，灵活分组
- **目标管理** - 支持域名、IP、URL 等多种目标类型
- **资产发现** - 子域名、网站、端点、目录自动发现
- **资产快照** - 扫描结果快照对比，追踪资产变化

### 🔍 漏洞扫描
- **多引擎支持** - 集成 Nuclei 等主流扫描引擎
- **自定义流程** - YAML 配置扫描流程，灵活编排
- **漏洞分级** - 严重/高危/中危/低危 四级分类
- **定时扫描** - Cron 表达式配置，自动化周期扫描

### 🖥️ 分布式架构
- **多节点扫描** - 支持部署多个 Worker 节点，横向扩展扫描能力
- **本地节点** - 零配置，安装即自动注册本地 Docker Worker
- **远程节点** - SSH 一键部署远程 VPS 作为扫描节点
- **智能调度** - 自动分发任务到空闲节点，负载均衡
- **节点监控** - 实时心跳检测，CPU/内存/磁盘状态监控
- **断线重连** - 节点离线自动检测，恢复后自动重新接入

### 📊 可视化界面
- **数据统计** - 资产/漏洞统计仪表盘
- **实时通知** - WebSocket 消息推送
- **暗色主题** - 支持明暗主题切换

---

## 🛠️ 技术栈

- **前端**: Next.js + React + TailwindCSS
- **后端**: Django + Django REST Framework
- **数据库**: PostgreSQL + Redis
- **部署**: Docker + Nginx
- **扫描引擎**: Nuclei

---

## 📦 快速开始

### 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- 推荐 2核 4G 内存起步
- 10GB+ 磁盘空间

### 一键安装

```bash
# 克隆项目
git clone https://github.com/yyhuni/xingrin.git
cd xingrin

# 安装并启动（生产模式）
sudo ./install.sh

# 开发模式
sudo ./install.sh --dev
```

### 访问服务

- **Web 界面**: `https://localhost` 或 `http://localhost`

### 常用命令

```bash
# 启动服务
sudo ./start.sh

# 停止服务
sudo ./stop.sh

# 重启服务
sudo ./restart.sh

# 卸载
sudo ./uninstall.sh

# 更新
sudo ./update.sh
```

## ⚠️ 免责声明

**重要：请在使用前仔细阅读**

1. 本工具仅供**授权的安全测试**和**安全研究**使用
2. 使用者必须确保已获得目标系统的**合法授权**
3. **严禁**将本工具用于未经授权的渗透测试或攻击行为
4. 未经授权扫描他人系统属于**违法行为**，可能面临法律责任
5. 开发者**不对任何滥用行为负责**

使用本工具即表示您同意：
- 仅在合法授权范围内使用
- 遵守所在地区的法律法规
- 承担因滥用产生的一切后果

## 📄 许可证

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE) 许可证。

### 允许的用途

- ✅ 个人学习和研究
- ✅ 非商业安全测试
- ✅ 教育机构使用
- ✅ 非营利组织使用

### 禁止的用途

- ❌ **商业用途**（包括但不限于：出售、商业服务、SaaS 等）
- ❌ 未经授权的渗透测试
- ❌ 任何违法行为

如需商业授权，请联系作者。

## 🤝 反馈与贡献

- 🐛 **发现 Bug？** 欢迎提交 [Issue](https://github.com/yyhuni/xingrin/issues)
- 💡 **有新想法？** 欢迎提交功能建议
- 🔧 **想参与开发？** 欢迎提交 Pull Request

## 📧 联系

- GitHub: [@yyhuni](https://github.com/yyhuni)
- 微信公众号: **洋洋的小黑屋**

<img src="docs/wechat-qrcode.png" alt="微信公众号" width="200">
