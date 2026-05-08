import { useState } from "react";
import type { GitStatusResult, GitStatusFile } from "../types";

interface GitChangeListProps {
  gitStatus: GitStatusResult | undefined;
  onFileClick: (filePath: string, staged: boolean) => void;
}

function statusLetterColor(ch: string): string {
  switch (ch) {
    case "M": return "text-amber-500";
    case "A": return "text-emerald-500";
    case "D": return "text-red-500";
    case "R": return "text-blue-500";
    default: return "text-slate-400";
  }
}

function FileGroup({
  title,
  files,
  defaultExpanded,
  staged,
  onFileClick,
}: {
  title: string;
  files: GitStatusFile[];
  defaultExpanded: boolean;
  staged: boolean;
  onFileClick: (filePath: string, staged: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded"
      >
        <span className="text-[10px]">{expanded ? "▼" : "▶"}</span>
        <span className="flex-1 text-left">{title}</span>
        <span className="text-[10px] bg-slate-200 dark:bg-slate-600 px-1 rounded">
          {files.length}
        </span>
      </button>
      {expanded && files.length > 0 && (
        <div className="ml-3">
          {files.map((f, i) => (
            <button
              key={`${f.path}-${i}`}
              onClick={() => onFileClick(f.path, staged)}
              className="flex items-center gap-1.5 w-full px-2 py-0.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded truncate"
            >
              <span className={`font-mono font-bold w-3 text-center flex-shrink-0 ${statusLetterColor(f.staged || f.unstaged)}`}>
                {f.staged || f.unstaged}
              </span>
              <span className="truncate text-slate-600 dark:text-slate-300">
                {f.displayPath}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GitChangeList({ gitStatus, onFileClick }: GitChangeListProps) {
  if (!gitStatus) {
    return null;
  }

  if (!gitStatus.isGitRepo) {
    return (
      <div className="px-3 py-4 text-xs text-slate-400 dark:text-slate-500 text-center">
        非 Git 仓库
      </div>
    );
  }

  const hasChanges =
    gitStatus.staged.length > 0 ||
    gitStatus.unstaged.length > 0 ||
    gitStatus.untracked.length > 0;

  if (!hasChanges) {
    return (
      <div className="px-3 py-4 text-xs text-slate-400 dark:text-slate-500 text-center">
        Working tree clean
      </div>
    );
  }

  return (
    <div className="py-1">
      <FileGroup
        title="Staged"
        files={gitStatus.staged}
        defaultExpanded={true}
        staged={true}
        onFileClick={onFileClick}
      />
      <FileGroup
        title="Unstaged"
        files={gitStatus.unstaged}
        defaultExpanded={true}
        staged={false}
        onFileClick={onFileClick}
      />
      <FileGroup
        title="Untracked"
        files={gitStatus.untracked}
        defaultExpanded={false}
        staged={false}
        onFileClick={onFileClick}
      />
    </div>
  );
}
