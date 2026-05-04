import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { RELAY_PORT, STATIC_DIR } from './config.js';
import { serveStatic } from './static.js';
import { handleBrowserConnection, handleLocalConnection, requestLocal } from './ws-relay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, STATIC_DIR);

function jsonResponse(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  // API 路由
  if (req.url === '/api/projects' && req.method === 'GET') {
    requestLocal({ type: 'list_projects' })
      .then((msg) => {
        const data = msg as { projects?: unknown };
        jsonResponse(res, data.projects || []);
      })
      .catch((err: Error) => jsonResponse(res, { error: err.message }, 503));
    return;
  }

  if (req.url?.startsWith('/api/sessions') && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const projectId = url.searchParams.get('projectId') || undefined;
    requestLocal({ type: 'list_sessions', projectId })
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
