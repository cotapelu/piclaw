/**
 * SubTool Loader - Main entry point
 *
 * Unified tool for system operations combining:
 * - Core Computer Use tools from @mariozechner/pi-coding-agent
 * - Extended sub-tools from src/extensions/tools/sub-tools/
 */

import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { Text } from "@mariozechner/pi-tui";
import { getAgentDir } from "../../config/config.js";  // path: extensions/tools/subtool-loader.ts -> ../../config
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
import { renderSubtoolLoaderCall, renderSubtoolLoaderResult } from "./sub-tools/render.js";

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
// Extension Registration
// ============================================================================

/**
 * Register subtool_loader as an extension.
 * This allows it to be loaded via the extension system.
 */
export function registerSubToolLoaderExtension(api: ExtensionAPI) {
  const tool = createSubLoaderToolDefinition(); // cwd will be resolved from context
  api.registerTool(tool);
}

// ============================================================================
// Combined tool map (core + custom sub-tools)
// ============================================================================

// ============================================================================
// Audit Trail - Logging for all sub-tool executions
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

  // Also append to file for persistence (async)
  try {
    const logLine = `${JSON.stringify(fullEntry)  }\n`;
    // Use async append but fire-and-forget
    fs.promises.appendFile(getAuditLogPath(), logLine).catch(() => {});
  } catch {
    // Silently fail if can't write - don't block execution
  }
}

/**
 * Get all audit entries (for debugging/testing)
 */
export function getAuditLog(): readonly AuditEntry[] {
  return auditLog;
}

/**
 * Clear audit log (for testing)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}

// ============================================================================
// Dangerous Tools Configuration
// ============================================================================

/**
 * Default list of dangerous sub-tools that can be disabled
 * These tools can execute arbitrary commands or access sensitive resources
 */
/**
 * Configuration for sub-tool loader
 */
export interface SubToolLoaderConfig {
  /** Set of tool names to disable */
  disabledTools?: Set<string>;
  /** Whether to allow dangerous tools by default (default: true) */
  allowDangerousTools?: boolean;
}

let config: SubToolLoaderConfig = {
  allowDangerousTools: true,
};

/**
 * Configure the sub-tool loader
 */
export function configureSubToolLoader(newConfig: Partial<SubToolLoaderConfig>): void {
  config = { ...config, ...newConfig };
  // Clear tool cache when config changes
  toolCache.clear();
}

/**
 * Get current configuration
 */
export function getSubToolLoaderConfig(): Readonly<SubToolLoaderConfig> {
  return config;
}

/**
 * Check if a tool is allowed to execute
 */
function isToolAllowed(toolName: string, toolDef?: any): boolean {
  if (config.disabledTools?.has(toolName)) {
    return false;
  }
  // Check if it's a dangerous tool and we're configured to disallow them
  const isDangerous = toolDef?.dangerous || DANGEROUS_TOOLS.has(toolName as any);
  if (!config.allowDangerousTools && isDangerous) {
    return false;
  }
  return true;
}

// ============================================================================
// Tool Cache
// ============================================================================

const toolCache = new Map<string, any>();

function getAllTools(cwd: string): Record<string, any> {
  if (toolCache.has(cwd)) return toolCache.get(cwd)!;

  const tools = {
    ...getCoreToolMap(cwd),
    ...getToolMap(cwd),  // Add custom sub-tools from sub-tools/index
  };

  toolCache.set(cwd, tools);
  return tools;
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
// Tool definition factory
// ============================================================================

/**
 * Creates the subtool_loader tool definition.
 *
 * OPTIMIZATION: Use Union of Literal strings instead of Union of Objects.
 * This reduces the JSON Schema from ~4000+ lines to ~15 lines.
 */
export function createSubLoaderToolDefinition(cwd?: string) {
  // Schema: { subtool: string, args: any }
  // Using Type.String() instead of Type.Union(Type.Literal(...))
  // to avoid generating huge JSON Schema (~4000 lines)
  // LLM can still find valid tool names in the description below.
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
      '• bash: Execute shell commands - { subtool: "bash", args: { command: "..." } }',
      '• ls: List files - { subtool: "ls", args: { path: "." } }',
      '• find: Find files - { subtool: "find", args: { pattern: "*.ts" } }',
      '• grep: Search text - { subtool: "grep", args: { pattern: "TODO", path: "." } }',
      '• read: Read file - { subtool: "read", args: { path: "./file.ts" } }',
      '• edit: Edit file - { subtool: "edit", args: { path: "./file.ts", oldText: "...", newText: "..." } }',
      '• write: Write file - { subtool: "write", args: { path: "./file.ts", content: "..." } }',
      '',
      'Extended sub-tools include: git, docker, k8s, ssh, http, aws, terraform, db, kafka, redis,',
      'make, npm, systemctl, journalctl, ps, kill, crontab, apt, yum, df, du, ping, traceroute,',
      'nslookup, dig, wget, tail, jq, yq, xmllint, scp, rsync, ffmpeg, update, backup, password,',
      'weather, time, ufw, at, quota, iso, free, iostat, netstat, ss, pandoc, wkhtmltopdf,',
      'pdftk, ps2pdf, enscript, graphviz, xmlstarlet, json_pp, yamllint, tomlq, hjson,',
      'archive, zip, 7z, xz, svn, hg, darcs, fossil, bzr, cvs, pacman, dnf, zypper,',
      'emerge, apk, pkg, nix-env, guix, spack, pkgsrc.',
      '',
      'Use subtool_loader({ subtool: "get_schema", args: { name: "bash" } }) to see',
      'detailed parameters for any sub-tool.',
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
        const toolMap = getAllTools(effectiveCwd);
        const toolDef = toolMap[subtool];

        if (!toolDef) {
          return {
            content: [{ type: "text", text: `Unknown subtool: ${subtool}. Available: ${subToolNames.join(", ")}` }],
            details: undefined,
            isError: true,
          } as const;
        }

        // Check if tool is allowed (considering dangerous flag)
        if (!isToolAllowed(subtool, toolDef)) {
          const reason = toolDef.dangerous
            ? `Tool '${subtool}' is dangerous and disabled. Set allowDangerousTools=true in SubToolLoader config to enable.`
            : `Tool '${subtool}' is disabled.`;
          return {
            content: [{ type: "text", text: reason }],
            details: undefined,
            isError: true,
          } as const;
        }

        // Execute and log result
        const startTime = Date.now();
        const delegatedToolCallId = `subtool-${subtool}-${Date.now()}`;
        const result = await toolDef.execute(delegatedToolCallId, parsedArgs, signal, undefined, ctx);
        const duration = Date.now() - startTime;
        const success = !result.isError;
        addAuditEntry({ tool: subtool, args: parsedArgs, success, duration });
        return result;
      } catch (error: any) {
        // Log failure
        addAuditEntry({ tool: subtool, args: parsedArgs, success: false, error: error.message });
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          details: undefined,
          isError: true,
        } as const;
      }
    },
    renderCall: renderSubtoolLoaderCall,
    renderResult: renderSubtoolLoaderResult,
  };
}
