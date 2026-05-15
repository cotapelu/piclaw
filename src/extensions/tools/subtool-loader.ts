/**
 * SubTool Loader - Unified tool for system operations
 *
 * Exposes a single tool that can execute multiple system commands.
 * Combines core tools (bash, ls, find, grep, read, edit, write) from pi-coding-agent
 * with extended sub-tools (git, ssh, http, jq, yq, tail).
 */

import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir } from "../../config/config-manager.js";
import {
  createBashToolDefinition,
  createLsToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createReadToolDefinition,
  createEditToolDefinition,
  createWriteToolDefinition,
} from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { subToolNames, type SubToolName } from "./sub-tools/types.js";
import { getToolMap, DANGEROUS_TOOLS } from "./sub-tools/helpers.js";

// ============================================================================
// Core tools from @mariozechner/pi-coding-agent
// ============================================================================

function getCoreToolMap(cwd: string) {
  return {
    bash: createBashToolDefinition(cwd),
    ls: createLsToolDefinition(cwd),
    find: createFindToolDefinition(cwd),
    grep: createGrepToolDefinition(cwd),
    read: createReadToolDefinition(cwd),
    edit: createEditToolDefinition(cwd),
    write: createWriteToolDefinition(cwd),
  };
}

// ============================================================================
// Tool cache
// ============================================================================

const toolCache = new Map<string, Record<string, any>>();

function getAllTools(cwd: string): Record<string, any> {
  if (toolCache.has(cwd)) return toolCache.get(cwd)!;

  const tools = {
    ...getCoreToolMap(cwd),
    ...getToolMap(cwd), // custom sub-tools from sub-tools/index
  };

  toolCache.set(cwd, tools);
  return tools;
}

// ============================================================================
// Audit Trail
// ============================================================================

interface AuditEntry {
  timestamp: string;
  tool: string;
  args: any;
  success: boolean;
  error?: string;
  duration?: number;
}

const auditLog: AuditEntry[] = [];
let auditLogPath: string;

function getAuditLogPath(): string {
  if (!auditLogPath) {
    const agentDir = getAgentDir();
    auditLogPath = path.join(agentDir, "audit.log");
  }
  return auditLogPath;
}

function addAuditEntry(entry: Omit<AuditEntry, "timestamp">): void {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  auditLog.push(fullEntry);

  try {
    const logLine = `${JSON.stringify(fullEntry)}\n`;
    fs.promises.appendFile(getAuditLogPath(), logLine).catch(() => {});
  } catch {
    // Silently fail
  }
}

export function getAuditLog(): readonly AuditEntry[] {
  return auditLog;
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}

// ============================================================================
// Configuration
// ============================================================================

export interface SubToolLoaderConfig {
  disabledTools?: Set<string>;
  allowDangerousTools?: boolean;
}

let config: SubToolLoaderConfig = {
  allowDangerousTools: true,
};

export function configureSubToolLoader(newConfig: Partial<SubToolLoaderConfig>): void {
  config = { ...config, ...newConfig };
  toolCache.clear();
}

export function getSubToolLoaderConfig(): Readonly<SubToolLoaderConfig> {
  return config;
}

function isToolAllowed(toolName: string, toolDef?: any): boolean {
  if (config.disabledTools?.has(toolName)) return false;
  const isDangerous = toolDef?.dangerous || DANGEROUS_TOOLS.has(toolName as any);
  if (!config.allowDangerousTools && isDangerous) return false;
  return true;
}

// ============================================================================
// Execute: get_schema
// ============================================================================

