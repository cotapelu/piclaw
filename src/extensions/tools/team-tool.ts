/**
 * Team Management Tool - Updated for full collaboration
 *
 * Allows LLM to spawn a collaborative team with messaging, dynamic task management,
 * and conflict resolution.
 */

import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { AgentTeam } from "../../team/team-manager.js";

export interface TeamResult {
  results: string[];
  size: number;
  teamStatus?: any;
  error?: string;
}

export function registerTeamTool(api: ExtensionAPI): void {
  const tool: ToolDefinition = {
    name: "spawn_team",
    label: "Team",
    description: "Spawn a collaborative team of AI agents that can communicate, share artifacts with conflict resolution, and dynamically manage tasks.",
    promptSnippet: 'spawn_team({ tasks: ["task1", "task2"], size: 3 })',
    promptGuidelines: [
      "Use spawn_team when you have multiple tasks that can benefit from parallel work AND collaboration.",
      "Agents in the team can communicate via team_ops send_message, share artifacts via workspace_* operations with locking, and dynamically steal work.",
      "Each agent has full team_ops tool to coordinate with others.",
      "The team consists of 1 parent (you) + N children. Children are automatically disposed after task completion; parent remains.",
      "children size (1-4).",
      "Example: spawn_team({ tasks: ['analyze code', 'write tests', 'document API'], size: 2 })",
      "After spawning, children will automatically start working based on their bootstrap instructions.",
      "You can monitor progress via team_ops calls from your own session (if needed).",
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
      const parentRuntime = (ctx as any)?.runtime?.sessionRuntime || (ctx as any)?.session?.runtime;
      if (!parentRuntime) {
        return {
          content: [{ type: "text", text: "Error: No parent runtime available" }],
          details: { error: "No parent runtime", size } as TeamResult,
          isError: true,
        };
      }

      let team: AgentTeam | null = null;
      try {
        team = await bootPiclawTeam(parentRuntime, {
          teamSize: size,
          teamRoles: params.roles,
        });

        const results = await executeTeamTasks(team, params.tasks);
        const finalStatus = team.getTeamStatus();

        return {
          content: [{
            type: "text",
            text: `✅ Team complete (${team.size} agents)\n\nResults:\n${results.map((r: string, i: number) => `Agent ${i + 1}: ${r.substring(0, 100)}${r.length > 100 ? '...' : ''}`).join("\n\n")}`
          }],
          details: { 
            results, 
            size: team.size,
            teamStatus: finalStatus 
          } as TeamResult,
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
  };

  api.registerTool(tool);
}
