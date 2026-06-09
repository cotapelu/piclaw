#!/usr/bin/env node

/**
 * Metrics Tool
 *
 * Exports system usage and performance metrics as JSON.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";

function createMetricsTool(cwd: string): any {
  const baseBashTool: any = createBashTool(cwd, {});

  return {
    name: "metrics",
    label: "Metrics Export",
    description: "Export usage and performance metrics as JSON.",
    promptSnippet: "metrics()",
    promptGuidelines: [
      "Returns a JSON object with system metrics",
      "Includes: timestamp, uptime, memory usage, session entry count",
    ],
    parameters: {},

    async execute(
      toolCallId: string,
      _params: any,
      signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: any
    ) {
      // Gather metrics
      const sessionManager = ctx.sessionManager;
      let sessionEntries = 0;
      if (sessionManager) {
        try {
          const tree = (sessionManager as any).getTree?.() ?? [];
          sessionEntries = tree.length;
        } catch {
          // ignore
        }
      }

      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessionEntries,
      };

      // Since this is not a real bash command, we can construct a bash tool result manually using the base tool? Alternatively, we can just return a result object directly.
      // But our tool is based on createBashTool which expects to run a bash command. We didn't actually run bash. We can cheat: run a dummy command like `echo` with the JSON as output.
      // Simpler: use baseBashTool to run `echo` with JSON.
      const jsonStr = JSON.stringify(metrics, null, 2);
      // Escape for shell? We can use echo with heredoc to avoid quoting issues.
      // Use `printf` to output safely.
      const command = `printf %s ${JSON.stringify(jsonStr)}`; // but this will be interpreted by shell; maybe simpler: cat <<'EOF'
      // Instead, we'll just use baseBashTool to run a simple command that prints our JSON string without invoking shell quoting issues: we can use `echo` and provide JSON as argument? Might need careful.
      // To avoid complexity, we'll invoke the base tool with a simple command and then replace output? That's messy.
      // Actually we can skip using baseBashTool and just return the result object directly; the tool definition execute function can return any tool result shape.
      // The AgentTool interface expects a ToolResult with content array, etc. That's fine. We don't need baseBashTool.
      // Let's restructure: not using baseBashTool; just return a result.
      // We'll modify: Instead of creating via createBashTool, we directly define tool object with execute that returns a ToolResult.

      // Since we already created baseBashTool but not used, we could just return our own result.
      return {
        content: [{ type: "text", text: jsonStr }],
        isError: false,
      };
    },
  };
}

export function registerMetricsTool(api: ExtensionAPI): void {
  const cwd = process.cwd();
  const metricsTool = createMetricsTool(cwd);
  api.registerTool(metricsTool);
}
