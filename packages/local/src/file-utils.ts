import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { FileTreeNode, FileTreeResult } from "./types.js";

const SKIP_PATTERNS = [
  ".git",
  "node_modules",
  ".next",
  "dist",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".claude",
];

const SKIP_EXTENSIONS = new Set([
  ".exe", ".dll", ".so", ".dylib", ".bin", ".obj", ".o", ".a", ".lib",
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico", ".webp",
  ".mp3", ".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".pdf", ".doc", ".docx", ".ttf", ".woff", ".woff2",
]);

const MAX_DEPTH = 20;

function shouldSkip(name: string): boolean {
  for (const pattern of SKIP_PATTERNS) {
    if (name === pattern) return true;
  }
  if (name.startsWith(".") && name !== ".env" && name !== ".env.local") return true;
  return false;
}

function readDirRecursive(
  absPath: string,
  relPath: string,
  depth: number,
): FileTreeNode[] {
  if (depth > MAX_DEPTH) return [];

  let entries: string[];
  try {
    entries = readdirSync(absPath);
  } catch {
    return [];
  }

  const result: FileTreeNode[] = [];

  for (const name of entries.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  )) {
    if (shouldSkip(name)) continue;

    const childAbsPath = join(absPath, name);
    const childRelPath = relPath ? `${relPath}/${name}` : name;

    let isDir: boolean;
    try {
      isDir = statSync(childAbsPath).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      const children = readDirRecursive(childAbsPath, childRelPath, depth + 1);
      result.push({ name, path: childRelPath, isDirectory: true, children });
    } else {
      const ext = name.includes(".")
        ? name.slice(name.lastIndexOf(".")).toLowerCase()
        : "";
      if (SKIP_EXTENSIONS.has(ext)) continue;
      result.push({ name, path: childRelPath, isDirectory: false });
    }
  }

  return result;
}

export function getFileTree(
  projectPath: string,
  projectId: string,
): FileTreeResult {
  const result: FileTreeResult = {
    projectPath,
    projectId,
    tree: [],
  };
  try {
    result.tree = readDirRecursive(projectPath, "", 0);
  } catch (err) {
    result.error = (err as Error).message;
  }
  return result;
}
