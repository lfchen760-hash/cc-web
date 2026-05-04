interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUSD: number;
  contextWindow: number;
}

interface StatusBarProps {
  connected: boolean;
  sessionId: string | null;
  model: string;
  tokenUsage: TokenUsage | null;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export function StatusBar({ connected, sessionId, model, tokenUsage }: StatusBarProps) {
  // 计算上下文窗口占用百分比
  // Anthropic: cache_read ⊆ input_tokens（缓存是子集）
  // DeepSeek: input_tokens 仅计未缓存 token，cache_read 是独立的缓存命中量，两者相加才是上下文总量
  const totalTokens = tokenUsage
    ? tokenUsage.cacheReadTokens > tokenUsage.inputTokens
      ? tokenUsage.inputTokens + tokenUsage.cacheReadTokens
      : tokenUsage.inputTokens
    : 0;
  const contextPct =
    tokenUsage && tokenUsage.contextWindow > 0
      ? Math.min(100, (totalTokens / tokenUsage.contextWindow) * 100)
      : 0;

  return (
    <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
          />
          {connected ? "已连接" : "未连接"}
        </span>
        {sessionId && (
          <span>
            会话: {sessionId.substring(0, 8)}...
          </span>
        )}
      </div>

      {/* 上下文窗口进度条 */}
      {tokenUsage && tokenUsage.contextWindow > 0 && (
        <div className="flex items-center gap-1.5 min-w-[180px]" title={`${formatTokens(totalTokens)} / ${formatTokens(tokenUsage.contextWindow)} tokens`}>
          <span className="text-slate-500 whitespace-nowrap">
            {contextPct.toFixed(0)}%
          </span>
          <div className="flex-1 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                contextPct > 80
                  ? "bg-amber-500"
                  : contextPct > 60
                    ? "bg-amber-400"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.max(1, contextPct)}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {model ? (
          <span>模型: {model}</span>
        ) : (
          <span className="text-slate-400">等待模型...</span>
        )}
        {tokenUsage ? (
          <span title={`缓存读取: ${formatTokens(tokenUsage.cacheReadTokens)}`}>
            Tokens: {formatTokens(tokenUsage.inputTokens)} in / {formatTokens(tokenUsage.outputTokens)} out
            <span className="ml-1 text-slate-400">${tokenUsage.costUSD.toFixed(4)}</span>
          </span>
        ) : (
          <span className="text-slate-400">Token 用量将在回复后显示</span>
        )}
        <span>Esc 终止</span>
      </div>
    </div>
  );
}
