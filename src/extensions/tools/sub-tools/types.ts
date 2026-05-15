/**
 * Type definitions for sub-tools system
 */

// List of all available sub-tool names (only essential ones kept)
export const subToolNames = [
  // Core Computer Use tools (from @mariozechner/pi-coding-agent)
  "get_schema",
  "bash", "ls", "find", "grep", "read",
  "edit", "write",

  // Extended sub-tools (essential only)
  "git", "ssh", "http", "jq", "yq", "tail",
] as const;

export type SubToolName = typeof subToolNames[number];

/**
 * Sub-tool definition interface
 */
export interface SubToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: any;
  execute: any;
  renderCall?: any;
  renderResult?: any;
  renderShell?: "self" | "child";
  /** If true, this tool can execute arbitrary commands and should be treated with caution */
  dangerous?: boolean;
  /** If true, this tool should use safe execution (direct spawn, not bash -c) */
  safeExecute?: boolean;
}

/**
 * Sub-tool map type
 */
export type SubToolMap = Record<string, SubToolDefinition>;

/**
 * Get schema function arguments
 */
export interface GetSchemaArgs {
  name: string;
}

/**
 * Subtool loader arguments
 */
export interface SubToolLoaderArgs {
  subtool: string;
  args: any;
}
