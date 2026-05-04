import { ChatView } from "./components/ChatView";

function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto p-3 sm:p-6 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h1 className="text-slate-800 dark:text-slate-100 text-lg sm:text-3xl font-bold tracking-tight">
            cc-web
          </h1>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            远程 Claude Code 控制台
          </span>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-sm backdrop-blur-sm overflow-hidden">
          <ChatView />
        </div>
      </div>
    </div>
  );
}

export default App;
