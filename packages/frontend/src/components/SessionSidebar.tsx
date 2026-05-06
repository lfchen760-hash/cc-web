import type { SessionInfo } from "../types";

interface SessionSidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: (projectPath: string) => void;
  onStopSession: (sessionId: string) => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onStopSession,
}: SessionSidebarProps) {
  const handleCreate = () => {
    const projectPath = prompt("请输入项目路径:", "D:\\codes\\");
    if (projectPath) {
      onCreateSession(projectPath);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-slate-400";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "running":
        return "运行中";
      case "error":
        return "错误";
      default:
        return "空闲";
    }
  };

  return (
    <div className="w-[280px] flex-shrink-0 bg-white/80 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full rounded-l-2xl">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          会话列表
        </h2>
        <button
          onClick={handleCreate}
          className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + 新建会话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!Array.isArray(sessions) || sessions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-8">
            暂无会话，点击上方按钮新建
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.sessionId}
              onClick={() => onSelectSession(s.sessionId)}
              className={`mb-1 p-3 rounded-lg cursor-pointer transition-colors ${
                activeSessionId === s.sessionId
                  ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(s.status)}`}
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                  {s.projectPath.split(/[/\\]/).pop() || s.projectPath}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {statusLabel(s.status)}
                </span>
                <span className="text-xs text-slate-400">
                  {s.messageCount} 条消息
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStopSession(s.sessionId);
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  停止
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-400 truncate">
                {s.projectPath}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
