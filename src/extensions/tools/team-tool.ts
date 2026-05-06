/**
 * Team Management Tool
 * Allows LLM to spawn multiple agents to work in parallel on complex tasks
 */
import type { ExtensionAPI, ToolDefinition, ExtensionContext } from "@mariozechner/pi-coding-agent";

export interface TeamResult {
  results?: string[];
  size: number;
  mode: string;
  error?: string;
}

export function registerTeamTool(api: ExtensionAPI): void {
  const tool: any = {
    name: "spawn_team",
    label: "Team",
    description: "Spawn multiple AI agents to work in parallel. Use when you have multiple independent tasks to complete faster.",
    promptSnippet: 'spawn_team({ tasks: ["task1", "task2"], size: 3 })',
    promptGuidelines: [
      "Use spawn_team when you have 2-10 independent tasks to complete.",
      "Parent agent coordinates, children execute tasks.",
      "Each agent runs independently with isolated context.",
      "Team includes parent + children, children disposed after execution.",
      "Example: tasks=['analyze code', 'write tests', 'document API'] size=2",
    ],
    parameters: {
      type: "object",
      properties: {
        size: { type: "number", description: "Number of child agents (1-4, default 2)" },
        tasks: { type: "array", items: { type: "string" }, description: "Tasks for agents" },
        roles: { type: "array", items: { type: "string" }, description: "Optional roles for children (parent always first)" },
        mode: { type: "string", enum: ["parallel", "sequential"], description: "Execution mode" },
      },
      required: ["tasks"],
    },
    async execute(toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) {
      const { bootPiclawTeam, executeTeamTasks } = await import("../../team/team-manager.js");

      const size = Math.min(Math.max(1, params.size ?? 2), 4);
      const mode = params.mode ?? "parallel";

      // Get parent runtime from context
      const parentRuntime = ctx?.runtime || (ctx?.session?.runtime as any);
      if (!parentRuntime) {
        return {
          content: [{ type: "text", text: "Error: No parent runtime available" }],
          details: { error: "No parent runtime", size, mode } as TeamResult,
          isError: true,
        };
      }

      try {
        // Team = parent + children
        const team = await bootPiclawTeam(parentRuntime, {
          teamSize: size,
          teamRoles: params.roles,
        });

        const results = await executeTeamTasks(team, params.tasks, mode);
        await team.dispose(); // Only disposes children

        return {
          content: [{ type: "text", text: `Team complete.\n\n${results.map((r, i) => `Agent ${i + 1}: ${r.substring(0, 200)}...`).join("\n\n")}` }],
          details: { results, size: team.size, mode } as TeamResult,
          isError: false,
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Team error: ${error.message}` }],
          details: { error: error.message, size, mode, results: [] } as TeamResult,
          isError: true,
        };
      }
    },
    renderCall: (args: any) => {
      const { tasks, size } = args as { tasks: string[]; size?: number };
      return `spawn_team(${size ?? 2} children + parent, ${tasks?.length ?? 0} tasks)`;
    },
    renderResult: (result: any, options: any) => {
      const details: TeamResult = result?.details;
      if (!details) return "";
      return `Team: ${details.size} agents • ${details.mode} • ${details.results?.length ?? 0} results`;
    },
  };

  api.registerTool(tool);
}