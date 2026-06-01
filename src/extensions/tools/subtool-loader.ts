#!/usr/bin/env node
/**
 * SubTool Loader
 * Provides a tool that delegates to specific sub-tools.
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";

interface SubToolContext {
  session?: { cwd?: string };
  exec: (command: string, args: string[], options?: { cwd?: string }) => Promise<{ stdout: string; code: number }>;
}

// The internal implementation that uses simplified signature (params, ctx)
function executeSubtool(params: { subtool: string; args: any }, ctx: SubToolContext): Promise<any> {
  const { subtool, args } = params;
  if (!subtool || !args) {
    return Promise.reject(new Error("Missing subtool or args"));
  }

  let command: string;
  let commandArgs: string[];

  switch (subtool) {
    case "http":
      command = "curl";
      commandArgs = buildCurlArgs(args);
      break;
    case "ls":
      command = "ls";
      commandArgs = buildLsArgs(args);
      break;
    case "find":
      command = "find";
      commandArgs = buildFindArgs(args);
      break;
    case "grep":
      command = "grep";
      commandArgs = buildGrepArgs(args);
      break;
    case "read":
      command = "bash";
      commandArgs = buildReadArgs(args);
      break;
    default:
      return Promise.resolve({
        isError: true,
        content: [{ type: 'text', text: `Unknown sub-tool: ${subtool}` }]
      });
  }

  if (typeof ctx.exec !== "function") {
    return Promise.reject(new Error("Context does not provide exec method"));
  }

  // Determine cwd: use ctx.session?.cwd if available
  const cwd = ctx.session?.cwd;
  return ctx.exec(command, commandArgs, cwd ? { cwd } : undefined)
    .then(result => {
      if (result.code !== 0) {
        return {
          isError: true,
          content: [{ type: 'text', text: result.stdout || `Command failed with exit code ${result.code}` }]
        };
      }
      return {
        isError: false,
        content: [{ type: 'text', text: result.stdout }]
      };
    });
}

// Build helpers for each sub-tool
function buildCurlArgs(args: any): string[] {
  const { url, method = "GET", headers, body } = args;
  const curlArgs: string[] = ["-sS"]; // silent but show errors
  if (method && method !== "GET") {
    curlArgs.push("-X", method);
  }
  if (headers && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      curlArgs.push("-H", `${key}: ${value}`);
    }
  }
  if (body) {
    curlArgs.push("-d", body);
  }
  curlArgs.push(url);
  return curlArgs;
}

function buildLsArgs(args: any): string[] {
  const { all = false } = args;
  if (all) {
    return ["-la"];
  }
  // Default listing
  return ["-la"];
}

function buildFindArgs(args: any): string[] {
  const { pattern, path = "." } = args;
  return [path, "-name", pattern];
}

function buildGrepArgs(args: any): string[] {
  const { pattern, path = "." } = args;
  return ["-r", pattern, path];
}

function buildReadArgs(args: any): string[] {
  const { path: filePath } = args;
  if (!filePath) {
    throw new Error("Missing path for read sub-tool");
  }
  // Escape single quotes in path
  const escapedPath = `'${filePath.replace(/'/g, `'\\''`)}'`;
  return ["-c", `cat ${escapedPath}`];
}

// ==================== REGISTRATION ====================

/**
 * Creates a sub-tool loader tool definition with a simplified execute signature (params, ctx).
 * Used for direct testing and internal purposes.
 */
export function createSubLoaderToolDefinition(): any {
  return {
    name: "subtool_loader",
    label: "SubTool Loader",
    description:
      "This tool provides convenience sub-tools for common operations: file listing (ls), finding (find), greping (grep), reading (read), and HTTP requests (http).",
    promptSnippet:
      "Use `subtool_loader` with `subtool` parameter to select the operation and `args` for parameters.",
    promptGuidelines: [
      "The tool supports the following sub-tools:",
      "- ls: list files (args: { all?: boolean }) → '-la'",
      "- find: find files (args: { pattern: string }) → 'find . -name pattern'",
      "- grep: search text (args: { pattern: string, path?: string }) → 'grep -r pattern [path]'",
      "- read: read file (args: { path: string }) → 'cat path'",
      "- http: web request (args: { url: string, method?: string, headers?: Record<string,string>, body?: string }) → 'curl ...'",
    ],
    parameters: {
      type: "object",
      properties: {
        subtool: {
          type: "string",
          enum: ["http", "ls", "find", "grep", "read"],
          description: "Which sub-tool to invoke",
        },
        args: {
          type: "object",
          description: "Arguments specific to the selected sub-tool",
        },
      },
      required: ["subtool", "args"],
    },
    // This execute matches test's expectation: (params, ctx)
    execute: executeSubtool,
  };
}

/**
 * Registers the sub-tool loader extension with the API.
 * Wraps the tool definition to conform to standard ToolDefinition signature.
 */
export function registerSubToolLoaderExtension(api: ExtensionAPI): void {
  const rawTool = createSubLoaderToolDefinition();
  const tool: ToolDefinition = {
    ...rawTool,
    // Override execute with standard signature that forwards to rawTool.execute
    execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: any) => {
      // Forward to the raw implementation (expects params, ctx)
      return await rawTool.execute(params, ctx);
    },
  };
  api.registerTool(tool);
}
