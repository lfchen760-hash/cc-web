import { useRef, useState } from "react";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUSD: number;
  contextWindow: number;
  compactionVersion: number;
}

interface TaskProgress {
  description: string;
  totalTokens: number;
  toolUses: number;
  durationMs: number;
  lastToolName: string;
}

interface StatusBarProps {
  connected: boolean;
  sessionId: string | null;
  nodeId?: string | null;
  model: string;
  permissionMode?: string;
  tokenUsage: TokenUsage | null;
  taskProgress: TaskProgress | null;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

export function StatusBar({
  connected,
  sessionId,
  nodeId,
  model,
  permissionMode,
  tokenUsage,
  taskProgress,
}: StatusBarProps) {
  const [expanded, setExpanded] = useState(false);

  const isDeepSeek = model ? model.toLowerCase().includes("deepseek") : false;
  const rawTotal = tokenUsage
    ? isDeepSeek
      ? tokenUsage.inputTokens + Math.max(tokenUsage.cacheReadTokens, tokenUsage.cacheCreationTokens)
      : tokenUsage.inputTokens
    : 0;

  // 单调追踪（同前）
  const maxTotalRef = useRef(0);
  const prevSessionRef = useRef(sessionId);
  const prevCompactVerRef = useRef(tokenUsage?.compactionVersion ?? 0);
  if (prevSessionRef.current !== sessionId) {
    maxTotalRef.current = 0;
    prevSessionRef.current = sessionId;
  }
  const compactVer = tokenUsage?.compactionVersion ?? 0;
  if (compactVer !== prevCompactVerRef.current) {
    maxTotalRef.current = rawTotal;
    prevCompactVerRef.current = compactVer;
  } else if (rawTotal > maxTotalRef.current) {
    maxTotalRef.current = rawTotal;
  }
  const totalTokens = maxTotalRef.current;

  const contextPct =
    tokenUsage && tokenUsage.contextWindow > 0
      ? Math.min(100, (totalTokens / tokenUsage.contextWindow) * 100)
      : 0;

  const barColor =
    contextPct > 80 ? "bg-amber-500" : contextPct > 60 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <>
      {/* ── 折叠面板本体 ── */}
      {expanded && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setExpanded(false)}
        />
      )}
      <div
        className={`flex-shrink-0 border-t border-slate-200 dark:border-slate-700 transition-all
          ${expanded
            ? "fixed inset-x-0 bottom-0 z-50 mx-0 rounded-t-2xl shadow-2xl sm:relative sm:z-auto sm:mx-0 sm:rounded-none sm:shadow-none bg-white/95 dark:bg-slate-800/95 backdrop-blur-md sm:bg-slate-100 sm:dark:bg-slate-800"
            : "bg-slate-100 dark:bg-slate-800"
          }`}
      >
        {/* ── 紧凑条（永远可见） ── */}
        <div
          className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
          role="button"
          tabIndex={0}
        >
          {/* 连接状态 */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`}
            title={connected ? "已连接" : "未连接"}
          />

          {/* 进度指示器（有任务时显示） */}
          {taskProgress && (
            <span className="text-xs text-blue-600 dark:text-blue-400 truncate hidden sm:inline">
              {taskProgress.lastToolName}
            </span>
          )}
          {taskProgress && (
            <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
              {taskProgress.toolUses}工具
            </span>
          )}

          {/* 间隔 */}
          <span className="flex-1 sm:hidden" />

          {/* 上下文进度条 */}
          {tokenUsage && tokenUsage.contextWindow > 0 && (
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              <span className="text-xs text-slate-500 tabular-nums w-7 text-right hidden sm:inline">
                {contextPct.toFixed(0)}%
              </span>
              <div className="h-1.5 w-12 sm:w-20 bg-slate-300 dark:bg-slate-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${Math.max(2, contextPct)}%` }}
                />
              </div>
            </div>
          )}

          {/* Token & 费用（桌面） */}
          {tokenUsage && (
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline flex-shrink-0">
              {formatTokens(totalTokens)} / {formatTokens(tokenUsage.contextWindow)}
            </span>
          )}

          {/* 展开/收起箭头 */}
          <span
            className={`text-xs text-slate-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
          >
            ▲
          </span>
        </div>

        {/* ── 展开详情 ── */}
        {expanded && (
          <div className="px-3 sm:px-4 pb-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
            {/* 基本信息行 */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {nodeId && (
                <span>
                  节点: <span className="text-slate-700 dark:text-slate-300">{nodeId}</span>
                </span>
              )}
              {sessionId && (
                <span>
                  会话: <span className="text-slate-700 dark:text-slate-300">{sessionId.substring(0, 8)}...</span>
                </span>
              )}
              {model && (
                <span>
                  模型: <span className="text-slate-700 dark:text-slate-300">{model}</span>
                </span>
              )}
              {permissionMode && permissionMode !== "default" && (
                <span>
                  权限: <span className="text-slate-700 dark:text-slate-300">{permissionMode}</span>
                </span>
              )}
              {tokenUsage && (
                <span>
                  费用: <span className="text-slate-700 dark:text-slate-300">${tokenUsage.costUSD.toFixed(4)}</span>
                </span>
              )}
            </div>

            {/* 上下文详情 */}
            {tokenUsage && tokenUsage.contextWindow > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-500">上下文</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {contextPct.toFixed(0)}% — {formatTokens(totalTokens)} / {formatTokens(tokenUsage.contextWindow)} tokens
                  </span>
                </div>
                <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${Math.max(1, contextPct)}%` }}
                  />
                </div>
                <div className="mt-1 flex gap-3 text-slate-500">
                  <span>in: {formatTokens(tokenUsage.inputTokens)}</span>
                  <span>out: {formatTokens(tokenUsage.outputTokens)}</span>
                  {tokenUsage.cacheReadTokens > 0 && (
                    <span>cache: {formatTokens(tokenUsage.cacheReadTokens)}</span>
                  )}
                </div>
              </div>
            )}

            {/* 当前任务进度 */}
            {taskProgress && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                <div className="text-blue-700 dark:text-blue-300 font-medium mb-1">
                  {taskProgress.description || `执行 ${taskProgress.lastToolName}`}
                </div>
                <div className="flex gap-3 flex-wrap text-blue-600 dark:text-blue-400">
                  <span>{taskProgress.toolUses} 次工具调用</span>
                  <span>{fmtMs(taskProgress.durationMs)}</span>
                  <span>{formatTokens(taskProgress.totalTokens)} tokens</span>
                </div>
              </div>
            )}

            {/* 无活跃任务时显示状态 */}
            {!taskProgress && (
              <div className="text-slate-500">
                {tokenUsage ? "本轮已完成" : "等待输入"}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
