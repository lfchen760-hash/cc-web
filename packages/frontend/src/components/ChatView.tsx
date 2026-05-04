import { useState, useCallback, useEffect, useRef } from "react";
import type { AllMessage, ChatMessage, SessionInfo, ProjectInfo } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { useClaudeStreaming } from "../hooks/useClaudeStreaming";
import type { StreamingContext } from "../hooks/streaming/useMessageProcessor";
import { UnifiedMessageProcessor } from "../utils/UnifiedMessageProcessor";
import { ProjectSidebar } from "./ProjectSidebar";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { StatusBar } from "./StatusBar";
import { ModelPicker } from "./ModelPicker";
import { PermissionDialog } from "./PermissionDialog";

const KNOWN_MODELS = [
  { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export function ChatView() {
  const { connected, send, onRawMessage } = useWebSocket();
  const { processStreamLine } = useClaudeStreaming();

  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AllMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState("");
  const [hasReceivedInit, setHasReceivedInit] = useState(false);
  const [permissionMode, setPermissionMode] = useState<string>("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [taskProgress, setTaskProgress] = useState<{
    description: string;
    totalTokens: number;
    toolUses: number;
    durationMs: number;
    lastToolName: string;
  } | null>(null);
  const [permissionDenials, setPermissionDenials] = useState<
    Array<{ tool_name: string; tool_use_id: string; tool_input: Record<string, unknown> }> | null
  >(null);
  const [tokenUsage, setTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUSD: number;
    contextWindow: number;
    compactionVersion: number;
  } | null>(null);

  const currentAssistantMessageRef = useRef<ChatMessage | null>(null);
  const initialLoadDone = useRef(false);
  const pendingSessionRef = useRef<string | null>(null);
  const handleRawMessageRef = useRef<((raw: string) => void) | null>(null);

  // 初始加载项目列表（通过 HTTP，可靠）
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: ProjectInfo[]) => {
        setProjects(data);
      })
      .catch(() => {});

    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: SessionInfo[]) => {
        setSessions(data);
      })
      .catch(() => {});
  }, []);

  // 处理一条 WebSocket 原始消息
  const handleRawMessage = useCallback(
    (raw: string) => {
      const lines = raw.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          if (data.type === "projects_list" && data.projects) {
            setProjects(data.projects);
            continue;
          }

          if (data.type === "project_info" && data.project) {
            setProjects((prev) => {
              const idx = prev.findIndex((p) => p.projectId === data.project.projectId);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = data.project;
                return updated;
              }
              return [...prev, data.project];
            });
            continue;
          }

          if (data.type === "session_info") {
            const info: SessionInfo = {
              sessionId: data.sessionId || "",
              projectId: data.projectId || "",
              projectPath: data.projectPath || data.cwd || "",
              model: data.model || undefined,
              permissionMode: data.permissionMode || undefined,
              summary: data.summary || "",
              status: data.status || "running",
              messageCount: data.messageCount || 0,
              createdAt: data.createdAt || Date.now(),
            };
            setSessions((prev) => {
              const idx = prev.findIndex((s) => s.sessionId === info.sessionId);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = info;
                return updated;
              }
              return [...prev, info];
            });
            if (!activeSessionId && !pendingSessionRef.current) {
              setActiveSessionId(info.sessionId);
              setActiveProjectId(info.projectId);
              pendingSessionRef.current = info.sessionId;
            }
            if (data.model) setModel(data.model);
            if (data.permissionMode) setPermissionMode(data.permissionMode);
            continue;
          }

          if (data.type === "sessions_list" && data.sessions) {
            setSessions(data.sessions);
            // 如果有待加载的会话，将其历史消息加载到聊天视图
            const pendingId = pendingSessionRef.current;
            if (pendingId) {
              const targetSession = (data.sessions as SessionInfo[]).find(
                (s) => s.sessionId === pendingId,
              );
              if (targetSession?.messages && targetSession.messages.length > 0) {
                const msgs = targetSession.messages as unknown as Record<string, unknown>[];
                const historyProcessor = new UnifiedMessageProcessor();
                const created = targetSession.createdAt || Date.now();
                // 提取 claude_json 类型的消息，取 .data 作为 SDKMessage，附上 timestamp
                const timestamped = msgs
                  .filter((m) => m.type === "claude_json" && m.data)
                  .map((m, i) => ({
                    ...(m.data as Record<string, unknown>),
                    timestamp: new Date(created + i).toISOString(),
                  }));
                if (timestamped.length > 0) {
                  const processed = historyProcessor.processMessagesBatch(
                    timestamped as Parameters<typeof historyProcessor.processMessagesBatch>[0],
                  );
                  setMessages(processed);
                }
                setHasReceivedInit(true);
              }
            }
            continue;
          }

          if (data.type === "session_end") {
            setIsLoading(false);
            currentAssistantMessageRef.current = null;
            continue;
          }

          if (
            data.type === "claude_json" ||
            data.type === "error" ||
            data.type === "done" ||
            data.type === "aborted"
          ) {
            const streamingContext: StreamingContext = {
              currentAssistantMessage: currentAssistantMessageRef.current,
              setCurrentAssistantMessage: (msg) => {
                currentAssistantMessageRef.current = msg;
              },
              addMessage: (msg) => {
                setMessages((prev) => [...prev, msg]);
              },
              updateLastMessage: (content) => {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (
                    last &&
                    last.type === "chat" &&
                    last.role === "assistant"
                  ) {
                    updated[updated.length - 1] = { ...last, content };
                  }
                  return updated;
                });
              },
              onSessionId: (_sid) => {},
              hasReceivedInit,
              setHasReceivedInit,
              shouldShowInitMessage: () => !hasReceivedInit,
              onModel: (m) => setModel(m),
              onTaskProgress: (p) => setTaskProgress(p),
              onPermissionDenied: (denials) => {
                setPermissionDenials(denials);
              },
              onTokenUsage: (u) =>
                setTokenUsage((prev) => ({
                  ...u,
                  compactionVersion: prev?.compactionVersion ?? 0,
                })),
            };

            processStreamLine(JSON.stringify(data), streamingContext);

            if (data.type === "claude_json" && data.data) {
              const sdkMsg = data.data as Record<string, unknown>;
              if (sdkMsg.type === "system" && sdkMsg.subtype === "init" && sdkMsg.model) {
                setModel(String(sdkMsg.model));
              }
              // compact_boundary 给出 compact 前的真实上下文 token 数，用于校准进度条
              if (sdkMsg.type === "system" && sdkMsg.subtype === "compact_boundary") {
                const meta = sdkMsg.compact_metadata as Record<string, unknown> | undefined;
                if (meta?.pre_tokens) {
                  const preTokens = Number(meta.pre_tokens);
                  setTokenUsage((prev) =>
                    prev
                      ? {
                          ...prev,
                          inputTokens: preTokens,
                          cacheReadTokens: 0,
                          cacheCreationTokens: 0,
                          compactionVersion: (prev.compactionVersion ?? 0) + 1,
                        }
                      : null,
                  );
                }
              }
            }

            if (
              data.type === "done" ||
              data.type === "error" ||
              data.type === "aborted"
            ) {
              setIsLoading(false);
              setTaskProgress(null);
              currentAssistantMessageRef.current = null;
            }
          }
        } catch (err) {
          console.error("[ChatView] handleRawMessage 解析失败:", err, line.substring(0, 200));
        }
      }
    },
    [processStreamLine, hasReceivedInit, activeSessionId],
  );
  handleRawMessageRef.current = handleRawMessage;

  // 监听 WebSocket 新消息（通过回调直接处理，避免双路径导致重复消息）
  useEffect(() => {
    onRawMessage((raw: string) => {
      handleRawMessageRef.current?.(raw);
    });
  }, [onRawMessage]);

  const handleCreateProject = useCallback(
    (name: string, projectPath: string) => {
      send({ type: "create_project", name, path: projectPath });
    },
    [send],
  );

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      send({ type: "delete_project", projectId });
    },
    [send],
  );

  const handleCreateSession = useCallback(
    (projectId: string, projectPath: string) => {
      // acceptEdits: 自动批准文件读写，Bash 等操作仍需确认
      send({ type: "create_session", projectId, projectPath, permissionMode: "acceptEdits" });
    },
    [send],
  );

  const handleSelectSession = useCallback(
    (sessionId: string, projectId: string) => {
      setActiveSessionId(sessionId);
      setActiveProjectId(projectId);
      pendingSessionRef.current = sessionId;
      setMessages([]);
      setHasReceivedInit(false);
      setTokenUsage(null);
      setModel("");
      setPermissionMode("");
      setPermissionDenials(null);
      setTaskProgress(null);
      send({ type: "list_sessions", projectId });
    },
    [send],
  );

  const handleSelectProject = useCallback(
    (projectId: string) => {
      setActiveProjectId(projectId);
      send({ type: "list_sessions", projectId });
    },
    [send],
  );

  const handleSlashCommand = useCallback(
    (text: string) => {
      const parts = text.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const arg = parts[1] || "";

      if (cmd === "/model") {
        // 弹出模型选择器（支持交互确认）
        setModelPickerOpen(true);
        return;
      }

      // /permission <mode> — 切换权限模式
      if (cmd === "/permission" && arg) {
        const newMode = parts[1];
        const validModes = ["acceptEdits", "bypassPermissions", "default"];
        if (!validModes.includes(newMode)) {
          const errMsg: ChatMessage = {
            type: "chat",
            role: "assistant",
            content: `无效的权限模式: ${newMode}\n可选: ${validModes.join(", ")}`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errMsg]);
          return;
        }
        setPermissionMode(newMode);
        const infoMsg: ChatMessage = {
          type: "chat",
          role: "assistant",
          content: `权限模式已切换为: ${newMode}\n下次发送消息时生效。`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, infoMsg]);
        return;
      }

      // /permission（无参数）— 显示当前模式
      if (cmd === "/permission") {
        const currentPerm = permissionMode || "acceptEdits（默认）";
        const modes = [
          { value: "acceptEdits", label: "自动批准文件编辑" },
          { value: "bypassPermissions", label: "全部自动批准" },
          { value: "default", label: "标准权限检查" },
        ];
        let content = `/permission — 当前模式: ${currentPerm}\n\n可切换模式:\n`;
        for (const m of modes) {
          const marker = permissionMode === m.value ? " *" : "  ";
          content += `${marker} ${m.value} — ${m.label}\n`;
        }
        content += `\n输入 /permission <模式名> 切换（下次消息生效）。`;
        setMessages((prev) => [
          ...prev,
          { type: "chat", role: "assistant", content, timestamp: Date.now() } as ChatMessage,
        ]);
        return;
      }

      // 其他斜杠命令透传给 Claude CLI（如 /compact, /help 等）
      const userMsg: ChatMessage = {
        type: "chat",
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      send({ type: "chat", sessionId: activeSessionId || "", text });
      setIsLoading(true);
    },
    [activeSessionId, send],
  );

  // 模型选择器回调：用户确认切换模型
  const handleModelSelect = useCallback(
    (newModel: string) => {
      setModelPickerOpen(false);
      if (!activeProjectId) return;

      // 创建新会话并使用选定的模型
      const project = projects.find((p) => p.projectId === activeProjectId);
      const projectPath = project?.path || "";
      if (projectPath) {
        send({ type: "create_session", projectId: activeProjectId, projectPath, model: newModel, permissionMode: permissionMode || "acceptEdits" });
      }

      const infoMsg: ChatMessage = {
        type: "chat",
        role: "assistant",
        content: `模型切换为 ${newModel}，已创建新会话。\n原会话保留在侧边栏中，可随时切回。`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, infoMsg]);
    },
    [activeProjectId, projects, send, permissionMode],
  );

  const handleSendMessage = useCallback(
    (text: string) => {
      // 斜杠命令由前端拦截处理
      if (text.startsWith("/")) {
        handleSlashCommand(text);
        return;
      }

      const userMsg: ChatMessage = {
        type: "chat",
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      send({ type: "chat", sessionId: activeSessionId || "", text, permissionMode: permissionMode || "acceptEdits" });
      setIsLoading(true);
    },
    [activeSessionId, send, permissionMode, handleSlashCommand],
  );

  // 权限拒绝处理：批准并重试
  const handlePermissionApprove = useCallback(() => {
    if (!activeSessionId) return;
    // 发送重试指令：后端会移除被拒回复、用 bypassPermissions 重启 CLI、重放对话
    send({
      type: "retry_with_permission",
      sessionId: activeSessionId,
      permissionMode: "bypassPermissions",
    });
    setPermissionDenials(null);
    // 给用户反馈
    const infoMsg: ChatMessage = {
      type: "chat",
      role: "assistant",
      content: "已批准权限，正在以完全权限重试...",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, infoMsg]);
    setIsLoading(true);
  }, [activeSessionId, send]);

  const handlePermissionDismiss = useCallback(() => {
    setPermissionDenials(null);
  }, []);

  const handleAbort = useCallback(() => {
    if (activeSessionId) {
      send({ type: "stop_session", sessionId: activeSessionId });
    }
    setIsLoading(false);
    currentAssistantMessageRef.current = null;
  }, [activeSessionId, send]);

  const handleStopSession = useCallback(
    (sessionId: string) => {
      send({ type: "stop_session", sessionId });
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === sessionId ? { ...s, status: "idle" as const } : s,
        ),
      );
    },
    [send],
  );

  return (
    <div className="flex h-full gap-0 relative">
      <ProjectSidebar
        projects={projects}
        sessions={sessions}
        activeProjectId={activeProjectId}
        activeSessionId={activeSessionId}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onCreateProject={handleCreateProject}
        onCreateSession={handleCreateSession}
        onDeleteProject={handleDeleteProject}
        onStopSession={handleStopSession}
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toggle button bar */}
        <div className="flex items-center gap-2 px-2 py-1 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className={`p-1.5 rounded-md transition-colors text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 ${
              !sidebarOpen ? "" : isMobile ? "hidden" : ""
            }`}
            title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {isMobile && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {activeSessionId ? "会话中" : "cc-web"}
            </span>
          )}
        </div>
        <ChatMessages messages={messages} isLoading={isLoading} />
        <StatusBar
          connected={connected}
          sessionId={activeSessionId}
          model={model}
          permissionMode={permissionMode}
          tokenUsage={tokenUsage}
          taskProgress={taskProgress}
        />
        <ChatInput
          isLoading={isLoading}
          onSubmit={handleSendMessage}
          onAbort={handleAbort}
        />
      </div>

      {modelPickerOpen && (
        <ModelPicker
          models={KNOWN_MODELS}
          currentModel={model}
          onSelect={handleModelSelect}
          onClose={() => setModelPickerOpen(false)}
        />
      )}

      {permissionDenials && permissionDenials.length > 0 && (
        <PermissionDialog
          denials={permissionDenials}
          onApprove={handlePermissionApprove}
          onDismiss={handlePermissionDismiss}
        />
      )}
    </div>
  );
}
