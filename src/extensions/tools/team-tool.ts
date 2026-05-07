/**
 * Team Management Tool - Unified non-blocking tool with events
 *
 * Actions:
 * - create: Create new team (immediate return with teamId)
 * - status: Get team progress and results (if completed)
 * - send: Send message to team channel
 * - dispose: Clean up team
 * - list: List active teams
 *
 * Events (auto-emitted to parent session):
 * - team_created: { teamId, agentCount, taskCount, tasks[] }
 * - team_progress: { teamId, completed, total, activeAgents }
 * - team_completed: { teamId, results[], status }
 * - team_disposed: { teamId }
 */

import { Type } from "typebox";
import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { AgentTeam } from "../../team/team-manager.js";

// Team registry stored on parent runtime
interface TeamInfo {
  team: AgentTeam;
  startTime: number;
}

function getTeamRegistry(runtime: any): Map<string, TeamInfo> {
  let registry = runtime._teamRegistry as Map<string, TeamInfo> | undefined;
  if (!registry) {
    registry = new Map();
    (runtime as any)._teamRegistry = registry;
  }
  return registry;
}

function generateTeamId(): string {
  return `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function registerTeamTool(api: ExtensionAPI): void {
  const tool: ToolDefinition = {
    name: "spawn_team",
    label: "Team",
    description: `Create and manage collaborative agent teams with messaging, workspace sharing, and dynamic task coordination. Teams run in background; parent receives events and can interact.\n\nParameters:\n- action (required): "create" | "status" | "send" | "dispose" | "list"\n- tasks (for create): Array of task strings - ["Analyze", "Build"]\n- size (for create): Number 1-4, default 2 - number of child agents\n- roles (for create): Optional array like ["analyst", "developer"]\n- teamId (for status/send/dispose): Team ID returned from create\n- channel (for send): "team.chat" | "team.help" | "direct.<agentId>"\n- content (for send): Message text to send\n- to (for send): Specific agent ID for direct message\n\nEvents emitted: team_created, team_progress, team_completed, team_disposed`,
    promptSnippet: 'spawn_team({ action: "create", tasks: ["task1", "task2"], size: 3 })',
    promptGuidelines: [
      'spawn_team creates and manages collaborative agent teams.',
      '',
      'ACTIONS:',
      '• create: spawn_team({ action: "create", tasks: ["Analyze", "Build"], size: 3 })',
      '• status: spawn_team({ action: "status", teamId: "<id>" })',
      '• send: spawn_team({ action: "send", teamId: "<id>", channel: "team.chat", content: "message" })',
      '• dispose: spawn_team({ action: "dispose", teamId: "<id>" })',
      '• list: spawn_team({ action: "list" })',
      '',
      'create: tasks[] required, size 1-4 (default 2). Non-blocking, returns teamId.',
      'send: channel can be "team.chat" or "direct.<agentId>".',
      'Events auto-emitted: team_created, team_progress, team_completed, team_disposed.',
    ],
    parameters: Type.Any(),
    async execute(toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) {
      const { bootPiclawTeam, executeTeamTasks } = await import("../../team/team-manager.js");

      const parentRuntime = (ctx as any)?.runtime?.sessionRuntime || (ctx as any)?.session?.runtime;
      if (!parentRuntime) {
        return {
          content: [{ type: "text", text: "❌ Error: No parent runtime available" }],
          details: { error: "No parent runtime", action: params.action } as any,
          isError: true,
        };
      }

      const registry = getTeamRegistry(parentRuntime);
      const action = params.action || "create";

      try {
        // ==================== CREATE ====================
        if (action === "create") {
          const size = Math.min(Math.max(1, params.size ?? 2), 4);
          const team = await bootPiclawTeam(parentRuntime, {
            teamSize: size,
            teamRoles: params.roles,
          });

          const teamId = generateTeamId();
          team.id = teamId;
          (team as any)._parentRuntime = parentRuntime;

          // Start team execution in background (non-blocking)
          const execPromise = executeTeamTasks(team, params.tasks)
            .finally(() => {
              // Auto-remove from registry after completion (optional)
              // We keep it so status can be checked; manual dispose recommended
            });

          registry.set(teamId, {
            team,
            startTime: Date.now(),
          });

          // Emit team_created event
          parentRuntime.emit("team_created", {
            teamId,
            agentCount: team.roles.length,
            taskCount: params.tasks.length,
            tasks: params.tasks,
          });

          return {
            content: [{ 
              type: "text", 
              text: `✅ Team created (${team.roles.length} agents: ${team.roles.join(", ")})\n` +
                    `📋 Tasks (${params.tasks.length}): ${params.tasks.map((t: string, i: number) => `[${i}] ${t}`).join(", ")}\n` +
                    `🆔 Team ID: ${teamId}\n` +
                    `▶️ Team running in background. Listen for events: team_created, team_progress, team_completed.\n` +
                    `   Use spawn_team({action: \"status\", teamId: \"${teamId}\"}) to check progress.` 
            }],
            details: { 
              teamId, 
              status: "running", 
              agents: team.roles.length,
              taskCount: params.tasks.length,
              message: "Team started. Non-blocking. Events will be emitted.",
              action: "create"
            } as any,
            isError: false,
          };
        }

        // ==================== STATUS ====================
        if (action === "status") {
          const teamInfo = registry.get(params.teamId);
          if (!teamInfo) {
            return {
              content: [{ type: "text", text: `❌ Team not found: ${params.teamId}` }],
              details: { error: "Team not found", action, teamId: params.teamId } as any,
              isError: true,
            };
          }

          const { team } = teamInfo;
          const teamStatus = team.getTeamStatus();
          const summary = team.getContext().getTeamSummary();
          const completed = summary.completedTasks === summary.totalTasks;

          let statusText = `🔄 Team ${params.teamId} Status:\n\n`;
          statusText += `Agents (${team.roles.length}): ${team.roles.join(", ")}\n`;
          statusText += `Tasks: ${summary.completedTasks}/${summary.totalTasks} completed\n`;
          statusText += `Active agents: ${summary.activeAgents}\n`;
          statusText += `Blocked agents: ${summary.blockedAgents}\n`;
          statusText += `Phase: ${summary.currentPhase}\n`;
          
          if (completed) {
            const results = team.getResults();
            statusText += `\n✅ Team completed! Results:\n${results.map((r: string, i: number) => `Task ${i}: ${r.substring(0, 150)}${r.length > 150 ? '...' : ''}`).join("\n\n")}`;
          }

          return {
            content: [{ type: "text", text: statusText }],
            details: {
              teamId: params.teamId,
              status: completed ? "completed" : "running",
              summary,
              agents: teamStatus.agents,
              loadDistribution: teamStatus.loadDistribution,
              ...(completed && { results: team.getResults() }),
              action: "status"
            } as any,
            isError: false,
          };
        }

        // ==================== SEND ====================
        if (action === "send") {
          const teamInfo = registry.get(params.teamId);
          if (!teamInfo) {
            return {
              content: [{ type: "text", text: `❌ Team not found: ${params.teamId}` }],
              details: { error: "Team not found", action, teamId: params.teamId } as any,
              isError: true,
            };
          }

          const channel = params.channel || "team.chat";
          teamInfo.team.getMessageBus().publish({
            channel,
            from: "parent",
            content: params.content,
            type: channel === "team.chat" ? "chat" : "notification",
            ...(params.to && { replyTo: params.to }),
          });

          return {
            content: [{ type: "text", text: `📤 Message sent to ${channel} in team ${params.teamId}` }],
            details: { success: true, channel, teamId: params.teamId, action: "send" } as any,
            isError: false,
          };
        }

        // ==================== DISPOSE ====================
        if (action === "dispose") {
          const teamInfo = registry.get(params.teamId);
          if (!teamInfo) {
            return {
              content: [{ type: "text", text: `❌ Team not found: ${params.teamId}` }],
              details: { error: "Team not found", action, teamId: params.teamId } as any,
              isError: true,
            };
          }

          await teamInfo.team.dispose();
          registry.delete(params.teamId);

          // Emit team_disposed event
          const parentRuntime = (ctx as any)?.runtime?.sessionRuntime || (ctx as any)?.session?.runtime;
          parentRuntime?.session?.extensionRunner?.emit("team_disposed", { teamId: params.teamId });

          return {
            content: [{ type: "text", text: `🗑️ Team ${params.teamId} disposed` }],
            details: { success: true, teamId: params.teamId, action: "dispose" } as any,
            isError: false,
          };
        }

        // ==================== LIST ====================
        if (action === "list") {
          const teams = Array.from(registry.entries()).map(([id, info]) => {
            const summary = info.team.getContext().getTeamSummary();
            return {
              teamId: id,
              agents: info.team.roles.length,
              tasks: summary.totalTasks,
              completed: summary.completedTasks,
              status: summary.completedTasks === summary.totalTasks ? "completed" : "running",
              uptime: Date.now() - info.startTime,
            };
          });

          return {
            content: [{
              type: "text",
              text: teams.length === 0 
                ? "📭 No active teams"
                : `📋 Active Teams (${teams.length}):\n\n` +
                  teams.map((t: any, i: number) => 
                    `${i + 1}. ${t.teamId} (${t.agents} agents, ${t.completed}/${t.tasks} tasks, ${t.status})`
                  ).join("\n")
            }],
            details: { teams, action: "list", count: teams.length } as any,
            isError: false,
          };
        }

        return {
          content: [{ type: "text", text: `❌ Unknown action: ${action}` }],
          details: { error: `Unknown action: ${action}`, action } as any,
          isError: true,
        };

      } catch (error: any) {
        return {
          content: [{ type: "text", text: `❌ Team error: ${error.message}` }],
          details: { error: error.message, action } as any,
          isError: true,
        };
      }
    },
  };

  api.registerTool(tool);
}
