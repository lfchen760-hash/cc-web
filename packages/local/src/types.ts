// 与 claude-code-webui shared/types.ts 兼容的 StreamResponse
export interface StreamResponse {
  type: 'claude_json' | 'error' | 'done' | 'aborted';
  data?: unknown;
  error?: string;
}

export interface ProjectInfo {
  projectId: string;
  name: string;
  path: string;
  sessionCount: number;
  createdAt: number;
}

export interface SessionInfo {
  sessionId: string;
  projectId: string;
  projectPath: string;
  model?: string;
  permissionMode?: string;
  summary: string;
  status: 'idle' | 'running' | 'error';
  messageCount: number;
  createdAt: number;
  messages?: StreamResponse[];
}

export interface WSMessage {
  type: string;
  sessionId?: string;
  text?: string;
  projectPath?: string;
  projectId?: string;
  name?: string;
  data?: unknown;
  error?: string;
  nodeId?: string;
  token?: string;
  password?: string;
  success?: boolean;
  passwordRequired?: boolean;
  sessions?: SessionInfo[];
  projects?: ProjectInfo[];
  project?: ProjectInfo;
}
