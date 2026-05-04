interface PermissionDenial {
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
}

interface PermissionDialogProps {
  denials: PermissionDenial[];
  onApprove: () => void;
  onDismiss: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  Write: "写入文件",
  Edit: "编辑文件",
  Bash: "执行命令",
  Read: "读取文件",
  Grep: "搜索内容",
  Glob: "搜索文件",
  WebFetch: "访问网页",
  WebSearch: "网络搜索",
  Task: "创建任务",
  TodoWrite: "更新任务",
  NotebookEdit: "编辑 Notebook",
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] || name;
}

export function PermissionDialog({ denials, onApprove, onDismiss }: PermissionDialogProps) {
  if (denials.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onDismiss}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-amber-500 text-xl">&#9888;</span>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            权限被拒绝
          </h3>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Claude 尝试执行以下操作，但被权限检查拒绝了：
        </p>

        <div className="space-y-2 mb-5">
          {denials.map((d, i) => (
            <div
              key={d.tool_use_id || i}
              className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {toolLabel(d.tool_name)}
              </span>
              {typeof d.tool_input?.command === "string" && (
                <code className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  {d.tool_input.command.substring(0, 80)}
                </code>
              )}
              {typeof d.tool_input?.file_path === "string" && (
                <code className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  {d.tool_input.file_path}
                </code>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
          >
            忽略
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
          >
            批准并重试
          </button>
        </div>
      </div>
    </div>
  );
}
