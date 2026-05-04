// 开发环境连接本地 relay，生产环境连接公网 relay
export const WS_BROWSER_URL =
  import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws/browser";
