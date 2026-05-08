// 与 claude-code-webui shared/types.ts 完全兼容

export interface StreamResponse {
  type: "claude_json" | "error" | "done" | "aborted";
  data?: unknown; // SDKMessage object for claude_json type
  error?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  requestId: string;
  allowedTools?: string[];
  workingDirectory?: string;
  permissionMode?: "default" | "plan" | "acceptEdits";
}

export interface AbortRequest {
  requestId: string;
}

export interface ProjectInfo {
  projectId: string;
  name: string;
  path: string;
  sessionCount: number;
  createdAt: number;
}

export interface ProjectsResponse {
  projects: ProjectInfo[];
}

// Conversation history types
export interface ConversationSummary {
  sessionId: string;
  startTime: string;
  lastTime: string;
  messageCount: number;
  lastMessagePreview: string;
}

export interface HistoryListResponse {
  conversations: ConversationSummary[];
}

export interface ConversationHistory {
  sessionId: string;
  messages: unknown[];
  metadata: {
    startTime: string;
    endTime: string;
    messageCount: number;
  };
}

// Git status / diff types
export interface GitStatusFile {
  path: string;
  staged: string;       // X column (index)
  unstaged: string;     // Y column (working tree)
  displayPath: string;  // renamed files "old -> new"
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
  diff: string;         // unified diff text
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
