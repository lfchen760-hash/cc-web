import { WebSocket } from 'ws';
import { RELAY_URL, RELAY_TOKEN, NODE_ID, NODE_PASSWORD, RECONNECT_DELAY, MAX_RECONNECT_DELAY } from './config.js';

type MessageHandler = (msg: { type: string; [key: string]: unknown }) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentDelay = RECONNECT_DELAY;
let handlers: MessageHandler[] = [];

export function onMessage(handler: MessageHandler): void {
  handlers.push(handler);
}

export function send(data: unknown): boolean {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

function connect(): void {
  // 关闭已有连接再建新连接，避免在 relay 端创建多个连接互相替换
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.close();
    ws = null;
  }

  console.log(`正在连接中转服务: ${RELAY_URL}`);

  ws = new WebSocket(RELAY_URL);

  ws.on('open', () => {
    console.log('已连接到中转服务');
    currentDelay = RECONNECT_DELAY;

    // 注册
    send({ type: 'register', nodeId: NODE_ID, token: RELAY_TOKEN, passwordRequired: !!NODE_PASSWORD });
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      // 忽略心跳 ping
      if (msg.type === 'ping') {
        send({ type: 'pong' });
        return;
      }
      // 通知所有处理器
      for (const handler of handlers) {
        handler(msg);
      }
    } catch {
      // 忽略解析失败
    }
  });

  ws.on('close', () => {
    console.log('与中转服务的连接已断开');
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err.message);
  });
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  console.log(`${currentDelay / 1000}s 后重连...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    currentDelay = Math.min(currentDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, currentDelay);
}

export function start(): void {
  connect();
}

export function stop(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.close();
    ws = null;
  }
}
