export interface BrowserMessage {
  type: 'chat' | 'create_session' | 'stop_session' | 'list_sessions' | 'create_project' | 'delete_project' | 'list_projects' | 'select_node' | 'list_nodes' | 'retry_with_permission' | 'auth_node';
  sessionId?: string;
  text?: string;
  projectPath?: string;
  projectId?: string;
  nodeId?: string;
  name?: string;
  path?: string;
  model?: string;
  permissionMode?: string;
  password?: string;
}

export interface LocalMessage {
  type: 'register' | 'claude_json' | 'done' | 'error' | 'pong' | 'aborted' | 'session_info' | 'session_end' | 'sessions_list' | 'projects_list' | 'project_info' | 'retry_with_permission' | 'create_session' | 'create_project' | 'delete_project' | 'list_sessions' | 'list_projects' | 'stop_session' | 'chat' | 'auth_node' | 'auth_result';
  sessionId?: string;
  data?: unknown;
  error?: string;
  nodeId?: string;
  token?: string;
  projectPath?: string;
  projectId?: string;
  name?: string;
  path?: string;
  text?: string;
  model?: string;
  permissionMode?: string;
  sessions?: SessionInfo[];
  projects?: ProjectInfo[];
  project?: ProjectInfo;
  _reqId?: string;
  password?: string;
  success?: boolean;
  passwordRequired?: boolean;
}

export interface RelayMessage {
  type: 'claude_json' | 'done' | 'error' | 'aborted' | 'session_info' | 'session_end' | 'sessions_list' | 'projects_list' | 'project_info' | 'nodes_list' | 'node_selected' | 'auth_result';
  sessionId?: string;
  nodeId?: string;
  data?: unknown;
  error?: string;
  sessions?: SessionInfo[];
  projects?: ProjectInfo[];
  project?: ProjectInfo;
  nodes?: Array<{ nodeId: string; sessionCount: number; passwordRequired: boolean }>;
  success?: boolean;
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
