import { useState } from "react";
import type { SessionInfo, ProjectInfo } from "../types";

interface ProjectSidebarProps {
  projects: ProjectInfo[];
  sessions: SessionInfo[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (sessionId: string, projectId: string) => void;
  onCreateProject: (name: string, path: string) => void;
  onCreateSession: (projectId: string, projectPath: string) => void;
  onDeleteProject: (projectId: string) => void;
  onStopSession: (sessionId: string) => void;
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
}

function statusColor(status: string) {
  switch (status) {
    case "running":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

export function ProjectSidebar({
  projects,
  sessions,
  activeProjectId,
  activeSessionId,
  onSelectProject,
  onSelectSession,
  onCreateProject,
  onCreateSession,
  onDeleteProject,
  onStopSession,
  isOpen,
  isMobile,
  onClose,
}: ProjectSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
    onSelectProject(projectId);
  };

  const handleCreateProject = () => {
    const name = prompt("请输入项目名称:", "");
    if (!name) return;
    const projectPath = prompt("请输入项目路径:", "D:\\codes\\");
    if (!projectPath) return;
    onCreateProject(name, projectPath);
  };

  const handleCreateSession = (project: ProjectInfo) => {
    onCreateSession(project.projectId, project.path);
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.add(project.projectId);
      return next;
    });
  };

  const handleSelectSession = (sessionId: string, projectId: string) => {
    onSelectSession(sessionId, projectId);
    if (isMobile) onClose();
  };

  const getSessionsForProject = (projectId: string): SessionInfo[] => {
    return sessions
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt);
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white/80 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          项目列表
        </h2>
        {isMobile && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-8">
            暂无项目，点击下方按钮新建
          </p>
        ) : (
          projects.map((project) => {
            const isExpanded = expandedProjects.has(project.projectId);
            const projectSessions = getSessionsForProject(project.projectId);

            return (
              <div key={project.projectId} className="mb-1">
                <div
                  onClick={() => toggleProject(project.projectId)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    activeProjectId === project.projectId
                      ? "bg-blue-50 dark:bg-blue-900/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <span className="text-sm text-slate-400">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                    {project.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {project.sessionCount}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateSession(project);
                    }}
                    className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                    title="新建会话"
                  >
                    +
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`确定删除项目 "${project.name}" 及其所有会话？`)) {
                        onDeleteProject(project.projectId);
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-600"
                    title="删除项目"
                  >
                    ✕
                  </button>
                </div>

                {isExpanded && (
                  <div className="ml-6 border-l border-slate-200 dark:border-slate-700">
                    {projectSessions.length === 0 ? (
                      <p className="text-xs text-slate-400 px-3 py-2">
                        暂无会话
                      </p>
                    ) : (
                      projectSessions.map((s) => (
                        <div
                          key={s.sessionId}
                          onClick={() => handleSelectSession(s.sessionId, project.projectId)}
                          className={`ml-1 mb-0.5 p-2.5 rounded-lg cursor-pointer transition-colors ${
                            activeSessionId === s.sessionId
                              ? "bg-blue-100 dark:bg-blue-800/40 border border-blue-300 dark:border-blue-600"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor(s.status)}`}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">
                              {s.summary || "新会话"}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              {s.messageCount} 条消息
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(s.createdAt).toLocaleDateString()}
                            </span>
                            {s.status === "running" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStopSession(s.sessionId);
                                }}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                停止
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={handleCreateProject}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + 新建项目
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black/40 z-30 transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={onClose}
        />
        {/* Drawer */}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-[300px] transition-transform duration-300 ease-in-out ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div
      className={`flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
        isOpen ? "w-[300px]" : "w-0"
      }`}
    >
      <div className="w-[300px] h-full">
        {sidebarContent}
      </div>
    </div>
  );
}
