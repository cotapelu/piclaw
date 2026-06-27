#!/usr/bin/env node

/**
 * File System Operations
 * Convenience wrappers for common file operations.
 *
 * These provide typed schemas and cleaner error handling vs raw bash.
 * For general command execution, use the built-in 'bash' tool.
 */

import { Type } from "typebox";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

// ============================================================================
// Schemas
// ============================================================================

export const lsSchema = Type.Object({
  path: Type.Optional(Type.String()),
  recursive: Type.Optional(Type.Boolean()),
  all: Type.Optional(Type.Boolean()), // Show hidden files (-la)
});

export const findSchema = Type.Object({
  path: Type.Optional(Type.String()),
  pattern: Type.String({ description: "Glob pattern (e.g., '*.ts', '**/*.js')" }),
  maxDepth: Type.Optional(Type.Number()),
});

export const grepSchema = Type.Object({
  pattern: Type.String({ description: "Search pattern (regex)" }),
  path: Type.Optional(Type.String()),
  include: Type.Optional(Type.String()), // File glob (--include)
  exclude: Type.Optional(Type.String()), // File/dir to exclude (--exclude)
  ignoreCase: Type.Optional(Type.Boolean()),
});

export const readSchema = Type.Object({
  path: Type.String({ description: "File path to read" }),
  offset: Type.Optional(Type.Number()), // Skip first N lines (1-indexed)
  limit: Type.Optional(Type.Number()),  // Read only N lines
});

// ============================================================================
// Executors
// ============================================================================

/**
 * List directory contents (ls)
 */
export async function executeLs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { path, recursive = false, all = false } = args as { path?: string; recursive?: boolean; all?: boolean };
  try {
    const lsArgs: string[] = [];
    if (all) lsArgs.push("-la");
    else if (recursive) lsArgs.push("-lR");
    else if (path) lsArgs.push("-l", path);
    else lsArgs.push("-l");

    const targetPath = path || cwd;
    const result = await ctx!.exec("ls", lsArgs, { cwd: targetPath, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, path: targetPath },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ls error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

/**
 * Find files by pattern (find)
 */
export async function executeFind(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { pattern, path = cwd, maxDepth } = args as { pattern: string; path?: string; maxDepth?: number };
  try {
    const findArgs: string[] = [path];
    if (maxDepth) findArgs.push("-maxdepth", String(maxDepth));
    findArgs.push("-name", pattern);

    const result = await ctx!.exec("find", findArgs, { cwd, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, pattern, path },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `find error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

/**
 * Search file contents (grep)
 */
export async function executeGrep(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { pattern, path = cwd, include, exclude, ignoreCase = false } = args as {
    pattern: string;
    path?: string;
    include?: string;
    exclude?: string;
    ignoreCase?: boolean;
  };
  try {
    const grepArgs: string[] = [];
    if (ignoreCase) grepArgs.push("-i");
    if (include) grepArgs.push("--include", include);
    if (exclude) grepArgs.push("--exclude", exclude);
    grepArgs.push("-r"); // recursive
    grepArgs.push(pattern);

    const result = await ctx!.exec("grep", grepArgs, { cwd: path || cwd, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, pattern, path: path || cwd },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `grep error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

/**
 * Read file contents with optional offset/limit
 * Uses cat + tail/head with proper escaping and path validation.
 */
export async function executeRead(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { path: filePath, offset, limit } = args as { path: string; offset?: number; limit?: number };
  try {
    // Validate path: prevent traversal outside cwd
    const baseDir = resolve(cwd);
    const resolved = resolve(cwd, filePath);
    if (!resolved.startsWith(baseDir + "/") && resolved !== baseDir) {
      throw new Error(`Path traversal detected: ${filePath}`);
    }
    // Read file directly using Node.js (cross-platform)
    const content = await readFile(resolved, "utf-8");
    let lines = content.split(/\r?\n/);
    // Offset: tail -n +N starts at line N (1-indexed)
    if (offset && offset > 0) {
      lines = lines.slice(offset - 1);
    }
    // Limit: head -n N
    if (limit !== undefined) {
      lines = lines.slice(0, limit);
    }
    const output = lines.join("\n");
    return {
      content: [{ type: "text", text: output }],
      details: { exitCode: 0, killed: false, path: filePath, offset, limit },
      isError: false,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `read error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
