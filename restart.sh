#!/bin/bash
set -e

echo "=== 停止所有 Node 进程 ==="
taskkill //F //IM node.exe 2>/dev/null || true
sleep 2

echo ""
echo "=== 启动中继服务 (端口 3001) ==="
cd "$(dirname "$0")/packages/relay"
npx tsx src/index.ts &
sleep 2

echo ""
echo "=== 启动本地服务 ==="
cd "$(dirname "$0")/packages/local"
npx tsx src/index.ts &
sleep 2

echo ""
echo "=== 启动前端 (端口 5173) ==="
cd "$(dirname "$0")/packages/frontend"
npx vite --host 0.0.0.0 --port 5173 &

echo ""
echo "=== 全部启动完成 ==="
echo "  前端: http://localhost:5173"
echo "  中继: ws://localhost:3001"

wait
