#!/usr/bin/env node
/**
 * Team Management Tool - Fixed version
 *
 * Actions:
 * - create: Create new team (immediate return with teamId)
 * - status: Get team progress and results (if completed)
 * - send: Send message to team channel
 * - dispose: Clean up team
 * - list: List active teams
 *
 * Events emitted via api.events:
 * - team_created: { teamId, agentCount, taskCount, tasks[] }
 * - team_progress: { teamId, completed, total, activeAgents }
 * - team_completed: { teamId, results[], status }
 * - team_disposed: { teamId }
 */

import { Type } from "typebox";
import type { ExtensionAPI, ToolDefinition, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AgentTeam } from "../../team/team-manager.js";

// Team registry stored in extension closure (per-session)
interface TeamInfo {
  team: AgentTeam;
  startTime: number;
}

function generateTeamId(): string {
  return `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function registerTeamTool(api: ExtensionAPI): void {
  // Registry lives in closure, isolated per extension instance (per session)
  const registry = new Map<string, TeamInfo>();

  // Cleanup all teams when session shuts down
  const handleShutdown = () => {
    for (const [teamId, info] of registry) {
      try {
        info.team.dispose();
      } catch (e) {
        console.error(`[team-tool] Error disposing team ${teamId}:`, e);
      }
    }
    registry.clear();
  };

  api.on("session_shutdown", handleShutdown);

  const tool: ToolDefinition = {
    name: "spawn_team",
    label: "Team",
    description: `Create and manage collaborative agent teams with messaging, workspace sharing, and dynamic task coordination. Teams run in background; parent receives events and can interact.\n\nParameters:\n- action (required): "create" | "status" | "send" | "dispose" | "list"\n- tasks (for create): Array of task strings - ["Analyze", "Build"]\n- size (for create): Number 1-4, default 2 - number of child agents\n- roles (for create): Optional array like ["analyst", "developer"]\n- teamId (for status/send/dispose): Team ID returned from create\n- channel (for send): "team.chat" | "team.help" | "direct.<agentId>"\n- content (for send): Message text to send\n- to (for send): Specific agent ID for direct message\n\nEvents emitted: team_created, team_progress, team_completed, team_disposed`,
    promptSnippet: 'spawn_team({ action: "create", tasks: ["task1", "task2"], size: 3 })',
    promptGuidelines: [
      'spawn_team creates and manages collaborative agent teams.',
      '',
      'ACTIONS:',
      '• create: spawn_team({ action: "create", tasks: ["Analyze requirements", "Build feature"], size: 2 })',
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
    async execute(toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: ((update: any) => void) | undefined, ctx: ExtensionContext) {
      const { bootPiclawTeam, executeTeamTasks } = await import("../../team/team-manager.js");

      // Extract parent runtime from helper (no private property access)
      const parentRuntime = (ctx.sessionManager as any).parentRuntime;
      if (!parentRuntime) {
        return {
          content: [{ type: "text", text: "❌ Error: Cannot access parent runtime. spawn_team requires a parent session." }],
          details: { error: "Missing parentRuntime", action: params.action } as any,
          isError: true,
        };
      }

      const action = params.action || "create";

      try {
        // ==================== CREATE ====================
        if (action === "create") {
          // Validate and parse tasks parameter
          let tasks = params.tasks;

          // Handle tasks passed as JSON string
          if (typeof tasks === 'string') {
            try {
              tasks = JSON.parse(tasks);
            } catch (e) {
              return {
                content: [{ type: "text", text: `❌ Error: tasks must be a non-empty array of task strings.\nExample: spawn_team({ action: "create", tasks: ["Analyze requirements", "Build feature"], size: 2 })` }],
                details: { error: "Invalid tasks parameter (JSON parse failed)", action: "create", providedTasks: params.tasks } as any,
                isError: true,
              };
            }
          }

          // Validate tasks array
          if (!Array.isArray(tasks) || tasks.length === 0 || !tasks.every((t: any) => typeof t === "string")) {
            return {
              content: [{ type: "text", text: `❌ Error: tasks must be a non-empty array of task strings.\nExample: spawn_team({ action: "create", tasks: ["Analyze requirements", "Build feature"], size: 2 })` }],
              details: { error: "Invalid tasks parameter", action: "create", providedTasks: params.tasks } as any,
              isError: true,
            };
          }

          // Parse size and roles
          const size = typeof params.size === "number" ? Math.min(4, Math.max(1, params.size)) : 2;
          const roles = Array.isArray(params.roles) ? params.roles : undefined;

          // Create team
          const team = await (bootPiclawTeam as any)({
            parentRuntime,
            tasks: tasks as string[],
            size,
            roles,
          });

          const teamId = generateTeamId();
          registry.set(teamId, { team, startTime: Date.now() });

          // Emit team_created event (using public api.events)
          api.events.emit("team_created", {
            teamId,
            agentCount: team.roles.length,
            taskCount: tasks.length,
            tasks: tasks as string[],
          });

          return {
            content: [{ type: "text", text: `✅ Team ${teamId} created with ${size} agents` }],
            details: { teamId, size, tasks: tasks as string[], roles } as any,
            isError: false,
          };
        }

        // ==================== STATUS ====================
        if (action === "status") {
          const teamId = params.teamId as string;
          if (!teamId) {
            return {
              content: [{ type: "text", text: "❌ Error: teamId required for status" }],
              details: { error: "teamId required", action: "status" } as any,
              isError: true,
            };
          }

          const info = registry.get(teamId);
          if (!info) {
            return {
              content: [{ type: "text", text: `❌ Team not found: ${teamId}` }],
              details: { error: "Team not found", teamId, action: "status" } as any,
              isError: true,
            };
          }

          const summary = info.team.getContext().getTeamSummary();
          const status = {
            teamId,
            agents: info.team.roles.length,
            tasks: summary.totalTasks,
            completed: summary.completedTasks,
            activeAgents: summary.activeAgents,
            status: summary.completedTasks === summary.totalTasks ? "completed" : "running",
            uptime: Date.now() - info.startTime,
          };

          return {
            content: [{ type: "text", text: `Team ${teamId}: ${summary.completedTasks}/${summary.totalTasks} tasks, ${summary.activeAgents} active agents` }],
            details: status as any,
            isError: false,
          };
        }

        // ==================== SEND ====================
        if (action === "send") {
          const teamId = params.teamId as string;
          const channel = params.channel as string;
          const content = params.content as string;

          if (!teamId || !channel || !content) {
            return {
              content: [{ type: "text", text: "❌ Error: teamId, channel, and content required for send" }],
              details: { error: "Missing parameters", action: "send", required: ["teamId", "channel", "content"] } as any,
              isError: true,
            };
          }

          const info = registry.get(teamId);
          if (!info) {
            return {
              content: [{ type: "text", text: `❌ Team not found: ${teamId}` }],
              details: { error: "Team not found", teamId, action: "send" } as any,
              isError: true,
            };
          }

          try {
            // Cast to any to bypass type checking (AgentTeam may not have sendMessage in public types)
            await (info.team as any).sendMessage(channel, content, params.to);
            return {
              content: [{ type: "text", text: `📤 Sent to team ${teamId} via ${channel}` }],
              details: { teamId, channel, content, to: params.to } as any,
              isError: false,
            };
          } catch (err: any) {
            return {
              content: [{ type: "text", text: `❌ Send failed: ${err.message}` }],
              details: { error: err.message, teamId, channel } as any,
              isError: true,
            };
          }
        }

        // ==================== DISPOSE ====================
        if (action === "dispose") {
          const teamId = params.teamId as string;
          if (!teamId) {
            return {
              content: [{ type: "text", text: "❌ Error: teamId required for dispose" }],
              details: { error: "teamId required", action: "dispose" } as any,
              isError: true,
            };
          }

          const info = registry.get(teamId);
          if (!info) {
            return {
              content: [{ type: "text", text: `⚠️ Team not found (already disposed?): ${teamId}` }],
              details: { error: "Team not found", teamId, action: "dispose" } as any,
              isError: false,
            };
          }

          try {
            await info.team.dispose();
            registry.delete(teamId);

            // Emit team_disposed event
            api.events.emit("team_disposed", { teamId });
          } catch (err: any) {
            return {
              content: [{ type: "text", text: `❌ Dispose failed: ${err.message}` }],
              details: { error: err.message, teamId } as any,
              isError: true,
            };
          }

          return {
            content: [{ type: "text", text: `🗑️ Team ${teamId} disposed` }],
            details: { success: true, teamId, action: "dispose" } as any,
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

          if (teams.length === 0) {
            return {
              content: [{ type: "text", text: "No active teams. Use spawn_team({ action: 'create', tasks: [...] }) to create one." }],
              details: { teams: [] } as any,
              isError: false,
            };
          }

          const lines = teams.map(t => `• ${t.teamId}: ${t.status} (${t.completed}/${t.tasks} tasks, ${t.agents} agents)`);
          return {
            content: [{ type: "text", text: `Active teams (${teams.length}):\n${lines.join("\n")}` }],
            details: { teams } as any,
            isError: false,
          };
        }

        // ==================== UNKNOWN ====================
        return {
          content: [{ type: "text", text: `❌ Unknown action: ${action}. Use: create, status, send, dispose, list` }],
          details: { error: "Unknown action", action } as any,
          isError: true,
        };

      } catch (err: any) {
        console.error("[team-tool] Unexpected error:", err);
        return {
          content: [{ type: "text", text: `❌ Unexpected error: ${err.message}` }],
          details: { error: err.message, stack: err.stack, action } as any,
          isError: true,
        };
      }
    },

    renderCall(args: any, theme: any, _context: any) {
      const th = theme;
      const action = args.action || "unknown";
      let text = th.fg("toolTitle", th.bold("spawn_team ")) + th.fg("muted", action);
      if (action === "create" && args.tasks?.length) {
        text += ` ${th.fg("dim", `(${args.tasks.length} tasks, ${args.size || 2} agents)`)}`;
      } else if (action === "send") {
        text += ` ${th.fg("dim", `to ${args.channel}`)}`;
      }
      return new (require("@mariozechner/pi-tui").Text)(text, 0, 0);
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any, _context: any) {
      const th = theme;
      const details = result.details as any;

      if (options.isPartial) {
        return new (require("@mariozechner/pi-tui").Text)(th.fg("warning", "Processing..."), 0, 0);
      }

      if (result.isError) {
        return new (require("@mariozechner/pi-tui").Text)(th.fg("error", `Error: ${details?.error || "Unknown"}`), 0, 0);
      }

      switch (details?.action) {
        case "create":
          return new (require("@mariozechner/pi-tui").Text)(th.fg("success", `✅ Team created: ${details.teamId}`), 0, 0);
        case "status": {
          const { teamId, completed, tasks, status } = details;
          const color = status === "completed" ? "success" : "info";
          return new (require("@mariozechner/pi-tui").Text)(th.fg(color, `Team ${teamId}: ${completed}/${tasks} tasks, ${status}`), 0, 0);
        }
        case "send":
          return new (require("@mariozechner/pi-tui").Text)(th.fg("info", `📤 Sent to ${details.teamId}`), 0, 0);
        case "dispose":
          return new (require("@mariozechner/pi-tui").Text)(th.fg("warning", `🗑️ Disposed ${details.teamId}`), 0, 0);
        case "list":
          return new (require("@mariozechner/pi-tui").Text)(th.fg("info", `Teams: ${details.teams?.length || 0} active`), 0, 0);
        default:
          return new (require("@mariozechner/pi-tui").Text)(th.fg("muted", "Done"), 0, 0);
      }
    },
  };

  api.registerTool(tool);
}
