import { start, onMessage, send } from './ws-client.js';
import { NODE_PASSWORD, NODE_ID } from './config.js';
import {
  createSession,
  sendMessage,
  stopSession,
  retryWithPermission,
  updatePermissionMode,
  listSessions,
  getSession,
  getHistory,
  generateSummary,
  loadPersistedSessions,
  createProject,
  listProjects,
  deleteProject,
} from './session-manager.js';

// 加载持久化会话
loadPersistedSessions();

// 处理来自中转的消息
onMessage((msg) => {
  // 回传 _reqId（用于 HTTP API 请求-响应匹配）
  const reqId = msg._reqId as string | undefined;
  const reply = (data: Record<string, unknown>) => {
    if (reqId) data._reqId = reqId;
    send(data);
  };

  switch (msg.type) {
    case 'registered':
      console.log('已在服务中注册');
      break;

    case 'chat': {
      let sessionId = msg.sessionId as string | undefined;
      const text = msg.text as string | undefined;
      const permMode = msg.permissionMode as string | undefined;
      if (!text) return;

      // 无有效会话时自动创建默认项目+会话
      if (!sessionId || !getSession(sessionId)) {
        const projects = listProjects();
        let project = projects[0];
        if (!project) {
          project = createProject('default', process.cwd());
          send({ type: 'projects_list', projects: listProjects() });
        }
        const info = createSession(project.projectId, project.projectPath, undefined, permMode);
        sessionId = info.sessionId;
        send({ type: 'session_info', ...info });
      }

      // 同步前端设置的权限模式
      if (permMode) {
        updatePermissionMode(sessionId, permMode);
      }
      console.log(`收到消息 [${sessionId.substring(0, 8)}]: ${text.substring(0, 50)}...`);
      generateSummary(sessionId, text);
      const ok = sendMessage(sessionId, text);
      if (!ok) {
        send({ type: 'error', sessionId, error: `会话 ${sessionId.substring(0, 8)} 不存在` });
      }
      break;
    }

    case 'create_project': {
      const name = (msg.name as string) || '';
      const projectPath = (msg.path as string) || process.cwd();
      if (!name) {
        reply({ type: 'error', error: '项目名称不能为空' });
        return;
      }
      const project = createProject(name, projectPath);
      console.log(`项目已创建: ${project.name} (${project.projectId.substring(0, 8)})`);
      reply({ type: 'project_info', project });
      // 同时广播项目列表（不通过 reply，避免 _reqId 污染广播）
      const projects = listProjects();
      send({ type: 'projects_list', projects });
      break;
    }

    case 'list_projects': {
      const projects = listProjects();
      reply({ type: 'projects_list', projects });
      break;
    }

    case 'delete_project': {
      const projectId = msg.projectId as string;
      if (!projectId) return;
      const ok = deleteProject(projectId);
      if (ok) {
        console.log(`项目已删除: ${projectId.substring(0, 8)}`);
        const projects = listProjects();
        send({ type: 'projects_list', projects });
      }
      break;
    }

    case 'create_session': {
      const projectId = (msg.projectId as string) || '';
      const projectPath = (msg.projectPath as string) || process.cwd();
      const model = (msg.model as string) || undefined;
      const permissionMode = (msg.permissionMode as string) || undefined;
      if (!projectId) {
        reply({ type: 'error', error: '创建会话需要指定 projectId' });
        return;
      }
      const info = createSession(projectId, projectPath, model, permissionMode);
      console.log(`会话已创建: ${info.sessionId.substring(0, 8)} (${projectPath})${model ? `, 模型=${model}` : ""}${permissionMode ? `, 权限=${permissionMode}` : ""}`);
      send({ type: 'session_info', ...info });
      const projects = listProjects();
      send({ type: 'projects_list', projects });
      break;
    }

    case 'retry_with_permission': {
      const sid = msg.sessionId as string;
      const permMode = (msg.permissionMode as string) || "bypassPermissions";
      if (sid) retryWithPermission(sid, permMode);
      break;
    }

    case 'stop_session': {
      const sid = msg.sessionId as string;
      if (sid) stopSession(sid);
      break;
    }

    case 'list_sessions': {
      const projectId = msg.projectId as string | undefined;
      const sessions = listSessions(projectId);
      const sessionsWithHistory = sessions.map((s) => ({
        ...s,
        messages: getHistory(s.sessionId) || [],
      }));
      reply({ type: 'sessions_list', sessions: sessionsWithHistory });
      break;
    }

    case 'auth_node': {
      const password = msg.password as string;
      if (!NODE_PASSWORD) {
        reply({ type: 'auth_result', nodeId: NODE_ID, success: true });
      } else if (password === NODE_PASSWORD) {
        reply({ type: 'auth_result', nodeId: NODE_ID, success: true });
      } else {
        reply({ type: 'auth_result', nodeId: NODE_ID, success: false, error: '密码错误' });
      }
      break;
    }
  }
});

console.log('cc-web 本地服务已启动');
start();

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭本地服务...');
  process.exit(0);
});
