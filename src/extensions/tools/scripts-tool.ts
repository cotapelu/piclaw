#!/usr/bin/env node

/**
 * NPM Scripts Tool
 *
 * Lists and runs npm scripts from package.json.
 * Provides both a tool (scripts) and a slash command (/scripts).
 */

import type { ExtensionAPI, ToolDefinition, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createBashToolDefinition } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Escape a string for safe inclusion in a shell command (single-quote style). */
export function escapeShellArg(arg: string): string {
  const escaped = arg.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

/** Validate npm script name to prevent injection. */
export function isValidScriptName(name: string): boolean {
  // NPM script names typically allow alphanumerics, spaces, hyphens, underscores, and colons (for namespacing like "test:unit").
  // For security, we restrict to a safe subset.
  return /^[a-zA-Z0-9 _:-]+$/.test(name);
}

async function getScripts(cwd: string): Promise<Record<string, string>> {
  try {
    const pkgJson = await readFile(join(cwd, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgJson);
    return pkg.scripts || {};
  } catch (error) {
    return {};
  }
}

const tool: ToolDefinition = {
  name: "scripts",
  label: "NPM Scripts",
  description: "List and run npm scripts defined in package.json.",
  promptSnippet: "scripts({ action: 'list' }) or scripts({ action: 'run', script: 'test' })",
  promptGuidelines: [
    "Use the scripts tool to discover and run npm scripts.",
    "Actions:",
    "- 'list': Lists all available npm script names (no parameters).",
    "- 'run': Runs a specific script (requires 'script' parameter).",
    "Example: scripts({ action: 'run', script: 'build' })",
  ],
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "run"],
        description: "Action to perform",
      },
      script: {
        type: "string",
        description: "Name of the script to run (required when action is 'run')",
      },
    },
    required: ["action"],
  },

  async execute(
    toolCallId: string,
    params: any,
    signal: AbortSignal | undefined,
    onUpdate: any,
    ctx: ExtensionContext
  ) {
    const cwd = ctx.cwd || process.cwd();
    const action = params.action;

    if (action === "list") {
      const scripts = await getScripts(cwd);
      const names = Object.keys(scripts);
      const text = names.length > 0 ? names.join("\n") : "No npm scripts defined in package.json.";
      return {
        content: [{ type: "text", text }],
        details: { action: "list", count: names.length, scripts: names },
        isError: false,
      };
    }

    if (action === "run") {
      const script = params.script;
      if (!script || typeof script !== "string") {
        return {
          content: [{ type: "text", text: "Error: 'script' parameter (string) is required for run action." }],
          details: { action: "run", error: "script required" },
          isError: true,
        };
      }

      // Validate script name for security (alphanumeric, spaces, hyphens, underscores)
      if (!isValidScriptName(script)) {
        return {
          content: [{ type: "text", text: `Error: invalid script name '${script}'. Only alphanumerics, spaces, hyphens, underscores allowed.` }],
          details: { action: "run", script, error: "invalid script name" },
          isError: true,
        };
      }

      const scripts = await getScripts(cwd);
      if (!scripts[script]) {
        return {
          content: [{ type: "text", text: `Error: script '${script}' not found. Use scripts({ action: 'list' }) to see available scripts.` }],
          details: { action: "run", script, error: "script not found" },
          isError: true,
        };
      }

      const bashTool = createBashToolDefinition(cwd, { commandPrefix: "" });
      const command = `npm run ${escapeShellArg(script)}`;
      const result = await bashTool.execute(toolCallId, { command }, signal, onUpdate, ctx);
      // Merge action into details
      return {
        ...result,
        details: { ...result.details, action: "run", script },
      };
    }

    return {
      content: [{ type: "text", text: `Unknown action: ${action}. Valid actions: list, run.` }],
      details: { action },
      isError: true,
    };
  },
};

export function registerScriptsTool(api: ExtensionAPI): void {
  api.registerTool(tool);

  // Register slash command for interactive usage
  api.registerCommand("scripts", {
    description: "List and run npm scripts from package.json",
    handler: async (_args: string, ctx: ExtensionContext) => {
      // For simplicity, just list scripts; user can then call tool with run.
      const scripts = await getScripts(ctx.cwd);
      const names = Object.keys(scripts);
      if (names.length === 0) {
        ctx.ui.notify("No npm scripts defined.", "info");
        return;
      }
      ctx.ui.notify(`Available scripts (${names.length}):\n${names.join(", ")}`, "info");
      ctx.ui.notify("Run with: scripts({ action: 'run', script: '<name>' })", "info");
    },
  });
}

export default registerScriptsTool;
