#!/usr/bin/env node

/**
 * Audit Tool
 *
 * Runs npm audit to check for security vulnerabilities.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";

function createAuditTool(cwd: string): any {
  const baseBashTool: any = createBashTool(cwd, {});

  return {
    name: "audit",
    label: "Dependency Audit",
    description: "Check for security vulnerabilities in dependencies using npm audit.",
    promptSnippet: "audit()",
    promptGuidelines: [
      "Run `npm audit` to find known vulnerabilities",
      "Returns JSON with audit results",
      "Consider suggesting `npm audit fix` if issues found",
    ],
    parameters: {},

    async execute(
      toolCallId: string,
      _params: any,
      signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: any
    ) {
      const command = "npm audit --json";
      const bashInput = { command };
      return baseBashTool.execute(toolCallId, bashInput, signal, undefined, ctx);
    },
  };
}

export function registerAuditTool(api: ExtensionAPI): void {
  const cwd = process.cwd();
  const auditTool = createAuditTool(cwd);
  api.registerTool(auditTool);
}
