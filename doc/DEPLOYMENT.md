# 长安地图编辑服务端 - 部署与 CI/CD 文档

## 目录

- [1. 服务器环境准备](#1-服务器环境准备)
- [2. 数据库配置](#2-数据库配置)
- [3. 项目部署](#3-项目部署)
- [4. PM2 进程管理](#4-pm2-进程管理)
- [5. Nginx 反向代理配置](#5-nginx-反向代理配置)
- [6. HTTPS 配置](#6-https-配置)
- [7. 防火墙配置](#7-防火墙配置)
- [8. GitHub Actions CI/CD 配置](#8-github-actions-cicd-配置)
- [9. 常用运维命令](#9-常用运维命令)
- [10. 常见问题排查](#10-常见问题排查)

---

## 1. 服务器环境准备

### 1.1 服务器配置要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| 系统 | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| 内存 | 2GB | 4GB |
| CPU | 1核 | 2核 |
| 带宽 | 1Mbps | 5Mbps |

### 1.2 安装必要软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js（LTS 版本）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# 安装 MySQL
sudo apt install -y mysql-server

# 安装 Nginx
sudo apt install -y nginx

# 安装 PM2
pnpm add -g pm2
```

---

## 2. 数据库配置

### 2.1 登录 MySQL

```bash
sudo mysql -u root -p
```

### 2.2 创建数据库和用户

```sql
-- 创建数据库
CREATE DATABASE map CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'map_user'@'localhost' IDENTIFIED BY 'YourStrongPassword';

-- 授权
GRANT ALL PRIVILEGES ON map.* TO 'map_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

### 2.3 配置 MySQL 安全

```bash
sudo mysql_secure_installation
```

---

## 3. 项目部署

### 3.1 创建项目目录

```bash
mkdir -p /var/www/changan-map-editor
cd /var/www/changan-map-editor
```

### 3.2 克隆项目代码

```bash
git clone https://github.com/DBjack/changan-map-editor-server.git .
```

### 3.3 安装依赖

```bash
pnpm install --prod
```

### 3.4 构建项目

```bash
pnpm run build
```

### 3.5 创建环境变量文件

```bash
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3000
API_PREFIX=v1

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=map_user
DB_PASSWORD=YourStrongPassword
DB_DATABASE=map
DB_SYNC=false

# Swagger 配置
ENABLE_SWAGGER=false

# 日志配置
LOG_LEVEL=info
EOF
```

> ⚠️ **重要**：生产环境务必设置 `DB_SYNC=false`，避免数据库表结构被意外修改！

### 3.6 创建日志目录

```bash
mkdir -p logs
```

---

## 4. PM2 进程管理

### 4.1 PM2 配置文件

项目根目录已包含 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'changan-map-editor',
      script: 'dist/main.js',
      instances: 'max',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        ENABLE_SWAGGER: 'false',
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

**配置说明**：
- `instances: 'max'`：自动根据 CPU 核心数启动多个实例
- `watch: false`：生产环境关闭热更新
- `ENABLE_SWAGGER: 'false'`：生产环境禁用 Swagger
- `max_memory_restart: '1G'`：内存超过 1G 自动重启

### 4.2 启动应用

```bash
pm2 start ecosystem.config.js --env production
```

### 4.3 设置开机自启

```bash
pm2 startup
pm2 save
```

### 4.4 查看状态

```bash
pm2 status
pm2 logs changan-map-editor
```

---

## 5. Nginx 反向代理配置

### 5.1 创建 Nginx 配置文件

```bash
sudo cat > /etc/nginx/sites-available/changan-map-editor << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # 重定向 HTTP 到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 前端静态文件（如果有）
    location / {
        root /var/www/changan-map-editor-frontend;
        try_files $uri $uri/ /index.html;
    }

    # API 请求代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 限制请求大小
    client_max_body_size 50M;

    # 日志配置
    access_log /var/log/nginx/changan-map-editor.access.log;
    error_log /var/log/nginx/changan-map-editor.error.log;
}
EOF
```

### 5.2 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/changan-map-editor /etc/nginx/sites-enabled/
```

### 5.3 测试配置

```bash
sudo nginx -t
```

### 5.4 重启 Nginx

```bash
sudo systemctl restart nginx
```

---

## 6. HTTPS 配置

### 6.1 安装 Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 获取证书

```bash
sudo certbot --nginx -d your-domain.com
```

### 6.3 自动续期

```bash
sudo certbot renew --dry-run
```

---

## 7. 防火墙配置

```bash
# 允许 HTTP 和 HTTPS
sudo ufw allow 'Nginx Full'

# 允许 SSH
sudo ufw allow ssh

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

---

## 8. GitHub Actions CI/CD 配置

### 8.1 创建工作流文件

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      # 1. 检出代码
      - name: Checkout code
        uses: actions/checkout@v4

      # 2. 设置 Node.js 环境
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      # 3. 安装依赖
      - name: Install dependencies
        run: pnpm install

      # 4. 代码检查
      - name: Lint
        run: pnpm run lint

      # 5. 运行测试
      - name: Test
        run: pnpm run test

      # 6. 构建项目
      - name: Build
        run: pnpm run build

      # 7. 部署到服务器（使用 SSH）
      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/changan-map-editor
            git pull origin main
            pnpm install --prod
            pm2 restart changan-map-editor
```

### 8.2 配置 GitHub Secrets

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

| Secret | 值 | 说明 |
|--------|-----|------|
| `SERVER_HOST` | 服务器 IP 地址 | 如 `123.45.67.89` |
| `SERVER_USERNAME` | SSH 用户名 | 如 `root` |
| `SSH_PRIVATE_KEY` | SSH 私钥内容 | 用于认证 |

### 8.3 生成 SSH 密钥对

```bash
# 生成密钥对
ssh-keygen -t ed25519 -C "deploy@github.com"

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server-ip

# 将私钥内容复制到 GitHub Secrets
cat ~/.ssh/id_ed25519
```

### 8.4 CI/CD 工作流说明

```
┌──────────────────────────────────────────────────────────────────┐
│                    GitHub Actions 工作流                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  开发者 push 代码到 main 分支                                     │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                    GitHub Actions                        │     │
│  │                                                         │     │
│  │  ┌─────────────┐                                         │     │
│  │  │  代码检出    │ → 检出最新代码                           │     │
│  │  └──────┬──────┘                                         │     │
│  │         ▼                                                │     │
│  │  ┌─────────────┐                                         │     │
│  │  │  设置 Node.js │ → 安装 Node.js 20                     │     │
│  │  └──────┬──────┘                                         │     │
│  │         ▼                                                │     │
│  │  ┌─────────────┐                                         │     │
│  │  │  安装依赖    │ → pnpm install                          │     │
│  │  └──────┬──────┘                                         │     │
│  │         ▼                                                │     │
│  │  ┌─────────────┐                                         │     │
│  │  │  代码检查    │ → pnpm run lint                         │     │
│  │  └──────┬──────┘                                         │     │
│  │         ▼                                                │     │
│  │  ┌─────────────┐                                         │     │
│  │  │  运行测试    │ → pnpm run test                         │     │
│  │  └──────┬──────┘                                         │     │
│  │         ▼                                                │     │
│  │  ┌─────────────┐                                         │     │
│  │  │  构建项目    │ → pnpm run build                        │     │
│  │  └──────┬──────┘                                         │     │
│  │         ▼                                                │     │
│  │  ┌─────────────┐                                         │     │
│  │  │  部署到服务器  │ → SSH 连接 → git pull → pm2 restart   │     │
│  │  └─────────────┘                                         │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. 常用运维命令

### 9.1 PM2 管理命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs changan-map-editor
pm2 logs changan-map-editor --lines 100

# 重启应用
pm2 restart changan-map-editor

# 停止应用
pm2 stop changan-map-editor

# 删除应用
pm2 delete changan-map-editor

# 重载配置
pm2 reload ecosystem.config.js

# 查看进程信息
pm2 info changan-map-editor
```

### 9.2 日志管理

```bash
# 查看 PM2 日志
tail -f logs/pm2-combined.log

# 查看 Nginx 日志
tail -f /var/log/nginx/changan-map-editor.access.log
tail -f /var/log/nginx/changan-map-editor.error.log

# 查看系统日志
tail -f /var/log/syslog
```

### 9.3 手动更新部署

```bash
# 1. 拉取最新代码
cd /var/www/changan-map-editor
git pull origin main

# 2. 安装依赖（如果有新增）
pnpm install --prod

# 3. 构建
pnpm run build

# 4. 重启应用
pm2 restart changan-map-editor
```

### 9.4 数据库备份

```bash
# 备份数据库
mysqldump -u map_user -p map > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复数据库
mysql -u map_user -p map < backup_20260617_100000.sql
```

---

## 10. 常见问题排查

### 10.1 应用启动失败

```bash
# 检查端口是否被占用
lsof -i :3000

# 查看 PM2 错误日志
pm2 logs changan-map-editor --lines 50

# 检查 Node.js 版本
node --version
```

### 10.2 数据库连接失败

```bash
# 检查数据库服务状态
sudo systemctl status mysql

# 测试数据库连接
mysql -u map_user -p -e "SELECT 1"

# 检查防火墙是否阻止了数据库连接
sudo ufw status
```

### 10.3 404 错误

```bash
# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 访问日志
tail -f /var/log/nginx/changan-map-editor.access.log

# 检查应用是否正常运行
pm2 status
```

### 10.4 502 Bad Gateway

```bash
# 检查应用是否正常运行
pm2 status

# 查看应用日志
pm2 logs changan-map-editor

# 检查端口是否可访问
curl http://localhost:3000/api/v1/layer/list
```

### 10.5 证书过期

```bash
# 检查证书状态
sudo certbot certificates

# 手动续期
sudo certbot renew

# 重启 Nginx
sudo systemctl restart nginx
```

### 10.6 内存不足

```bash
# 查看内存使用情况
free -h

# 查看进程内存使用
pm2 monit

# 调整 PM2 内存限制
# 修改 ecosystem.config.js 中的 max_memory_restart
```

---

## 附录：项目配置文件说明

### .env.production

```env
NODE_ENV=production           # 运行环境
PORT=3000                    # 服务端口
API_PREFIX=v1                # API 前缀

DB_HOST=localhost            # 数据库地址
DB_PORT=3306                 # 数据库端口
DB_USERNAME=map_user         # 数据库用户名
DB_PASSWORD=your_password    # 数据库密码
DB_DATABASE=map              # 数据库名称
DB_SYNC=false                # 是否自动同步表结构（生产环境必须关闭）

ENABLE_SWAGGER=false         # 是否启用 Swagger（生产环境建议关闭）
LOG_LEVEL=info               # 日志级别
```

### ecosystem.config.js

```javascript
module.exports = {
  apps: [
    {
      name: 'changan-map-editor',      // 应用名称
      script: 'dist/main.js',          // 启动脚本
      instances: 'max',                // 启动实例数（max=CPU核心数）
      autorestart: true,               // 自动重启
      watch: false,                    // 禁用热更新
      max_memory_restart: '1G',        // 内存超过 1G 自动重启
      env_production: {
        NODE_ENV: 'production',
        ENABLE_SWAGGER: 'false',
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
    },
  ],
};
```

---

## 部署完成后的访问地址

| 服务 | 地址 |
|------|------|
| API 接口 | `https://your-domain.com/api/v1/layer/list` |
| Swagger 文档 | `https://your-domain.com/api-docs`（如果启用） |
| PM2 管理 | `http://your-server-ip:9615`（需要安装 pm2-web） |

---

## 安全建议

1. **定期更新系统**：`sudo apt update && sudo apt upgrade -y`
2. **禁用 root 远程登录**：编辑 `/etc/ssh/sshd_config`，设置 `PermitRootLogin no`
3. **使用密钥登录**：禁用密码登录，使用 SSH 密钥
4. **定期备份数据库**：设置定时任务自动备份
5. **监控系统资源**：使用 `htop` 或 `prometheus` + `grafana`
6. **设置告警**：当应用宕机或资源使用率过高时发送通知