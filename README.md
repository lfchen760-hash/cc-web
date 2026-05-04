# cc-web

浏览器远程控制本地 Claude Code，通过阿里云中转实现公网安全穿透。

## 系统概览

```
浏览器 (React SPA)         阿里云中转 (ws)         本地机器 (Node.js)
┌──────────────────┐  ws   ┌──────────────┐  ws   ┌──────────────────┐
│ ChatMessages     │◄─────►│ 静态文件服务  │◄─────►│ WS 客户端        │
│ MessageComponents│       │ WS 转发/路由  │       │ SessionManager   │
│ useStreamParser  │       │ 会话路由表    │       │ Claude CLI 子进程│
│ SessionSidebar   │       │              │       │ (NDJSON stdout)  │
└──────────────────┘       └──────────────┘       └────────┬─────────┘
                                                           │ HTTPS
                                                   ┌───────▼─────────┐
                                                   │  DeepSeek API   │
                                                   └─────────────────┘
```

## 快速开始

### 前置要求

- Node.js 22+
- npm 10+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` 命令可用)
- DeepSeek API Key

### 环境变量

```bash
# 本地服务 (packages/local)
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_API_KEY=sk-your-deepseek-key
export RELAY_URL=ws://localhost:3001/ws/local    # 中转地址
export RELAY_TOKEN=dev-token                      # 认证 token（与中转一致）

# 中转服务 (packages/relay)
export RELAY_PORT=3001
export RELAY_TOKEN=dev-token
```

### 安装 & 运行

```bash
# 1. 安装所有依赖
cd cc-web
npm install

# 2. 启动中转服务（终端 1）
npm run dev:relay

# 3. 启动本地服务（终端 2）
npm run dev:local

# 4. 启动前端开发服务器（终端 3）
npm run dev:frontend

# 5. 浏览器打开 http://localhost:5173
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm install` | 安装所有 workspaces 依赖 |
| `npm run dev:relay` | 启动中转服务 (默认 :3001) |
| `npm run dev:local` | 启动本地服务 |
| `npm run dev:frontend` | 启动前端 Vite 开发服务器 (:5173) |
| `npm run build:frontend` | 构建前端生产版本到 dist/ |

## 项目结构

```
cc-web/
├── package.json                  # npm workspaces 根配置
├── tsconfig.base.json            # 共享 TypeScript 配置
├── packages/
│   ├── frontend/                 # React 19 SPA (Vite 7 + TailwindCSS 4)
│   │   └── src/
│   │       ├── App.tsx           # 根组件：布局 + WebSocket Provider
│   │       ├── types.ts          # 消息类型定义（复用 + 扩展）
│   │       ├── hooks/            # WebSocket / 流解析 / 消息处理
│   │       ├── components/       # ChatMessages / MessageComponents / 侧边栏
│   │       ├── utils/            # UnifiedMessageProcessor / 消息转换
│   │       └── config/           # WebSocket URL 配置
│   ├── relay/                    # 阿里云中转服务 (Node.js + ws)
│   │   └── src/
│   │       ├── index.ts          # HTTP + WS 双通道服务器
│   │       ├── ws-relay.ts       # 消息转发 + 路由表 + 心跳
│   │       ├── static.ts         # 静态文件服务 + SPA fallback
│   │       └── config.ts         # 端口 / token 配置
│   ├── local/                    # 本地服务 (Node.js)
│   │   └── src/
│   │       ├── index.ts          # 入口：连接中转 + 消息路由
│   │       ├── ws-client.ts      # WebSocket 客户端（自动重连）
│   │       ├── sdk-runner.ts     # spawn claude CLI → NDJSON
│   │       ├── session-manager.ts # 会话生命周期 + JSON 持久化
│   │       └── config.ts         # 中转地址 / 认证配置
│   └── shared/                   # 前后端共享类型
│       └── types.ts              # StreamResponse / ChatRequest
```

## 架构要点

### 通信协议

全部通信使用 NDJSON over WebSocket：

- **浏览器 ↔ 中转** (`/ws/browser`)：`{ type: "chat" | "create_session" | "stop_session" | "list_sessions" }`
- **中转 ↔ 本地** (`/ws/local`)：认证注册 + 双向转发
- **数据消息**：`{ type: "claude_json", data: <SDKMessage> }` 格式，与 claude-code-webui 完全兼容

### 复用 claude-code-webui

前端消息处理管线直接复用 [claude-code-webui](https://github.com/sugyan/claude-code-webui)：

- `UnifiedMessageProcessor` — SDK 消息 → UI AllMessage 转换
- `useStreamParser` — NDJSON 逐行解析（**内部未修改**）
- `MessageComponents.tsx` — 8 个消息渲染组件（Chat/Thinking/Tool/ToolResult/Plan/Todo/System/Loading）
- `ChatMessages.tsx` — 消息列表 + 类型分发

### Claude CLI 调用

使用 `child_process.spawn('claude', ...)` 而非 npm SDK（Windows 兼容性）：

```bash
claude --output-format stream-json --verbose -p "用户输入"
```

每条 stdout 行 → `JSON.parse` → `{ type: "claude_json", data: <parsed> }` → WebSocket 发送

### 会话持久化

```
data/sessions/
├── index.json          # ["uuid-1", "uuid-2"]
├── uuid-1.json         # { sessionId, projectPath, messages: [...], ... }
└── uuid-2.json
```

### 安全

- 中转 ↔ 本地：预共享 token 认证 (`RELAY_TOKEN`)
- 中转 ↔ 浏览器：无认证（MVP 单用户）
- 静态文件服务：路径穿越防护
- 本地服务：不暴露任何端口，仅作 WS 客户端

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + TypeScript 5 |
| 构建 | Vite 7 |
| 样式 | TailwindCSS 4 |
| 中转/本地 | Node.js + ws + TypeScript |
| AI 进程 | Claude CLI (`child_process.spawn`) |
| AI 后端 | DeepSeek API |

## 部署到阿里云

```bash
# 1. 构建前端
npm run build:frontend

# 2. 上传到云服务器
# - packages/relay/ （含 node_modules）
# - packages/frontend/dist/ （STATIC_DIR 指向此处）
# - packages/shared/

# 3. 安装依赖 & 启动中转
npm install
export RELAY_PORT=3001
export RELAY_TOKEN=your-secure-token
npm -w packages/relay run start

# 4. 配置 nginx 反代（HTTPS + wss）
# proxy_pass http://127.0.0.1:3001
# 需配置 Upgrade/Connection 头以支持 WebSocket
```
