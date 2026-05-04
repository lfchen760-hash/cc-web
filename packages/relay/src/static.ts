import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function serveStatic(staticDir: string, req: IncomingMessage, res: ServerResponse): void {
  let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';

  // 安全防护：防止路径穿越
  filePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(staticDir, filePath);

  // 确保文件在 staticDir 内
  if (!fullPath.startsWith(path.resolve(staticDir))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath);
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // SPA fallback: 非 API 请求返回 index.html
      if (ext === '' || !(ext in CONTENT_TYPES)) {
        const indexPath = path.join(staticDir, 'index.html');
        fs.readFile(indexPath, (_err, indexData) => {
          if (_err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexData);
        });
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}
