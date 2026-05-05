import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { StreamResponse } from './types.js';

/** 找到真正的 claude CLI 路径，避开 node_modules/.bin 里的李鬼 */
function resolveClaudeBin(): string {
  const isWindows = process.platform === 'win32';
  const cleanPath = (process.env.PATH || '')
    .split(':')
    .filter((p) => !p.includes('node_modules'))
    .join(':');

  try {
    const cmd = isWindows ? 'where claude' : 'which claude';
    const output = execSync(cmd, { encoding: 'utf-8', env: { ...process.env, PATH: cleanPath } }).trim();
    const lines = output.split('\n').map((s: string) => s.trim()).filter(Boolean);
    // Windows: 优先选 .cmd/.bat 后缀（排除 node_modules 版本）
    for (const line of lines) {
      if (!line.includes('node_modules') && (line.endsWith('.cmd') || line.endsWith('.bat'))) return line;
    }
    for (const line of lines) {
      if (!line.includes('node_modules')) return line;
    }
  } catch { /* 忽略 */ }

  if (isWindows) {
    return process.env.APPDATA + '\\npm\\claude.cmd';
  }
  return 'claude';
}

export interface SessionRunnerOptions {
  claudeSessionId?: string;
  projectPath: string;
  model?: string;
  permissionMode?: string;
  signal: AbortSignal;
  onMessage: (resp: StreamResponse) => void;
}

/**
 * 长生命周期 Claude CLI 进程管理器。
 *
 * 使用 --input-format stream-json + --output-format stream-json 保持进程存活，
 * 通过 stdin/stdout NDJSON 进行多轮对话，无需每次 spawn 新进程。
 */
export class SessionRunner {
  private child: ChildProcess | null = null;
  private aborted = false;
  private options: SessionRunnerOptions;
  private pendingResolve: (() => void) | null = null;

  constructor(options: SessionRunnerOptions) {
    this.options = options;
  }

  /** 启动 Claude CLI 交互进程 */
  start(): void {
    const { claudeSessionId, projectPath, model, permissionMode, signal, onMessage } = this.options;

    const args = [
      '--print',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
    ];
    if (model) {
      args.push('--model', model);
    }
    if (permissionMode) {
      args.push('--permission-mode', permissionMode);
    }
    if (claudeSessionId) {
      args.push('--resume', claudeSessionId);
    }

    try {
      const isWindows = process.platform === 'win32';
      const env = { ...process.env };
      if (isWindows && !env.CLAUDE_CODE_GIT_BASH_PATH) {
        env.CLAUDE_CODE_GIT_BASH_PATH = String.raw`D:\Program Files\Git\bin\bash.exe`;
      }
      console.log('[sdk-runner] GIT_BASH=', JSON.stringify(env.CLAUDE_CODE_GIT_BASH_PATH));
      const claudeBin = resolveClaudeBin();
      console.log('[sdk-runner] claude bin:', claudeBin);
      console.log('[sdk-runner] args:', args.join(' '));

      this.child = spawn(claudeBin, args, {
        cwd: projectPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: claudeBin.endsWith('.cmd'),
        windowsHide: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onMessage({ type: 'error', error: `无法启动 claude CLI: ${message}` });
      return;
    }

    // 逐行读取 stdout (NDJSON)
    const rl = createInterface({ input: this.child.stdout! });

    signal.addEventListener('abort', () => {
      this.aborted = true;
      this.close();
    });

    rl.on('line', (line) => {
      if (this.aborted) return;

      try {
        const sdkMessage = JSON.parse(line);
        onMessage({ type: 'claude_json', data: sdkMessage });
      } catch {
        // 非 JSON 行（如 stderr），忽略
      }
    });

    // stderr 仅记录不发送
    if (this.child.stderr) {
      this.child.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          console.log('[claude stderr]', text.substring(0, 200));
        }
      });
    }

    this.child.on('close', (code) => {
      if (this.aborted) {
        onMessage({ type: 'aborted' });
      } else if (code === 0 || code === null) {
        onMessage({ type: 'done' });
      } else {
        onMessage({ type: 'error', error: `claude 进程退出码: ${code}` });
      }
      if (this.pendingResolve) {
        this.pendingResolve();
        this.pendingResolve = null;
      }
    });

    this.child.on('error', (err) => {
      if (!this.aborted) {
        onMessage({ type: 'error', error: err.message });
      }
      if (this.pendingResolve) {
        this.pendingResolve();
        this.pendingResolve = null;
      }
    });
  }

  /** 发送用户消息到 Claude CLI 的 stdin */
  send(text: string): boolean {
    if (!this.child || this.aborted) return false;
    const msg = {
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text }],
      },
    };
    try {
      this.child.stdin!.write(JSON.stringify(msg) + '\n');
      return true;
    } catch {
      return false;
    }
  }

  /** 关闭 stdin，触发进程优雅退出 */
  close(): void {
    if (this.child && !this.aborted) {
      try {
        this.child.stdin!.end();
      } catch {
        // 忽略
      }
    }
  }

  /** 等待进程退出 */
  waitForExit(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.child || this.child.killed) {
        resolve();
        return;
      }
      this.pendingResolve = resolve;
    });
  }
}
