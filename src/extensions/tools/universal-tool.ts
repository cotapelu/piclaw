#!/usr/bin/env node

/**
 * Universal Tool
 *
 * A single tool with registry-based actions for extensibility.
 * Actions are loaded from the actions/ directory.
 *
 * Currently supports: echo, system_info, date, uuid, random, calc
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { actions } from "./actions/index.js";

// ==================== TOOL DEFINITION ====================

export function registerUniversalTool(api: ExtensionAPI): void {
  const tool: any = {
    name: "universal",
    label: "Universal Tool",
    description:
      "Multi-purpose tool with registry-based actions. Supports: echo, system_info, date, uuid, random, calc. Easily extensible.",
    promptSnippet:
      "Use `universal` tool with `action` parameter to perform various tasks.",
    promptGuidelines: [
      "Use the universal tool with an `action` parameter.",
      "Available actions:",
      "- 'echo': Echo a message back (requires `message`).",
      "- 'system_info': Get system diagnostics (no parameters).",
      "- 'date': Get current date/time in ISO and locale formats (no parameters).",
      "- 'uuid': Generate a random UUID v4 (no parameters).",
      "- 'random': Generate a random integer (optional: `min`, `max`, default 0-100).",
      "- 'calc': Evaluate a math expression (requires `expression`, e.g., '2 + 3 * 4')."
    ],
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: Object.keys(actions),
          description: "Which action to perform",
        },
        // Note: Additional parameters depend on the chosen action
        // They are defined by each action's getParameters()
      },
      required: ["action"],
    },
    execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: any) => {
      const { action } = params;

      if (!action) {
        throw new Error("Missing required parameter: action");
      }

      const actionHandler = actions[action];
      if (!actionHandler) {
        throw new Error(`Unknown action: ${action}. Available actions: ${Object.keys(actions).join(", ")}`);
      }

      // Execute the action
      const result = await actionHandler.execute(params);
      return result;
    },
  };

  api.registerTool(tool);
}
