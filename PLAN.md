# cc-web: 浏览器远程控制本地 Claude Code

## 背景

构建一个可通过公网浏览器远程控制本地 Claude Code 进行代码开发的系统 `cc-web`。这是一个全新的独立项目。

1. **公网浏览器访问，操作本地 Claude Code** — 无需公网 IP，通过阿里云中转实现安全穿透
2. **基于 SDK NDJSON 流的结构化交互** — 不依赖终端模拟，用专用 React 组件渲染思考折叠、工具调用卡片、代码差异高亮
3. **多会话并行** — 每个会话绑定独立项目，支持会话历史持久化与恢复

用户使用 DeepSeek API 作为 AI 后端（通过环境变量配置端点）。

## MVP 范围

单用户、单台本地机器、基础聊天、工具调用展示，无终端模拟。

---

## 系统架构

```
浏览器 (React SPA)                       阿里云中转 (Node.js + ws)               本地机器 (Node.js)
┌──────────────────────┐    WebSocket    ┌──────────────────────┐    WebSocket    ┌──────────────────────┐
│  ChatMessages        │◄──────────────►│  静态文件服务          │◄──────────────►│  WS 客户端            │
│  MessageComponents   │                │  WS 转发/路由          │                │  SessionManager      │
│  UnifiedMsgProcessor │                │  会话路由表            │                │  Claude CLI 子进程   │
│  useStreamParser     │                │                       │                │                      │
│  SessionSidebar      │                │                       │                │  claude CLI          │
└──────────────────────┘                └──────────────────────┘                │  (NDJSON stdout)     │
                                                                                └──────────┬───────────┘
                                                                                           │ HTTPS
                                                                                ┌──────────▼───────────┐
                                                                                │  DeepSeek API        │
                                                                                └──────────────────────┘
```

**数据流**：
1. 浏览器 → WS → 中转：`{ type: "chat", sessionId, text }`
2. 中转查路由表，转发到对应本地服务
3. 本地服务 spawn `claude` CLI 子进程，读取 NDJSON stdout
4. 本地服务 → WS → 中转：逐条转发 StreamResponse（与 claude-code-webui 格式兼容）
5. 中转 → WS → 浏览器：逐条送达
6. 前端 `useStreamParser` → `UnifiedMessageProcessor` → `MessageComponents` 渲染

---

## 复用策略：claude-code-webui

