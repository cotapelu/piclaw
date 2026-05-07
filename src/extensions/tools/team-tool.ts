/**
 * Team Management Tool
 * Allows LLM to spawn multiple agents to work in parallel on complex tasks
 */
import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";

export interface TeamResult {
  results: string[];
  size: number;
  error?: string;
}

export function registerTeamTool(api: ExtensionAPI): void {
  const tool: ToolDefinition = {
    name: "spawn_team",
    label: "Team",
    description: "Spawn multiple AI agents to work in parallel. Use when you have multiple independent tasks to complete faster.",
    promptSnippet: 'spawn_team({ tasks: ["task1", "task2"], size: 3 })',
    promptGuidelines: [
      "Use spawn_team when you have multiple independent tasks to complete (1-10 recommended, max depend on system resources).",
      "Parent agent coordinates; children execute tasks in parallel.",
      "Each child agent runs independently with isolated context.",
      "The team consists of 1 parent + N children (specified by 'size'). Children are automatically disposed after task completion; parent remains.",
      "Optionally provide 'roles' array to name agents (e.g., ['analyst', 'tester']).",
      "Parameters: tasks (array of strings, required), size (number, default 2, max 4), roles (array of strings, optional).",
      "Example: spawn_team({ tasks: ['analyze code', 'write tests', 'document API'], size: 2 })",
      "Children self-organize: call team_ops with action='claim_task' to get work, 'report_result' to submit output.",
    ],
    parameters: {
      type: "object",
      properties: {
        size: {
          type: "number",
          minimum: 1,
          maximum: 4,
          default: 2,
          description: "Number of child agents (1-4)"
        },
        tasks: {
          type: "array",
          minItems: 1,
          items: { type: "string" },
          description: "Tasks for agents (independent tasks)"
        },
        roles: {
          type: "array",
          items: { type: "string" },
          description: "Optional roles for children"
        },
      },
      required: ["tasks"],
    },
    async execute(toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) {
      const { bootPiclawTeam, executeTeamTasks } = await import("../../team/team-manager.js");

      const size = Math.min(Math.max(1, params.size ?? 2), 4);

      // Get parent runtime from context
      const parentRuntime = (ctx as any)?.runtime || ctx?.session?.runtime;
      if (!parentRuntime) {
        return {
          content: [{ type: "text", text: "Error: No parent runtime available" }],
          details: { error: "No parent runtime", size } as TeamResult,
          isError: true,
        };
      }

      let team: any = null;
      try {
        // Team = parent + children
        team = await bootPiclawTeam(parentRuntime, {
          teamSize: size,
          teamRoles: params.roles,
        });

        // Execute tasks in parallel across child agents
        const results = await executeTeamTasks(team, params.tasks);

        return {
          content: [{
            type: "text",
            text: `✅ Team complete (${team.size} agents)\n\nResults:\n${results.map((r: string, i: number) => `Agent ${i + 1}: ${r}`).join("\n\n")}`
          }],
          details: { results, size: team.size } as TeamResult,
          isError: false,
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `❌ Team error: ${error.message}` }],
          details: { error: error.message, size, results: [] } as TeamResult,
          isError: true,
        };
      } finally {
        if (team) {
          try {
            await team.dispose();
          } catch (e) {
            console.error("Failed to dispose team:", e);
          }
        }
      }
    },
    // Optional rendering functions
    // renderCall: (args) => string,
    // renderResult: (result) => string,
  };

  api.registerTool(tool);
}
