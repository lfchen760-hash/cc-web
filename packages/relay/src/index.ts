import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { RELAY_PORT, STATIC_DIR } from './config.js';
import { serveStatic } from './static.js';
import { handleBrowserConnection, handleLocalConnection, requestLocal, getOnlineNodes, isNodePasswordRequired } from './ws-relay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, STATIC_DIR);

function jsonResponse(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function getQueryParam(req: http.IncomingMessage, name: string): string | undefined {
  const url = req.url || '';
  const idx = url.indexOf('?');
  if (idx === -1) return undefined;
  const params = new URLSearchParams(url.slice(idx));
  return params.get(name) || undefined;
}

const server = http.createServer((req, res) => {
  // 节点列表 API
  if (req.url?.startsWith('/api/nodes') && req.method === 'GET') {
    jsonResponse(res, getOnlineNodes());
    return;
  }

  // 项目列表 API
  if (req.url?.startsWith('/api/projects') && req.method === 'GET') {
    const nodeId = getQueryParam(req, 'nodeId');
    // 指定节点需密码 → 拦截；未指定节点但首个在线节点需密码 → 也拦截
    const targetNodeId = nodeId || getOnlineNodes()[0]?.nodeId;
    if (targetNodeId && isNodePasswordRequired(targetNodeId)) {
      jsonResponse(res, { error: 'auth_required', message: '此节点需要密码认证' }, 401);
      return;
    }
    requestLocal({ type: 'list_projects' }, nodeId)
      .then((msg) => {
        const data = msg as { projects?: unknown };
        jsonResponse(res, data.projects || []);
      })
      .catch((err: Error) => jsonResponse(res, { error: err.message }, 503));
    return;
  }

  // 会话列表 API
  if (req.url?.startsWith('/api/sessions') && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const projectId = url.searchParams.get('projectId') || undefined;
    const nodeId = url.searchParams.get('nodeId') || undefined;
    const targetNodeId = nodeId || getOnlineNodes()[0]?.nodeId;
    if (targetNodeId && isNodePasswordRequired(targetNodeId)) {
      jsonResponse(res, { error: 'auth_required', message: '此节点需要密码认证' }, 401);
      return;
    }
    requestLocal({ type: 'list_sessions', projectId }, nodeId)
      .then((msg) => {
        const data = msg as { sessions?: unknown };
        jsonResponse(res, data.sessions || []);
      })
      .catch((err: Error) => jsonResponse(res, { error: err.message }, 503));
    return;
  }

  serveStatic(staticDir, req, res);
});

// WebSocket: 浏览器连接 → /ws/browser
const browserWss = new WebSocketServer({ noServer: true });
// WebSocket: 本地服务连接 → /ws/local
const localWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws/browser') {
    browserWss.handleUpgrade(req, socket, head, (ws) => {
      handleBrowserConnection(ws);
    });
  } else if (req.url === '/ws/local') {
    localWss.handleUpgrade(req, socket, head, (ws) => {
      handleLocalConnection(ws);
    });
  } else {
    socket.destroy();
  }
});

function shutdown() {
  console.log('\n正在关闭中转服务...');
  browserWss.close();
  localWss.close();
  server.close(() => {
    console.log('中转服务已停止');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(RELAY_PORT, () => {
  console.log(`cc-web relay 已启动: http://localhost:${RELAY_PORT}`);
  console.log(`  WebSocket (浏览器): ws://localhost:${RELAY_PORT}/ws/browser`);
  console.log(`  WebSocket (本地服务): ws://localhost:${RELAY_PORT}/ws/local`);
  console.log(`  静态文件目录: ${staticDir}`);
});
