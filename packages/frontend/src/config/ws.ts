// 自动检测：使用当前页面的 hostname，手机访问时也能正确连接
const host = window.location.hostname;
export const WS_BROWSER_URL =
  import.meta.env.VITE_WS_URL || `ws://${host}:3001/ws/browser`;