async function executeGetSchema(args: any, _signal?: AbortSignal, ctx?: any) {
  const { name } = args as { name: string };
  const effectiveCwd = ctx?.cwd || process.cwd();

  if (!name) {
    return {
      content: [{ type: "text", text: `Missing 'name' parameter. Specify a sub-tool name.` }],
      details: undefined,
      isError: true,
    } as const;
  }

  const toolMap = getAllTools(effectiveCwd);
  const toolDef = toolMap[name];
  if (!toolDef) {
    return {
      content: [{ type: "text", text: `Unknown sub-tool: ${name}. Available: ${subToolNames.join(", ")}` }],
      details: undefined,
      isError: true,
    } as const;
  }

  const schema = toolDef.parameters as any;
  let output = `Schema for sub-tool "${name}":\n\n`;

  if (schema?.properties) {
    output += "Properties:\n";
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as any;
      const isOptional = schema.optionalProperties?.includes(key);
      const type = prop.type || "any";
      output += `- ${key}${isOptional ? "?" : ""}: ${prop.description || type}\n`;
    }
  }
  if (schema?.required && Array.isArray(schema.required) && schema.required.length > 0) {
    output += `\nRequired fields: ${schema.required.join(", ")}\n`;
  }
  output += "\nExample invocation:\n";
  output += `{\n  "subtool": "${name}",\n  "args": {\n    // fill with fields from above\n  }\n}\n`;

  return {
    content: [{ type: "text", text: output }],
    details: undefined,
    isError: false,
  } as const;
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Creates the subtool_loader tool definition.
 * Unified interface for system operations.
 */
export function createSubLoaderToolDefinition(cwd?: string) {
  const schema = Type.Object({
    subtool: Type.String(),
    args: Type.Any(),
  });

  const description = `Unified tool for system operations via "subtool" parameter. Use get_schema for details. WARNING: executes arbitrary commands.`;

  return {
    name: "subtool_loader",
    label: "SubTool Loader",
    description,
    promptSnippet: 'subtool_loader({ subtool: "bash", args: { command: "echo hello" } })',
    promptGuidelines: [
      'subtool_loader is a unified tool for system operations.',
      'Use the "subtool" parameter to select the operation, and "args" for that operation.',
      '',
      'Common subtools:',
      '• bash: Execute shell commands',
      '• ls: List files',
      '• find: Find files',
      '• grep: Search text',
      '• read: Read file',
      '• git: Git operations',
      '• ssh: Remote execution',
      '• http: Web requests',
      '• jq: JSON processing',
      '• yq: YAML processing',
      '• tail: Log monitoring',
      '',
      'Use subtool_loader({ subtool: "get_schema", args: { name: "bash" } }) for detailed parameters.',
      '',
      '⚠️ WARNING: Sub-tools execute arbitrary shell commands. Only use in trusted environments.'
    ],
    parameters: schema,
    async execute(toolCallId: string, params: any, signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
      const { subtool, args } = params as { subtool: string; args: any };

      let parsedArgs: any = args;
      if (typeof args === 'string') {
        try {
          parsedArgs = JSON.parse(args);
        } catch (e) {
          return {
            content: [{ type: "text", text: `Invalid JSON in args: ${args}` }],
            details: undefined,
            isError: true,
          } as const;
        }
      }

      try {
        if (subtool === "get_schema") {
          return await executeGetSchema(parsedArgs, signal, ctx);
        }

        const effectiveCwd = ctx?.cwd || cwd || process.cwd();
        const toolDef = getAllTools(effectiveCwd)[subtool];

        if (!toolDef) {
          return {
            content: [{ type: "text", text: `Unknown subtool: ${subtool}. Available: ${subToolNames.join(", ")}` }],
            details: undefined,
            isError: true,
          } as const;
        }

        if (!isToolAllowed(subtool, toolDef)) {
          const reason = toolDef.dangerous
            ? `Tool '${subtool}' is dangerous and disabled. Set allowDangerousTools=true to enable.`
            : `Tool '${subtool}' is disabled.`;
          return {
            content: [{ type: "text", text: reason }],
            details: undefined,
            isError: true,
          } as const;
        }

        const startTime = Date.now();
        const result = await toolDef.execute(toolCallId, parsedArgs, signal, undefined, ctx);
        const duration = Date.now() - startTime;
        const success = !result.isError;
        addAuditEntry({ tool: subtool, args: parsedArgs, success, duration });
        return result;
      } catch (error: any) {
        addAuditEntry({ tool: subtool, args: parsedArgs, success: false, error: error.message });
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          details: undefined,
          isError: true,
        } as const;
      }
    },
  };
}

/**
 * Register subtool_loader as an extension.
 */
export function registerSubToolLoaderExtension(api: ExtensionAPI) {
  const tool = createSubLoaderToolDefinition();
  api.registerTool(tool);
}
