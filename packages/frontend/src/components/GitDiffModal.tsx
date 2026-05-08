interface GitDiffModalProps {
  isOpen: boolean;
  filePath: string;
  staged: boolean;
  diffText: string;
  onClose: () => void;
}

function DiffLine({ line }: { line: string }) {
  const ch = line[0];
  if (ch === "+" && !line.startsWith("+++")) {
    return <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 font-mono text-xs leading-5 px-2 whitespace-pre-wrap">{line}</div>;
  }
  if (ch === "-" && !line.startsWith("---")) {
    return <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 font-mono text-xs leading-5 px-2 whitespace-pre-wrap">{line}</div>;
  }
  if (line.startsWith("@@")) {
    return <div className="bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-mono text-[10px] leading-5 px-2 whitespace-pre-wrap">{line}</div>;
  }
  return <div className="font-mono text-xs leading-5 px-2 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{line}</div>;
}

export function GitDiffModal({ isOpen, filePath, staged, diffText, onClose }: GitDiffModalProps) {
  if (!isOpen) return null;

  const lines = diffText ? diffText.split("\n") : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm text-slate-700 dark:text-slate-200 truncate">
              {filePath}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
              staged
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            }`}>
              {staged ? "staged" : "unstaged"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          {lines.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-400 text-center">
              无差异内容
            </div>
          ) : (
            <div className="py-1">
              {lines.map((line, i) => (
                <DiffLine key={i} line={line} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
