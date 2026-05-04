import { useState } from "react";

export interface ModelInfo {
  id: string;
  name: string;
}

interface ModelPickerProps {
  models: ModelInfo[];
  currentModel: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}

export function ModelPicker({ models, currentModel, onSelect, onClose }: ModelPickerProps) {
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  const handleClick = (modelId: string) => {
    if (modelId === currentModel) {
      onClose();
      return;
    }
    // 不同模型需要二次确认
    setConfirmTarget(modelId);
  };

  if (confirmTarget) {
    const targetName = models.find((m) => m.id === confirmTarget)?.name || confirmTarget;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
        <div
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
            切换模型
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            从 <span className="font-medium">{currentModel}</span> 切换到{" "}
            <span className="font-medium">{targetName}</span>
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-5">
            切换模型需要重启会话进程，当前对话历史会保留。
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmTarget(null)}
              className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              取消
            </button>
            <button
              onClick={() => onSelect(confirmTarget)}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              确认切换
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-4 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
          选择模型
        </h3>
        <div className="space-y-1">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => handleClick(m.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                m.id === currentModel
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                  : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              <span>{m.name}</span>
              <span className="ml-2 text-xs text-slate-400">{m.id}</span>
              {m.id === currentModel && (
                <span className="ml-2 text-xs text-blue-500">当前</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          取消
        </button>
      </div>
    </div>
  );
}
