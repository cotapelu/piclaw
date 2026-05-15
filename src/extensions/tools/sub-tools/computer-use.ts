import { Type } from "typebox";

// ============================================================================
// Schemas
// ============================================================================

export const bashSchema = Type.Object({
  command: Type.String({ description: "Bash command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds" })),
});

export const lsSchema = Type.Object({
  path: Type.Optional(Type.String({ description: "Directory to list (default: cwd)" })),
});

export const findSchema = Type.Object({
  pattern: Type.String({ description: "Glob pattern, e.g. '*.ts', '**/*.json'" }),
  path: Type.Optional(Type.String({ description: "Directory to search (default: cwd)" })),
  limit: Type.Optional(Type.Number({ description: "Max results (default: 1000)" })),
});

export const grepSchema = Type.Object({
  pattern: Type.String({ description: "Search pattern (regex or literal)" }),
  path: Type.Optional(Type.String({ description: "Directory/file to search (default: cwd)" })),
  ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive search" })),
  limit: Type.Optional(Type.Number({ description: "Max matches (default: 100)" })),
});

export const readSchema = Type.Object({
  path: Type.String({ description: "File path to read" }),
  offset: Type.Optional(Type.Number({ description: "Start line (1-indexed)" })),
  limit: Type.Optional(Type.Number({ description: "Max lines" })),
});

// ============================================================================
// Execute functions
// ============================================================================

// Helper: run bash command via ctx.exec
async function runBash(
  command: string,
  cwd: string,
  signal?: AbortSignal,
  timeout?: number,
  ctx?: any, // ExtensionContext with exec()
) {
  if (!ctx?.exec) throw new Error("ctx.exec not available");
  return await ctx.exec("bash", ["-c", command], { cwd, signal, timeout });
}

export async function executeBash(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout } = args as { command: string; timeout?: number };
  try {
    const result = await runBash(command, cwd, signal, timeout, ctx);
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

export async function executeLs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { path } = args as { path?: string };
  const targetPath = path || cwd;
  try {
    const result = await ctx!.exec("ls", ["-la", targetPath], { signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

export async function executeFind(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { pattern, path: searchPath, limit } = args as { pattern: string; path?: string; limit?: number };
  const targetPath = searchPath || cwd;
  const maxResults = limit || 1000;
  try {
    const result = await ctx!.exec("find", [targetPath, "-name", pattern], { signal });
    if (result.code !== 0) {
      return { content: [{ type: "text", text: result.stderr || `find error ${result.code}` }], details: undefined, isError: true } as const;
    }
    const lines = result.stdout.split("\n").filter((l: string) => l.trim() !== "");
    const truncated = lines.length > maxResults;
    const limited = truncated ? lines.slice(0, maxResults) : lines;
    let output = limited.join("\n");
    if (truncated) output += `\n\n[Truncated: ${maxResults}/${lines.length}]`;
    return {
      content: [{ type: "text", text: output }],
      details: { total: lines.length, returned: limited.length, truncated },
      isError: false,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

export async function executeGrep(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { pattern, path: searchPath, ignoreCase, limit } = args as {
    pattern: string;
    path?: string;
    ignoreCase?: boolean;
    limit?: number;
  };
  const targetPath = searchPath || cwd;
  const maxMatches = limit || 100;
  try {
    const grepArgs = ["-r", pattern, targetPath];
    if (ignoreCase) grepArgs.splice(1, 0, "-i");
    const result = await ctx!.exec("grep", grepArgs, { signal });
    if (result.code !== 0 && result.code !== 1) {
      return { content: [{ type: "text", text: result.stderr || `grep error ${result.code}` }], details: undefined, isError: true } as const;
    }
    const lines = result.stdout.split("\n").filter((l: string) => l.trim() !== "");
    const truncated = lines.length > maxMatches;
    const limited = truncated ? lines.slice(0, maxMatches) : lines;
    let output = limited.join("\n");
    if (truncated) output += `\n\n[Truncated: ${maxMatches}/${lines.length}]`;
    if (lines.length === 0) output = "(no matches)";
    return {
      content: [{ type: "text", text: output }],
      details: { total: lines.length, returned: limited.length, truncated },
      isError: false,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

export async function executeRead(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { path: filePath, offset, limit } = args as { path: string; offset?: number; limit?: number };
  const MAX_LINES = 1000;
  try {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(filePath, "utf-8");
    const allLines = content.split("\n");
    const start = offset && offset > 1 ? offset - 1 : 0;
    const end = limit ? start + limit : undefined;
    const selected = allLines.slice(start, end);
    let output = selected.join("\n");
    const truncated = end && allLines.length > end;
    if (truncated) output += `\n\n[Truncated: ${selected.length}/${allLines.length} lines]`;
    return {
      content: [{ type: "text", text: output }],
      details: { totalLines: allLines.length, returnedLines: selected.length, truncated },
      isError: false,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
