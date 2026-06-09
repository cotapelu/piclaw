#!/usr/bin/env node

/**
 * Build Tool
 *
 * Runs the project build (npm run build).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";

function createBuildTool(cwd: string): any {
  const baseBashTool: any = createBashTool(cwd, {});

  return {
    name: "build",
    label: "Build System",
    description: "Run the project build (npm run build).",
    promptSnippet: "build()",
    promptGuidelines: [
      "Compile the project using npm run build",
      "Returns build output and any errors",
      "Useful after making changes to ensure everything compiles",
    ],
    parameters: {},

    async execute(
      toolCallId: string,
      _params: any,
      signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: any
    ) {
      const command = "npm run build";
      const bashInput = { command };
      return baseBashTool.execute(toolCallId, bashInput, signal, undefined, ctx);
    },
  };
}

export function registerBuildTool(api: ExtensionAPI): void {
  const cwd = process.cwd();
  const buildTool = createBuildTool(cwd);
  api.registerTool(buildTool);
}
