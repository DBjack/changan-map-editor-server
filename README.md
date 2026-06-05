# 长安机器人地图编辑服务端

基于 NestJS 框架开发的机器人地图编辑系统后端服务，提供图层数据的增删改查功能。

## 技术栈

- **框架**: NestJS 11
- **语言**: TypeScript
- **数据库**: MySQL
- **ORM**: TypeORM
- **API 文档**: Swagger
- **包管理器**: pnpm

## 项目结构

```
changan-map-editor/
├── src/
│   ├── common/           # 公共模块
│   │   ├── database-init.service.ts    # 数据库初始化服务
│   │   ├── http-exception.filter.ts    # 全局异常过滤器
│   │   ├── response.ts                 # 统一响应格式
│   │   └── transform.interceptor.ts    # 响应拦截器
│   ├── dto/              # 数据传输对象
│   │   └── Layer.ts      # 图层 DTO
│   ├── entity/           # 数据库实体
│   │   └── layerEntity.ts # 图层实体
│   ├── layer/            # 图层模块
│   │   ├── layer.controller.ts   # 控制器
│   │   ├── layer.service.ts      # 服务层
│   │   └── layer.module.ts       # 模块定义
│   ├── vo/               # 视图对象
│   │   └── layer.vo.ts   # 图层 VO
│   ├── app.module.ts     # 主模块
│   └── main.ts           # 入口文件
├── .env                  # 开发环境配置
├── .env.production       # 生产环境配置
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 8.0
- pnpm

### 安装依赖

```bash
pnpm install
```

### 配置数据库

1. 复制 `.env` 文件，根据实际需求修改配置：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=Root@123456
DB_DATABASE=layer

# 服务器配置
PORT=3000

# 环境配置
NODE_ENV=development
DB_SYNC=true
API_PREFIX=v1
```

2. 初始化数据库（可选）：

```bash
node scripts/init-db.js
```

### 运行项目

```bash
# 开发模式（热重载）
pnpm run start:dev

# 调试模式
pnpm run start:debug

# 生产模式
pnpm run build
pnpm run start:prod
```

### 访问 API 文档

启动项目后，访问 Swagger 文档：

```
http://localhost:3000/v1/api-docs
```

## API 接口

### 图层管理

所有接口均以 `/v1/layer` 为前缀

#### 1. 获取图层列表

```
GET /v1/layer/list/:id
```

**参数**:

- `id`: 图层 ID

**响应示例**:

```json
{
  "code": 200,
  "data": [],
  "message": "success"
}
```

#### 2. 更新图层

```
POST /v1/layer/update
```

**请求体**:

```json
{
  "id": 1,
  "name": "图层名称",
  "data": {}
}
```

#### 3. 删除图层

```
GET /v1/layer/delete/:id
```

**参数**:

- `id`: 图层 ID

## License

UNLICENSED
