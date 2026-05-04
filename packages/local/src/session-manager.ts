import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SessionRunner } from './sdk-runner.js';
import type { StreamResponse, SessionInfo, ProjectInfo } from './types.js';
import { send, isConnected } from './ws-client.js';
import * as db from './db.js';

interface Session {
  sessionId: string;
  projectId: string;
  projectPath: string;
  summary: string;
  status: 'idle' | 'running' | 'error';
  messages: StreamResponse[];
  runner: SessionRunner | null;
  createdAt: number;
  claudeSessionId?: string;
}

const sessions = new Map<string, Session>();

// 消息持久化目录
const DATA_DIR = path.resolve('data/sessions');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveMessages(session: Session): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, `${session.sessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify({
    sessionId: session.sessionId,
    projectId: session.projectId,
    messages: session.messages,
    createdAt: session.createdAt,
    updatedAt: Date.now(),
    claudeSessionId: session.claudeSessionId,
  }, null, 2));
}

function loadMessages(sessionId: string): StreamResponse[] {
  const filePath = path.join(DATA_DIR, `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.messages || [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Project API ──────────────────────────────────────────

export function createProject(name: string, projectPath: string): ProjectInfo {
  const id = randomUUID();
  const row = db.createProject(id, name, projectPath);
  return {
    projectId: row.id,
    name: row.name,
    path: row.path,
    sessionCount: 0,
    createdAt: row.created_at,
  };
}

export function listProjects(): ProjectInfo[] {
  const rows = db.listProjects();
  // 为每个项目统计会话数
  const sessionCounts = new Map<string, number>();
  const allSessions = db.listSessionsByProject();
  for (const s of allSessions) {
    sessionCounts.set(s.project_id, (sessionCounts.get(s.project_id) || 0) + 1);
  }
  return rows.map((r) => ({
    projectId: r.id,
    name: r.name,
    path: r.path,
    sessionCount: sessionCounts.get(r.id) || 0,
    createdAt: r.created_at,
  }));
}

export function deleteProject(projectId: string): boolean {
  // 先删除该项目下所有会话的内存状态和消息文件
  const projectSessions = db.listSessionsByProject(projectId);
  for (const s of projectSessions) {
    const memSession = sessions.get(s.id);
    if (memSession?.runner) {
      memSession.runner.close();
    }
    sessions.delete(s.id);
    const filePath = path.join(DATA_DIR, `${s.id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  return db.deleteProject(projectId);
}

// ─── Session API ──────────────────────────────────────────

export function createSession(projectId: string, projectPath: string): SessionInfo {
  const sessionId = randomUUID();
  const row = db.createSession(sessionId, projectId);
  const session: Session = {
    sessionId,
    projectId,
    projectPath,
    summary: '',
    status: 'idle',
    messages: [],
    runner: null,
    createdAt: row.created_at,
  };
  sessions.set(sessionId, session);
  return {
    sessionId,
    projectId,
    projectPath,
    summary: '',
    status: 'idle',
    messageCount: 0,
    createdAt: session.createdAt,
  };
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function getSessionInfo(sessionId: string): SessionInfo | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  return {
    sessionId: session.sessionId,
    projectId: session.projectId,
    projectPath: session.projectPath,
    summary: session.summary,
    status: session.status,
    messageCount: session.messages.length,
    createdAt: session.createdAt,
  };
}

export function listSessions(projectId?: string): SessionInfo[] {
  const rows = db.listSessionsByProject(projectId);
  return rows.map((r) => {
    // 如果有内存中的 session，用内存数据（更实时）
    const mem = sessions.get(r.id);
    const projectPath = mem?.projectPath || getProjectPath(r.project_id);
    return {
      sessionId: r.id,
      projectId: r.project_id,
      projectPath,
      summary: r.summary,
      status: (r.status as 'idle' | 'running' | 'error'),
      messageCount: r.message_count,
      createdAt: r.created_at,
      messages: mem?.messages || loadMessages(r.id),
    };
  });
}

function getProjectPath(projectId: string): string {
  const p = db.getProject(projectId);
  return p?.path || '';
}

export function getHistory(sessionId: string): StreamResponse[] | undefined {
  const session = sessions.get(sessionId);
  if (session) return session.messages;
  return loadMessages(sessionId);
}

function isSdkResult(resp: StreamResponse): boolean {
  if (resp.type !== 'claude_json') return false;
  const data = resp.data as { type?: string } | undefined;
  return data?.type === 'result';
}

function isSdkInit(resp: StreamResponse): string | undefined {
  if (resp.type !== 'claude_json') return undefined;
  const data = resp.data as { type?: string; subtype?: string; session_id?: string } | undefined;
  if (data?.type === 'system' && data?.subtype === 'init') {
    return data.session_id;
  }
  return undefined;
}

// 自动生成会话摘要（首次用户消息前 50 字）
export function generateSummary(sessionId: string, text: string): void {
  const session = sessions.get(sessionId);
  if (!session || session.summary) return; // 已有摘要则跳过

  const summary = text.replace(/\s+/g, ' ').trim().substring(0, 50);
  session.summary = summary;
  db.updateSessionSummary(sessionId, summary);
}

export function sendMessage(
  sessionId: string,
  text: string,
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.status = 'running';
  db.updateSessionStatus(sessionId, 'running');

  // 如果还没有 runner，创建并启动
  if (!session.runner) {
    const controller = new AbortController();
    const runner = new SessionRunner({
      claudeSessionId: session.claudeSessionId,
      projectPath: session.projectPath,
      signal: controller.signal,
      onMessage: (resp) => {
        // 存入历史
        session.messages.push(resp);

        // 捕获 Claude session_id（首次 init 消息返回）
        if (!session.claudeSessionId) {
          const sid = isSdkInit(resp);
          if (sid) {
            session.claudeSessionId = sid;
            db.updateSessionClaudeId(sessionId, sid);
          }
        }

        // 发送到中转（附加 sessionId）
        if (isConnected()) {
          send({ ...resp, sessionId });
        }

        // 当收到 result 时，本轮对话结束
        if (isSdkResult(resp)) {
          session.status = 'idle';
          db.updateSessionStatus(sessionId, 'idle');
          db.incrementMessageCount(sessionId);
          if (isConnected()) {
            send({ type: 'done', sessionId });
          }
          saveMessages(session);
        }
      },
    });
    runner.start();
    session.runner = runner;
  }

  // 发送用户消息到持久进程的 stdin
  const ok = session.runner.send(text);
  if (!ok) {
    session.status = 'error';
    db.updateSessionStatus(sessionId, 'error');
    if (isConnected()) {
      send({ type: 'error', sessionId, error: 'Claude CLI 进程异常' });
    }
    return false;
  }

  return true;
}

export function stopSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  if (session.runner) {
    session.runner.close();
    session.runner = null;
  }

  session.status = 'idle';
  db.updateSessionStatus(sessionId, 'idle');
  saveMessages(session);

  if (isConnected()) {
    send({ type: 'session_end', sessionId, reason: 'stopped' });
  }

  return true;
}

export function deleteSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  if (session.runner) {
    session.runner.close();
    session.runner = null;
  }

  sessions.delete(sessionId);
  db.deleteSession(sessionId);

  const filePath = path.join(DATA_DIR, `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return true;
}

export function loadPersistedSessions(): void {
  ensureDataDir();

  try {
    const rows = db.listSessionsByProject();
    for (const row of rows) {
      const messages = loadMessages(row.id);
      const project = db.getProject(row.project_id);
      const session: Session = {
        sessionId: row.id,
        projectId: row.project_id,
        projectPath: project?.path || '',
        summary: row.summary,
        status: 'idle',
        messages,
        runner: null,
        createdAt: row.created_at,
        claudeSessionId: row.claude_session_id || undefined,
      };
      sessions.set(row.id, session);
    }
    console.log(`已加载 ${sessions.size} 个持久化会话`);
  } catch (err) {
    console.error('加载持久化会话失败:', err);
  }
}
