#!/usr/bin/env node

/**
 * Test Tool
 *
 * Provides a tool to run the project's test suite (vitest).
 * Can be invoked by the LLM.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";

/** Escape a string for safe inclusion in a shell command (single-quote style). */
function escapeShellArg(arg: string): string {
  const escaped = arg.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

function createTestTool(cwd: string): any {
  const baseBashTool: any = createBashTool(cwd, {});

  return {
    name: "test",
    label: "Test Runner",
    description: "Run the project's test suite (vitest). Supports running specific test files.",
    promptSnippet: "test({ files?: string[], watch?: boolean })",
    promptGuidelines: [
      "Run project tests using vitest",
      "files: optional array of test file paths (e.g., ['src/tests/git-tool.test.ts'])",
      "watch: run in watch mode (default false) – usually keep false",
    ],
    parameters: {},

    async execute(
      toolCallId: string,
      params: { files?: string[]; watch?: boolean },
      signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: any
    ) {
      // Build command string
      let cmd = "npm test";
      if (params.files && params.files.length > 0) {
        const fileStr = params.files.map(escapeShellArg).join(' ');
        cmd += ` -- ${fileStr}`;
      }
      if (params.watch) {
        cmd += " -- --watch";
      }
      const bashInput = { command: cmd };
      return baseBashTool.execute(toolCallId, bashInput, signal, undefined, ctx);
    },
  };
}

export function registerTestTool(api: ExtensionAPI): void {
  const cwd = process.cwd();
  const testTool = createTestTool(cwd);
  api.registerTool(testTool);
}
