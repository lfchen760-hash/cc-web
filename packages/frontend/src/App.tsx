import { ChatView } from "./components/ChatView";

function App() {
  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col">
      <div className="flex-1 min-h-0 bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 shadow-sm backdrop-blur-sm overflow-hidden">
        <ChatView />
      </div>
    </div>
  );
}

export default App;
