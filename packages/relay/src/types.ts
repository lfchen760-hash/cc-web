export interface BrowserMessage {
  type: 'chat' | 'create_session' | 'stop_session' | 'list_sessions' | 'create_project' | 'delete_project' | 'list_projects';
  sessionId?: string;
  text?: string;
  projectPath?: string;
  projectId?: string;
  name?: string;
  path?: string;
}

export interface LocalMessage {
  type: 'register' | 'claude_json' | 'done' | 'error' | 'pong' | 'aborted' | 'session_info' | 'session_end' | 'sessions_list' | 'projects_list' | 'project_info';
  sessionId?: string;
  data?: unknown;
  error?: string;
  nodeId?: string;
  token?: string;
  sessions?: SessionInfo[];
  projects?: ProjectInfo[];
  project?: ProjectInfo;
  _reqId?: string;
}

export interface RelayMessage {
  type: 'claude_json' | 'done' | 'error' | 'aborted' | 'session_info' | 'session_end' | 'sessions_list' | 'projects_list' | 'project_info';
  sessionId?: string;
  data?: unknown;
  error?: string;
  sessions?: SessionInfo[];
  projects?: ProjectInfo[];
  project?: ProjectInfo;
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
  summary: string;
  status: 'idle' | 'running' | 'error';
  messageCount: number;
  createdAt: number;
  messages?: unknown[];
}
