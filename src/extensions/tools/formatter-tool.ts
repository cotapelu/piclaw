#!/usr/bin/env node

/**
 * Formatter Tool
 *
 * Provides a tool to format code using Prettier.
 * Can be invoked by the LLM to format files.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";

function createFormatterTool(cwd: string): any {
  const baseBashTool: any = createBashTool(cwd, {});

  return {
    name: "formatter",
    label: "Code Formatter",
    description: "Format code files using Prettier. Specify files array to format.",
    promptSnippet: "formatter({ files: string[] })",
    promptGuidelines: [
      "Format code using Prettier",
      "files: required array of file paths to format (relative to project root)",
      "The tool will overwrite files in-place",
      "Supports JavaScript, TypeScript, JSON, Markdown, etc. (as configured in .prettierrc)",
    ],
    parameters: {},

    async execute(
      toolCallId: string,
      params: { files: string[] },
      signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: any
    ) {
      if (!params.files || params.files.length === 0) {
        return {
          content: [{ type: "text", text: "❌ No files provided. Usage: formatter({ files: ['src/file.ts'] })" }],
          isError: true,
        };
      }
      // Build command: npx prettier --write <files>
      const fileArgs = params.files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(" ");
      const command = `npx prettier --write ${fileArgs}`;
      const bashInput = { command };
      return baseBashTool.execute(toolCallId, bashInput, signal, undefined, ctx);
    },
  };
}

export function registerFormatterTool(api: ExtensionAPI): void {
  const cwd = process.cwd();
  const formatterTool = createFormatterTool(cwd);
  api.registerTool(formatterTool);
}
