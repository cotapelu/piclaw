/**
 * Helper functions for sub-tools system
 */

import * as subTools from "./index.js";
import { subToolNames, type SubToolMap, type SubToolName } from "./types.js";

// Core tools from @mariozechner/pi-coding-agent
const coreToolNames = new Set<string>(["bash", "ls", "find", "grep", "read", "edit", "write", "get_schema"]);

// Dangerous tools that can execute arbitrary commands or access sensitive resources
// Only includes tools we actually have in subToolNames
export const DANGEROUS_TOOLS = new Set<string>([
  // Shell & remote execution
  "bash",
  "ssh",
  // Version control (can access private repos, execute hooks)
  "git",
]);

/**
 * Cached tool definitions per working directory
 */
const toolCache = new Map<string, SubToolMap>();

/**
 * Get tool map for a given working directory
 * Builds the map of all available sub-tools
 */
export function getToolMap(cwd: string): SubToolMap {
  if (toolCache.has(cwd)) return toolCache.get(cwd)!;

  const tools: SubToolMap = {};

  for (const name of subToolNames) {
    if (coreToolNames.has(name)) continue; // Skip core tools (handled separately)

    const schemaKey = `${name}Schema`;
    const executeKey = `execute${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    const schema = (subTools as any)[schemaKey];
    const execute = (subTools as any)[executeKey];

    if (schema && execute) {
      tools[name] = {
        name,
        label: name,
        description: `${name} tool`,
        parameters: schema,
        execute,
        // Mark as dangerous if it's in the dangerous list
        dangerous: DANGEROUS_TOOLS.has(name),
        safeExecute: false,
      };
    }
  }

  toolCache.set(cwd, tools);
  return tools;
}

/**
 * Clear tool cache (useful for testing or when tools change)
 */
export function clearToolCache(): void {
  toolCache.clear();
}

/**
 * Get list of available sub-tool names (excluding core tools)
 */
export function getAvailableSubToolNames(): SubToolName[] {
  return subToolNames.filter(name => !coreToolNames.has(name)) as SubToolName[];
}

/**
 * Get schema for a specific sub-tool
 */
export function getSubToolSchema(name: SubToolName): any | undefined {
  const schemaKey = `${name}Schema`;
  return (subTools as any)[schemaKey];
}

/**
 * Get execute function for a specific sub-tool
 */
export function getSubToolExecutor(name: SubToolName): any | undefined {
  const executeKey = `execute${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return (subTools as any)[executeKey];
}
