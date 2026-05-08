import { useState, useMemo } from "react";
import type { FileTreeNode } from "../types";

interface FileTreeProps {
  tree: FileTreeNode[];
  projectPath: string;
  onFileClick?: (filePath: string, projectPath: string) => void;
}

interface FlatNode {
  node: FileTreeNode;
  depth: number;
}

export function FileTree({ tree, projectPath, onFileClick }: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const flatList = useMemo(() => {
    const result: FlatNode[] = [];
    function walk(nodes: FileTreeNode[], depth: number) {
      for (const node of nodes) {
        result.push({ node, depth });
        if (node.isDirectory && node.children && expandedDirs.has(node.path)) {
          walk(node.children, depth + 1);
        }
      }
    }
    walk(tree, 0);
    return result;
  }, [tree, expandedDirs]);

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const handleFileClick = (filePath: string) => {
    setSelectedPath(filePath);
    onFileClick?.(filePath, projectPath);
  };

  if (tree.length === 0) {
    return (
      <p className="text-xs text-slate-400 px-3 py-4 text-center">
        目录为空
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {flatList.map(({ node, depth }) => (
          <div
            key={node.path}
            onClick={() => {
              if (node.isDirectory) {
                toggleDir(node.path);
              } else {
                handleFileClick(node.path);
              }
            }}
            className={`flex items-center py-0.5 cursor-pointer select-none relative ${
              !node.isDirectory && selectedPath === node.path
                ? "bg-blue-100 dark:bg-blue-800/40"
                : "hover:bg-slate-100 dark:hover:bg-slate-700/50"
            }`}
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            {/* Indent guides: a thin vertical line for each ancestor level */}
            {depth > 0 &&
              Array.from({ length: depth }, (_, i) => (
                <span
                  key={i}
                  className="absolute top-0 bottom-0 w-px border-l border-slate-200 dark:border-slate-700"
                  style={{ left: `${i * 16 + 6}px` }}
                />
              ))}

            {/* Chevron / spacer */}
            <span className="w-3 h-3 flex-shrink-0 flex items-center justify-center mr-0.5 relative z-10">
              {node.isDirectory ? (
                <svg
                  className={`w-2.5 h-2.5 text-slate-500 dark:text-slate-400 transition-transform duration-150 ${
                    expandedDirs.has(node.path) ? "rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              ) : (
                <span className="w-2.5" />
              )}
            </span>

            {/* Icon */}
            <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center mr-1 relative z-10">
              {node.isDirectory ? (
                expandedDirs.has(node.path) ? (
                  <svg
                    className="w-4 h-4 text-amber-500 dark:text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-amber-500 dark:text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                )
              ) : (
                <svg
                  className="w-4 h-4 text-slate-400 dark:text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              )}
            </span>

            {/* Name */}
            <span className="text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap relative z-10">
              {node.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
