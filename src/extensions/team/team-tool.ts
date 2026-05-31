#!/usr/bin/env node
/**
 * Simple Team Tool
 *
 * Single tool: team_run
 * Just provide tasks, team size, roles -> team auto-completes
 */

import { bootPiclawTeam, executeTeamTasks, TeamRegistry } from "./team-manager.js";
import type { ToolDefinition, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getGlobalRuntime } from "../../runtime-runner.js";

export function registerTeamTool(api: ExtensionAPI): void {
  api.registerTool(createTeamTool());
}

export function createTeamTool(): ToolDefinition {
  return {
    name: "team_run",
    label: "Team Run",
    description: "Create a team and automatically execute tasks. The team will self-organize and complete all tasks without further intervention.",
    promptSnippet: "Delegates tasks to a self-organizing multi-agent team",
    promptGuidelines: [
      "Use team_run to create and manage agent teams.",
      "To create a new team: provide tasks array, and optionally teamSize and teamRoles. Teams always run non-blocking in background.",
      // Removed: wait concept - teams always non-blocking
      "To check status: provide teamId. (Teams always run non-blocking in background.)",
      "Tips:",
      "  - Create first: team_run({tasks: [...]}) → returns teamId.",
      "  - Do other work...",
      "  - Then check status: team_run({teamId: '...'}).",
      "  - Progress updates are automatically sent during execution.",
      "  - Teams run in background until all tasks complete."
    ],
    parameters: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "ID of an existing team to query (optional)"
        },
        tasks: {
          type: "array",
          items: { type: "string" },
          description: "List of tasks to be completed by the team (required for new team)"
        },
        teamSize: {
          type: "number",
          description: "Number of agents in the team (default: 2, max: 4)"
        },
        teamRoles: {
          type: "array",
          items: { type: "string" },
          description: "Optional roles for each agent (e.g., ['planner', 'coder', 'reviewer'])"
        },
        // 'wait' parameter removed - teams always run non-blocking in background
      },
      required: []
    },
    /**
     * Execute team_run operation.
     *
     * @param toolCallId - Unique identifier for this tool call
     * @param params - Parameters for team operation (object) or JSON string
     * @param signal - AbortSignal (unused)
     * @param onUpdate - Optional callback for progress updates
     * @param ctx - Extension context
     * @returns Promise resolving to tool result
     */
    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      // Support LLM outputting JSON string or handle call references
      if (typeof params === "string") {
        // Detect call reference pattern (e.g., "call_abc123") which indicates unresolved reference
        if (params.startsWith('call_')) {
          return {
            content: [{ type: "text", text: `❌ Error: team_run expects a JSON object with tasks and optional teamSize. Received a call reference string (${params.substring(0, 20)}...). Call references must be resolved before passing to tools.` }],
            isError: true,
            details: { error: "Unresolved call reference" }
          };
        }
        try {
          params = JSON.parse(params);
        } catch (e: any) {
          return {
            content: [{ type: "text", text: `❌ Error: Invalid JSON string: ${e.message}` }],
            isError: true,
            details: { error: "Invalid JSON" }
          };
        }
      }

      const { teamId, tasks, teamSize, teamRoles } = params as {
        teamId?: string;
        tasks?: any;
        teamSize?: number;
        teamRoles?: string[];
      };

      // Prepare onUpdate wrapper for message accumulation (used for both new team and query)
      let wrappedOnUpdate: ((update: any) => void) | undefined;
      if (onUpdate) {
        // Accumulate all text messages across updates for complete history
        const messageHistory: Array<{ type: string; text: string }> = [];
        wrappedOnUpdate = (update: any) => {
          if (update.content && Array.isArray(update.content)) {
            for (const block of update.content) {
              if (block.type === 'text') {
                messageHistory.push({ type: 'text', text: block.text });
              }
            }
            onUpdate({
              content: [...messageHistory],
              details: update.details,
              isError: update.isError || false
            });
          }
        };
      } else {
        wrappedOnUpdate = undefined;
      }

            // If teamId is provided, query existing team status (always non-blocking)
      if (teamId) {
        const registry = TeamRegistry.getInstance();
        const team = registry.get(teamId);
        if (!team) {
          return {
            content: [{ type: "text", text: `Error: Team with ID ${teamId} not found` }],
            isError: true,
            details: { error: "Team not found" }
          };
        }

        // Reset auto-dispose timer on query
        registry.resetAutoDisposeTimer(teamId);

        // Always non-blocking: return current status immediately
        const status = await team.getTeamStatus();
        return {
          content: [{ type: "text", text: `📊 Team ${teamId} status: ${status.completedTasks}/${status.totalTasks} tasks completed, ${status.agents.length} agents` }],
          details: { teamId, status, running: status.completedTasks < status.totalTasks },
          isError: false
        };
      }
      // New team creation
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return {
          content: [{ type: "text", text: "Error: tasks must be a non-empty array of strings when creating a new team" }],
          isError: true,
          details: { error: "Invalid tasks parameter" }
        };
      }

      try {
        // Get parent runtime from tool context or global fallback
        const parentRuntime = ctx?.runtime || getGlobalRuntime();
        if (!parentRuntime) {
          throw new Error("No runtime context available. Team tool must be called from an active session (InteractiveMode not running?)");
        }


        // Send initial update (will be accumulated)
        wrappedOnUpdate?.({
          content: [{ type: "text", text: `🚀 Starting team with ${teamSize || 2} agents for ${tasks.length} tasks` }],
          details: { teamSize, teamRoles, taskCount: tasks.length }
        });

        // Boot team
        const team = await bootPiclawTeam(parentRuntime, {
          teamSize,
          teamRoles
        });

        wrappedOnUpdate?.({
          content: [{ type: "text", text: `✅ Team booted: ${team.roles.join(", ")}` }],
          details: { roles: team.roles, teamId: team.id }
        });

        // Execute tasks in background (non-blocking)
        await executeTeamTasks(team, tasks, wrappedOnUpdate, {});

        // Return immediately with teamId (non-blocking)
        return {
          content: [{ type: "text", text: `✅ Team started: ${team.id}\nAgents: ${team.roles.join(", ")}\nTasks: ${tasks.length}\n\nProgress updates will be shown automatically.\nTo check status, call team_run({teamId: "${team.id}").` }],
          details: {
            teamId: team.id,
            agentCount: team.roles.length,
            totalTasks: tasks.length,
            status: 'running'
          },
          isError: false
        };
      } catch (error: any) {
        // Send error update before returning (use wrappedOnUpdate if available to preserve history)
        const notify = wrappedOnUpdate || onUpdate;
        notify?.({
          content: [{ type: "text", text: `❌ Team execution failed: ${error.message}` }],
          details: { error: error.message, stack: error.stack },
          isError: true
        });
        return {
          content: [{ type: "text", text: `❌ Team execution failed: ${error.message}` }],
          details: { error: error.message, stack: error.stack },
          isError: true
        };
      }
    }
  };
}
