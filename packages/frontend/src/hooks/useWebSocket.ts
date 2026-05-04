import { useEffect, useRef, useCallback, useState } from "react";
import { WS_BROWSER_URL } from "../config/ws";

interface UseWebSocketReturn {
  connected: boolean;
  send: (data: unknown) => void;
  onRawMessage: (cb: (raw: string) => void) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(2000);
  const mounted = useRef(true);
  const rawMessageCb = useRef<((raw: string) => void) | null>(null);

  const [connected, setConnected] = useState(false);

  const onRawMessage = useCallback((cb: (raw: string) => void) => {
    rawMessageCb.current = cb;
  }, []);

  const connect = useCallback(() => {
    if (!mounted.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_BROWSER_URL);

    ws.onopen = () => {
      if (!mounted.current) return;
      setConnected(true);
      reconnectDelay.current = 2000;
    };

    ws.onmessage = (event) => {
      if (!mounted.current) return;
      const raw = event.data as string;
      rawMessageCb.current?.(raw);
    };

    ws.onclose = () => {
      if (!mounted.current) return;
      wsRef.current = null;
      setConnected(false);
      // 自动重连
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      // 不调用 close()，浏览器在错误时会自动关闭 WebSocket
      // close 事件会自然触发 onclose 来完成清理和重连
    };

    wsRef.current = ws;
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      // StrictMode: cleanup 中只清理回调，CONNECTING 状态不 close（会触发报错）
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CLOSING) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected, send, onRawMessage };
}