前端消息封装和消息组件直接复用 [claude-code-webui](https://github.com/sugyan/claude-code-webui)（已下载到 `claude-code-webui-main/`）。

### 直接复制的文件

| 源路径 | 目标路径 | 说明 |
|--------|----------|------|
| `frontend/src/types.ts` | `src/types.ts` | 消息类型定义（保持原名以兼容 import 路径） |
| `frontend/src/components/MessageComponents.tsx` | `src/components/MessageComponents.tsx` | 8 个消息渲染组件 |
| `frontend/src/components/messages/MessageContainer.tsx` | `src/components/messages/MessageContainer.tsx` | 消息气泡对齐容器 |
| `frontend/src/components/messages/CollapsibleDetails.tsx` | `src/components/messages/CollapsibleDetails.tsx` | 可折叠详情组件 |
| `frontend/src/components/chat/ChatMessages.tsx` | `src/components/ChatMessages.tsx` | 消息列表 + 类型分发（import 路径已修复） |
| `frontend/src/components/TimestampComponent.tsx` | `src/components/TimestampComponent.tsx` | 时间戳组件 |
| `frontend/src/utils/UnifiedMessageProcessor.ts` | `src/utils/UnifiedMessageProcessor.ts` | SDK 消息 → UI 消息处理器 |
| `frontend/src/utils/messageConversion.ts` | `src/utils/messageConversion.ts` | 消息转换函数（添加 as 类型断言） |
| `frontend/src/utils/messageTypes.ts` | `src/utils/messageTypes.ts` | SDK 类型守卫 |
| `frontend/src/utils/contentUtils.ts` | `src/utils/contentUtils.ts` | 内容预览、行数指示器 |
| `frontend/src/utils/toolUtils.ts` | `src/utils/toolUtils.ts` | 工具参数格式化 |
| `frontend/src/utils/constants.ts` | `src/utils/constants.ts` | UI 常量 |
| `frontend/src/utils/id.ts` | `src/utils/id.ts` | ID 生成工具 |
| `frontend/src/utils/time.ts` | `src/utils/time.ts` | 时间格式化 |
| `frontend/src/utils/environment.ts` | `src/utils/environment.ts` | 环境检测 |
| `frontend/src/utils/pathUtils.ts` | `src/utils/pathUtils.ts` | 路径工具 |
| `frontend/src/hooks/streaming/useStreamParser.ts` | `src/hooks/streaming/useStreamParser.ts` | NDJSON 解析（无需修改） |
| `frontend/src/hooks/streaming/useMessageProcessor.ts` | `src/hooks/streaming/useMessageProcessor.ts` | 消息处理 hook |
| `frontend/src/hooks/useClaudeStreaming.ts` | `src/hooks/useClaudeStreaming.ts` | 流处理入口 hook |
| `frontend/src/hooks/useMessageConverter.ts` | `src/hooks/useMessageConverter.ts` | 消息转换 hook |
| `shared/types.ts` | `packages/shared/types.ts` | StreamResponse、ChatRequest 共享类型 |

### 实际与计划差异

与 plan.txt 相比，实际实现有以下调整：

1. **`types.ts` 位置**：计划为 `types/messages.ts`，实际为 `src/types.ts`（保持原名以兼容 claude-code-webui 的 import 路径 `../types`）
2. **`hooks/streaming/` 目录保留**：`useStreamParser.ts` 和 `useMessageProcessor.ts` 保留在原 `streaming/` 子目录，未提升到 `hooks/`
3. **额外依赖文件**：复制了 `id.ts`、`time.ts`、`environment.ts`、`pathUtils.ts`、`useClaudeStreaming.ts`、`useMessageProcessor.ts` 等被引用的依赖文件
4. **`ChatMessages.tsx` import 修复**：由于从 `chat/` 子目录提升到 `components/` 根目录，import 路径从 `../../types` → `../types`，`../MessageComponents` → `./MessageComponents`
5. **`messageConversion.ts` 类型修复**：`convertSystemMessage` 和 `convertResultMessage` 添加 `as SystemMessage` 类型断言解决 SDK 类型兼容问题
6. **无 `tailwind.config.js`**：TailwindCSS v4 通过 CSS `@import "tailwindcss"` 配置，无需独立配置文件
7. **无 `styles/` 目录**：`index.css` 放在 `src/` 根目录

### 无需适配

- **`useStreamParser.ts`** 内部逻辑完全不变 — 输入源切换（fetch → WebSocket）在 `ChatView.tsx` 调用侧完成，无需改 hook

---

## 项目结构（实际）

```
cc-web/
├── package.json                 # npm workspaces 根配置
├── tsconfig.base.json           # 共享 TypeScript 配置
├── PLAN.md                      # 本文件
├── README.md                    # 项目说明
├── packages/
│   ├── frontend/                # React SPA
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx                          # 新建：WebSocket Provider + 布局
│   │       ├── index.css                        # TailwindCSS 入口
│   │       ├── types.ts                         # 复制+扩展：消息类型 + WS 协议类型
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts              # 新建：WS 连接 + 重连
│   │       │   ├── useClaudeStreaming.ts        # 复制：流处理入口
│   │       │   ├── useMessageConverter.ts       # 复制：消息转换 hook
│   │       │   └── streaming/
│   │       │       ├── useStreamParser.ts       # 复制：NDJSON 解析（未修改）
│   │       │       └── useMessageProcessor.ts   # 复制：消息处理
│   │       ├── components/
│   │       │   ├── ChatView.tsx                 # 新建：主聊天视图
│   │       │   ├── ChatMessages.tsx             # 复制+修复：消息列表 + 类型分发
│   │       │   ├── ChatInput.tsx                # 新建：输入框
│   │       │   ├── MessageComponents.tsx        # 复制：8 个消息组件
│   │       │   ├── SessionSidebar.tsx           # 新建：会话列表
│   │       │   ├── StatusBar.tsx                # 新建：状态栏
│   │       │   ├── TimestampComponent.tsx       # 复制：时间戳
│   │       │   └── messages/
│   │       │       ├── MessageContainer.tsx     # 复制：对齐容器
│   │       │       └── CollapsibleDetails.tsx   # 复制：折叠详情
│   │       ├── utils/
│   │       │   ├── UnifiedMessageProcessor.ts   # 复制：核心消息处理器
│   │       │   ├── messageConversion.ts         # 复制+修复：消息转换
│   │       │   ├── messageTypes.ts              # 复制：SDK 类型守卫
│   │       │   ├── contentUtils.ts              # 复制：内容预览
│   │       │   ├── toolUtils.ts                 # 复制：工具格式化
│   │       │   ├── constants.ts                 # 复制：UI 常量
│   │       │   ├── id.ts                        # 复制：ID 工具
│   │       │   ├── time.ts                      # 复制：时间工具
│   │       │   ├── environment.ts               # 复制：环境检测
│   │       │   └── pathUtils.ts                 # 复制：路径工具
│   │       └── config/
│   │           └── ws.ts                        # 新建：WS URL 配置
│   ├── relay/                   # 阿里云中转服务
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                  # 入口：HTTP + WS 服务器（双通道）
│   │       ├── config.ts                 # 端口、静态目录、认证配置
│   │       ├── static.ts                 # 静态文件服务（托管前端 dist + SPA fallback）
│   │       ├── ws-relay.ts               # WebSocket 消息转发 + 路由表 + 心跳
│   │       └── types.ts                  # 中转层类型
│   ├── local/                   # 本地服务
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                  # 入口：连接中转，注册 + 消息路由
│   │       ├── config.ts                 # 中转地址、认证 token、节点 ID
│   │       ├── ws-client.ts              # WebSocket 客户端（自动重连、心跳响应）
│   │       ├── session-manager.ts        # 会话生命周期 + 持久化（JSON 文件）
│   │       ├── sdk-runner.ts             # spawn claude CLI，读取 NDJSON stdout
│   │       └── types.ts                  # StreamResponse 等类型
│   └── shared/                  # 前后端共享类型
│       └── types.ts                      # StreamResponse, ChatRequest
```

---

## 技术选型

| 层级 | 技术 | 作用 |
|------|------|------|
| 前端框架 | React 19 + TypeScript 5 | UI 组件 |
| 构建工具 | Vite 7 + SWC | 开发/构建 |
| 样式 | TailwindCSS 4 | 与 claude-code-webui 组件样式兼容 |
| 消息处理 | UnifiedMessageProcessor | 从 claude-code-webui 复制 |
| NDJSON 解析 | useStreamParser | 从 claude-code-webui 复制（内部未修改） |
| 中转服务 | Node.js + ws + TypeScript | WebSocket 转发 + 静态文件 |
| 本地服务 | Node.js + ws (client) + TypeScript | 连接中转，驱动 CLI |
| AI 进程 | claude CLI（child_process.spawn） | `--output-format stream-json` 输出 NDJSON |
| AI 后端 | DeepSeek API | 通过环境变量 ANTHROPIC_BASE_URL 配置 |
| 通信协议 | NDJSON over WebSocket | 与 claude-code-webui 格式原生兼容 |

> **与 plan.txt 差异**：本地服务使用 `child_process.spawn('claude', ...)` 而非 `@anthropic-ai/claude-code` SDK，因为该 SDK 的 preinstall 脚本检查不支持 Windows。前端通过 `npm install --ignore-scripts` 安装 SDK 仅用于 TypeScript 类型。

---

## 通信协议：NDJSON over WebSocket

### 浏览器 → 中转

```jsonc
{ "type": "chat",           "sessionId": "s1", "text": "帮我写个函数" }
{ "type": "create_session",  "projectPath": "/path/to/project" }
{ "type": "stop_session",    "sessionId": "s1" }
{ "type": "list_sessions" }
```

### 中转 → 浏览器（StreamResponse，与 claude-code-webui 兼容）

```jsonc
{ "type": "claude_json", "data": { "type": "system", "subtype": "init", ... } }
{ "type": "claude_json", "data": { "type": "assistant", "message": { "content": [...] } } }
{ "type": "claude_json", "data": { "type": "user", "message": { "content": [...] } } }
{ "type": "claude_json", "data": { "type": "result", "subtype": "success", ... } }
{ "type": "error",   "error": "错误描述" }
{ "type": "done" }
{ "type": "aborted" }
{ "type": "session_info", "sessionId": "s1", "projectPath": "...", "status": "running" }
```

### 中转 ↔ 本地服务

```jsonc
// 注册
{ "type": "register", "nodeId": "local-01", "token": "auth-token" }
// 心跳
{ "type": "ping" } / { "type": "pong" }
// 聊天
{ "type": "chat",           "sessionId": "s1", "text": "...", "projectPath": "..." }
{ "type": "create_session",  "projectPath": "..." }
{ "type": "stop_session",    "sessionId": "s1" }
{ "type": "list_sessions" }
// 响应
{ "type": "claude_json",    "sessionId": "s1", "data": { ... } }
{ "type": "done",           "sessionId": "s1" }
{ "type": "session_info",   ... }
{ "type": "sessions_list",  "sessions": [...] }
```

---

## 前端组件设计

### 组件树

```
App
├── SessionSidebar          # 左侧 280px 侧边栏
│   ├── SessionList         # 会话列表（路径显示、状态指示、消息计数、停止按钮）
│   └── NewSessionButton    # 新建会话（prompt 输入项目路径）
└── ChatView                # 右侧主区域（WS 消息 → useStreamParser → 渲染）
    ├── ChatMessages         # 消息列表 + 按 AllMessage.type 分发
    │   └── renderMessage() #
    │       ├── ChatMessageComponent      # user/assistant 聊天气泡
    │       ├── ThinkingMessageComponent  # 思考折叠（紫色，默认展开）
    │       ├── ToolMessageComponent      # 工具调用通知（翡翠色）
    │       ├── ToolResultMessageComponent # 工具结果（折叠详情，Edit/Bash/Grep 预览）
    │       ├── PlanMessageComponent      # 计划展示（蓝色边框）
    │       ├── TodoMessageComponent      # Todo 列表（琥珀色，状态图标）
    │       ├── SystemMessageComponent    # 系统通知（init/result/error/hooks）
    │       └── LoadingComponent          # "Thinking..." 加载动画
    ├── StatusBar            # 底部状态栏（连接状态、会话 ID、模型名、Esc 提示）
    └── ChatInput            # 输入框（Enter 发送 / Shift+Enter 换行 / Esc 终止）
```

### 消息渲染策略

| 消息类型 | 组件 | 颜色方案 |
|---------|------|---------|
| `chat` (user) | `ChatMessageComponent` | 右对齐蓝色 |
| `chat` (assistant) | `ChatMessageComponent` | 左对齐灰色 |
| `thinking` | `ThinkingMessageComponent` | 紫色折叠，默认展开 |
| `tool` | `ToolMessageComponent` | 翡翠色卡片 |
| `tool_result` | `ToolResultMessageComponent` | 翡翠色折叠详情 |
| `plan` | `PlanMessageComponent` | 蓝色容器 |
| `todo` | `TodoMessageComponent` | 琥珀色卡片 |
| `system` | `SystemMessageComponent` | 蓝色折叠详情 |

---

## 核心模块设计

### 1. SDK Runner (`packages/local/src/sdk-runner.ts`)

> **与 plan.txt 差异**：使用 `child_process.spawn('claude', ...)` 而非 `@anthropic-ai/claude-code` SDK。原因：SDK 不支持 Windows。

```
spawn('claude', ['--output-format', 'stream-json', '--verbose', '-p', prompt], { cwd })
  → stdout 逐行 readline
  → JSON.parse(line) → { type: "claude_json", data: <SDKMessage> }
  → onMessage callback
```

- 通过环境变量 `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY` 接入 DeepSeek
- 支持 `--resume <sessionId>` 恢复会话
- 支持 `AbortSignal` 取消（`child.kill('SIGTERM')`）
- stderr 不发送给前端

### 2. SessionManager (`packages/local/src/session-manager.ts`)

```typescript
interface Session {
  sessionId: string;        // UUID
  projectPath: string;      // 项目目录
  status: 'idle' | 'running' | 'error';
  messages: StreamResponse[];       // 消息历史
  controller: AbortController | null;
  createdAt: number;
}
```

方法：`createSession`, `sendMessage`, `stopSession`, `deleteSession`, `getHistory`, `listSessions`, `loadPersistedSessions`

### 3. 中转 WS 转发 (`packages/relay/src/ws-relay.ts`)

- **双通道**：`/ws/browser`（浏览器）和 `/ws/local`（本地服务）
- **路由表**：`browserSessions: Map<sessionId, Set<WebSocket>>` + `localNode: WebSocket`
- **认证**：本地服务连接时需提供 `token` 匹配 `RELAY_TOKEN`
- **心跳**：30s ping/pong
- **断线通知**：本地服务断开时广播 error 到所有浏览器

### 4. 前端数据管道

```
WebSocket onmessage
  → JSON.parse
  → 控制类消息（session_info/sessions_list）→ 更新侧边栏状态
  → 数据类消息（claude_json/error/done/aborted）→ processStreamLine()
    → JSON.parse line
    → 路由到 processClaudeData()
    → UnifiedMessageProcessor.processMessage()
    → addMessage/updateLastMessage → React setState → re-render
```

**关键**：`useStreamParser.ts` 内部一行未改，输入源切换仅在 `ChatView.tsx` 调用侧完成。

---

## 会话持久化

本地服务 `data/sessions/` 目录：

```
data/sessions/
├── index.json                # ["uuid-1", "uuid-2"]
├── uuid-1.json               # { sessionId, projectPath, messages: [...], createdAt, updatedAt }
└── uuid-2.json
```

- 每次对话完成（done/error/aborted）后自动写入
- 启动时调用 `loadPersistedSessions()` 恢复
- 删除会话时同时删除对应 JSON 文件

---

## 安全设计

- **中转 ↔ 本地服务**：预共享 token 认证（`RELAY_TOKEN` 环境变量）
- **中转 ↔ 浏览器**：无需认证（MVP 单用户）
- **路径穿越防护**：静态文件服务做了 path.normalize + 前缀检查
- **本地服务无暴露端口**：仅作为 WS 客户端连接中转

---

## 实现顺序（已完成）

### 第一阶段：骨架搭建 ✅
1. ✅ 初始化 monorepo：`package.json` workspaces, `tsconfig.base.json`
2. ✅ 搭建 `packages/relay`：HTTP + WS 双通道服务器
3. ✅ 搭建 `packages/local`：WS 客户端 + 注册 + 心跳
4. ✅ 搭建 `packages/frontend`：Vite + React + TS + TailwindCSS 4

### 第二阶段：核心功能 ✅
5. ✅ 从 claude-code-webui 复制 types/utils/hooks
6. ✅ 从 claude-code-webui 复制 MessageComponents/ChatMessages/CollapsibleDetails/MessageContainer
7. ✅ 实现 `useWebSocket` hook
8. ✅ `useStreamParser` 无需修改 — 适配在 ChatView 调用侧
9. ✅ 实现 `sdk-runner.ts`（使用 `child_process.spawn` CLI 方案）
10. ✅ 实现 `SessionManager`（含持久化）

### 第三阶段：UI 组装 ✅
11. ✅ 实现 `SessionSidebar`（会话列表 + 新建 + 停止）
12. ✅ 实现 `ChatInput`（Enter 发送 / Esc 终止）
13. ✅ 实现 `ChatView`（WS 消息处理管线 + 组件组装）
14. ✅ 实现 `App.tsx`（布局 + WebSocket 单例）

### 第四阶段：待完成
15. 📋 中转部署到阿里云 + 配置 HTTPS + nginx 反代
16. 📋 本地服务配置为 Windows 服务/自启动

---

## 验证步骤

1. **本地开发验证**：
   - `npm -w packages/relay run dev` → 中转启动在 :3001
   - `npm -w packages/local run dev` → 本地服务连接中转（需配置 `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY`）
   - `npm -w packages/frontend run dev` → Vite 开发服务器 :5173
   - 浏览器打开 :5173 → 侧边栏 + 空消息区
   - 新建会话 → 输入"你好" → 右侧蓝色用户气泡
   - Claude CLI 返回 → 看到 ChatMessageComponent（左侧灰色回复）
   - 输入"读取 package.json" → ToolMessageComponent + ToolResultMessageComponent
   - Thinking 消息 → ThinkingMessageComponent（紫色折叠，默认展开）

2. **中转部署验证**（待完成）：
   - 中转部署到阿里云 → 公网 URL 可访问
   - 本地服务连接公网中转 → 注册成功
   - 浏览器通过公网 URL → 完整聊天流程

3. **流式渲染验证**：
   - 发送长回复请求 → Claude 回复逐字出现（assistant text streaming）
   - 工具调用 → ToolMessageComponent 先出现，ToolResultMessageComponent 随后
   - Esc 终止 → 显示 aborted 消息
