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
  filePath?: string;
  staged?: boolean;
  gitStatus?: GitStatusResult;
  diffResult?: GitDiffResult;
  fileTreeResult?: FileTreeResult;
}

export interface GitStatusFile {
  path: string;
  staged: string;
  unstaged: string;
  displayPath: string;
}

export interface GitStatusResult {
  projectPath: string;
  projectId: string;
  isGitRepo: boolean;
  error?: string;
  staged: GitStatusFile[];
  unstaged: GitStatusFile[];
  untracked: GitStatusFile[];
}

export interface GitDiffResult {
  projectPath: string;
  filePath: string;
  diff: string;
  error?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

export interface FileTreeResult {
  projectPath: string;
  projectId: string;
  tree: FileTreeNode[];
  error?: string;
}
