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

export function ChatView() {
  const { connected, lastMessage, send, onRawMessage } = useWebSocket();
  const { processStreamLine } = useClaudeStreaming();

  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AllMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState("");
  const [hasReceivedInit, setHasReceivedInit] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    costUSD: number;
    contextWindow: number;
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
              onTokenUsage: (u) => setTokenUsage(u),
            };

            processStreamLine(JSON.stringify(data), streamingContext);

            if (data.type === "claude_json" && data.data) {
              const sdkMsg = data.data as Record<string, unknown>;
              if (sdkMsg.type === "system" && sdkMsg.subtype === "init" && sdkMsg.model) {
                setModel(String(sdkMsg.model));
              }
              if (sdkMsg.type === "result" && sdkMsg.usage) {
                const u = sdkMsg.usage as Record<string, unknown>;
                let cw = 0;
                const mu = sdkMsg.modelUsage as Record<string, Record<string, unknown>> | undefined;
                if (mu) {
                  for (const m of Object.values(mu)) {
                    const w = (m.contextWindow as number) || 0;
                    if (w > cw) cw = w;
                  }
                }
                setTokenUsage({
                  inputTokens: (u.input_tokens as number) || 0,
                  outputTokens: (u.output_tokens as number) || 0,
                  cacheReadTokens: (u.cache_read_input_tokens as number) || 0,
                  costUSD: (sdkMsg.total_cost_usd as number) || 0,
                  contextWindow: cw,
                });
              }
            }

            if (
              data.type === "done" ||
              data.type === "error" ||
              data.type === "aborted"
            ) {
              setIsLoading(false);
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

  // 监听 WebSocket 新消息（直接回调）
  const lastRawRef = useRef<string | null>(null);
  useEffect(() => {
    onRawMessage((raw: string) => {
      lastRawRef.current = raw;
      handleRawMessageRef.current?.(raw);
    });
  }, [onRawMessage]);

  // 兜底
  useEffect(() => {
    if (lastMessage && lastMessage !== lastRawRef.current) {
      lastRawRef.current = lastMessage;
      handleRawMessage(lastMessage);
    }
  }, [lastMessage, handleRawMessage]);

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
      send({ type: "create_session", projectId, projectPath });
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

  const handleSendMessage = useCallback(
    (text: string) => {
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
    <div className="flex h-full gap-0">
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
      />
      <div className="flex-1 flex flex-col min-w-0">
        <ChatMessages messages={messages} isLoading={isLoading} />
        <StatusBar
          connected={connected}
          sessionId={activeSessionId}
          model={model}
          tokenUsage={tokenUsage}
        />
        <ChatInput
          isLoading={isLoading}
          onSubmit={handleSendMessage}
          onAbort={handleAbort}
        />
      </div>
    </div>
  );
}
