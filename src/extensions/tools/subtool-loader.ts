#!/usr/bin/env node

/**
 * SubTool Loader
 * Dispatches to typed sub-tools (computer-use + http).
 *
 * Philosophy: Minimal tools over bash.
 * - computer-use: ls, find, grep, read
 * - http: Web requests
 */

import { ToolDefinition } from "@earendil-works/pi-coding-agent";
import * as subTools from "./sub-tools/index.js";

/**
 * Create the subtool_loader tool definition
 */
export function createSubLoaderToolDefinition(): ToolDefinition {
  // Mapping of subtool name to its schema and execute function
  const subToolMap: Record<string, { schema: any; execute: Function }> = {
    http: { schema: subTools.httpSchema, execute: subTools.executeHttp },
    ls: { schema: subTools.lsSchema, execute: subTools.executeLs },
    find: { schema: subTools.findSchema, execute: subTools.executeFind },
    grep: { schema: subTools.grepSchema, execute: subTools.executeGrep },
    read: { schema: subTools.readSchema, execute: subTools.executeRead },
  };

  return {
    name: "subtool_loader",
    label: "SubTool Loader",
    description: "Access to convenience sub-tools (http, file operations). All other operations use 'bash' tool.",
    parameters: {
      type: "object",
      properties: {
        subtool: {
          type: "string",
          enum: Object.keys(subToolMap),
          description: "Which sub-tool to invoke",
        },
        args: {
          type: "object",
          description: "Arguments specific to the sub-tool",
        },
      },
      required: ["subtool", "args"],
    },
    async execute(params: any, ctx: any) {
      const { subtool, args } = params;
      const tool = subToolMap[subtool];

      if (!tool) {
        return {
          content: [{ type: "text", text: `Unknown sub-tool: ${subtool}` }],
          details: null,
          isError: true,
        } as const;
      }

      try {
        // Resolve cwd from session
        const cwd = ctx.session?.cwd ?? process.cwd();
        // Call sub-tool: execute(args, cwd, signal?, ctx?)
        const result = await tool.execute(args, cwd, undefined, ctx);
        return result;
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `${subtool} error: ${error.message}` }],
          details: null,
          isError: true,
        } as const;
      }
    },
  };
}

/**
 * Register the subtool_loader tool with the extension API
 */
export function registerSubToolLoaderExtension(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createSubLoaderToolDefinition());
}
