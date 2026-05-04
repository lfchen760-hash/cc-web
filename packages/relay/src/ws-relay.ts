import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { RELAY_TOKEN } from './config.js';
import type { BrowserMessage, LocalMessage } from './types.js';

// 路由表
const browserSessions = new Map<string, Set<WebSocket>>(); // sessionId → browser clients
const allBrowsers = new Set<WebSocket>(); // 所有浏览器连接
let localNode: WebSocket | null = null;
let localNodeId: string | null = null;

// HTTP API 的请求-响应匹配
const pendingRequests = new Map<string, (data: unknown) => void>();

function send(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToSession(sessionId: string, data: unknown): void {
  const clients = browserSessions.get(sessionId);
  if (clients) {
    for (const ws of clients) {
      send(ws, data);
    }
  }
}

function broadcastToAllBrowsers(data: unknown): void {
  for (const ws of allBrowsers) {
    send(ws, data);
  }
}

// 处理浏览器消息
function handleBrowserMessage(ws: WebSocket, msg: BrowserMessage): void {
  switch (msg.type) {
    case 'chat': {
      if (!localNode) {
        send(ws, { type: 'error', error: '本地服务未连接' });
        return;
      }
      // 订阅该会话
      if (msg.sessionId) {
        if (!browserSessions.has(msg.sessionId)) {
          browserSessions.set(msg.sessionId, new Set());
        }
        browserSessions.get(msg.sessionId)!.add(ws);
        ws._sessionId = msg.sessionId;
        console.log(`[relay] 浏览器订阅会话 ${(msg.sessionId as string).substring(0, 8)}, 当前订阅者数=${browserSessions.get(msg.sessionId as string)!.size}`);
      }
      // 转发到本地服务
      send(localNode, { type: 'chat', sessionId: msg.sessionId, text: msg.text });
      break;
    }
    case 'create_session': {
      if (!localNode) {
        send(ws, { type: 'error', error: '本地服务未连接' });
        return;
      }
      send(localNode, { type: 'create_session', projectPath: msg.projectPath, projectId: msg.projectId });
      break;
    }
    case 'stop_session': {
      if (localNode && msg.sessionId) {
        send(localNode, { type: 'stop_session', sessionId: msg.sessionId });
      }
      break;
    }
    case 'list_sessions': {
      if (localNode) {
        send(localNode, { type: 'list_sessions', projectId: msg.projectId });
      }
      break;
    }
    case 'create_project': {
      if (!localNode) {
        send(ws, { type: 'error', error: '本地服务未连接' });
        return;
      }
      send(localNode, { type: 'create_project', name: msg.name, path: msg.path });
      break;
    }
    case 'delete_project': {
      if (localNode && msg.projectId) {
        send(localNode, { type: 'delete_project', projectId: msg.projectId });
      }
      break;
    }
    case 'list_projects': {
      if (localNode) {
        send(localNode, { type: 'list_projects' });
      }
      break;
    }
  }
}

// 向本地服务发送请求并等待响应（用于 HTTP API）
export function requestLocal(data: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!localNode || localNode.readyState !== WebSocket.OPEN) {
      reject(new Error('本地服务未连接'));
      return;
    }
    const reqId = randomUUID();
    pendingRequests.set(reqId, resolve);
    send(localNode, { ...data, _reqId: reqId });
    // 5 秒超时
    setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        reject(new Error('请求超时'));
      }
    }, 5000);
  });
}

// 处理本地服务消息
function handleLocalMessage(ws: WebSocket, msg: LocalMessage): void {
  // 如果是 HTTP API 请求的响应，解析对应的 Promise
  const reqId = (msg as unknown as Record<string, unknown>)._reqId as string | undefined;
  if (reqId && pendingRequests.has(reqId)) {
    pendingRequests.get(reqId)!(msg);
    pendingRequests.delete(reqId);
    return;
  }
  switch (msg.type) {
    case 'register': {
      if (msg.token !== RELAY_TOKEN) {
        send(ws, { type: 'error', error: '认证失败：token 不匹配' });
        ws.close();
        return;
      }
      localNodeId = msg.nodeId || 'local';
      console.log(`本地服务已注册: ${localNodeId}`);
      send(ws, { type: 'registered' });
      break;
    }
    case 'pong':
      // 心跳响应，无需处理
      break;

    case 'session_info':
      // session_info 广播给所有浏览器（新建会话时浏览器尚未订阅该 sessionId）
      if (msg.sessionId) {
        broadcastToAllBrowsers(msg);
      }
      break;

    case 'claude_json':
    case 'done':
    case 'error':
    case 'aborted':
    case 'session_end': {
      // 根据 sessionId 转发到对应的浏览器客户端
      const subType = msg.type === 'claude_json' && msg.data && typeof msg.data === 'object'
        ? (msg.data as { type?: string }).type
        : '';
      console.log(`[relay] 收到 ${msg.type}${subType ? '/' + subType : ''} sessionId=${(msg.sessionId || '').substring(0, 8)}, 浏览器数=${msg.sessionId ? (browserSessions.get(msg.sessionId as string)?.size ?? 0) : 'N/A'}`);
      if (msg.sessionId) {
        broadcastToSession(msg.sessionId, msg);
      } else {
        console.log('[relay] ⚠️ 缺少 sessionId，无法转发:', msg.type);
      }
      break;
    }

    case 'sessions_list':
    case 'projects_list':
    case 'project_info':
      // 广播给所有浏览器
      broadcastToAllBrowsers(msg);
      break;
  }
}

export function handleBrowserConnection(ws: WebSocket): void {
  console.log('浏览器客户端已连接');
  allBrowsers.add(ws);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleBrowserMessage(ws, msg as BrowserMessage);
    } catch {
      // 忽略解析失败
    }
  });

  ws.on('close', () => {
    console.log('浏览器客户端已断开');
    allBrowsers.delete(ws);
    // 从所有会话中移除
    for (const [, clients] of browserSessions) {
      clients.delete(ws);
    }
  });

  ws.on('error', () => {});
}

export function handleLocalConnection(ws: WebSocket): void {
  console.log('本地服务连接请求');

  // 如果已有本地服务连接，先断开旧的
  if (localNode) {
    console.log('断开旧的本地服务连接');
    localNode.close();
    localNode = null;
    localNodeId = null;
  }

  localNode = ws;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleLocalMessage(ws, msg as LocalMessage);
    } catch {
      // 忽略解析失败
    }
  });

  ws.on('close', () => {
    // 仅当断开的是当前活跃连接时才清理，避免旧连接的 close 事件覆盖新连接
    if (localNode !== ws) return;
    console.log('本地服务已断开');
    localNode = null;
    localNodeId = null;
    broadcastToAllBrowsers({ type: 'error', error: '本地服务已断开' });
  });

  ws.on('error', () => {});

  // 启动心跳
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      send(ws, { type: 'ping' });
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);
}

// 扩展 WebSocket 类型以存储 sessionId
declare module 'ws' {
  interface WebSocket {
    _sessionId?: string;
  }
}
