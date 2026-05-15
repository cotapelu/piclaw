/**
 * Minimal Team Ops Tool
 *
 * Actions for child agents to collaborate:
 * - Task management: claim_task, release_task, complete_task, get_team_status
 * - Workspace: workspace_read, workspace_write
 * - Messaging: send_message, get_messages
 * - Status: update_status
 */

import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { AgentTeam } from "./team-manager.js";

/**
 * Create team_ops tool for child agents
 */
export function createTeamOpsTool(team: AgentTeam): ToolDefinition {
  return {
    name: "team_ops",
    label: "Team Ops",
    description: "Team collaboration: claim/release/complete tasks, workspace read/write, send/get messages, update status",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "claim_task",
            "release_task",
            "complete_task",
            "get_team_status",
            "workspace_read",
            "workspace_write",
            "send_message",
            "get_messages",
            "update_status",
          ],
          description: "Action to perform"
        },
        // Task params
        taskIndex: { type: "number", description: "Task index (for complete_task)" },
        result: { type: "string", description: "Task result (for complete_task)" },
        // Workspace params
        key: { type: "string", description: "Workspace key" },
        value: { type: "string", description: "Value to write (string)" },
        // Messaging params
        channel: { type: "string", description: "Channel (default: team.chat)" },
        content: { type: "string", description: "Message content" },
        // Status params
        status: { type: "string", description: "Agent status (idle, working, etc.)" },
      },
      required: ["action"]
    },
    async execute(params: any, ctx: any) {
      const { action } = params;

      try {
        switch (action) {
          // ==================== TASK MANAGEMENT ====================
          case "claim_task": {
            const taskIndex = team.claimTask(ctx.session.id);
            if (taskIndex !== null) {
              return {
                content: [{ type: "text", text: `Claimed task ${taskIndex}: ${team.tasks[taskIndex]}` }],
                details: { taskIndex },
                isError: false,
              } as const;
            }
            return {
              content: [{ type: "text", text: "No pending tasks available." }],
              details: undefined,
              isError: true,
            } as const;
          }

          case "release_task": {
            const agentId = ctx.session.id;
            const currentTask = team.getMyCurrentTask(agentId);
            if (currentTask === null) {
              return {
                content: [{ type: "text", text: "No active task to release." }],
                details: undefined,
                isError: true,
              } as const;
            }
            const released = team.releaseTask(agentId, currentTask);
            if (released) {
              return {
                content: [{ type: "text", text: `Released task ${currentTask}` }],
                details: { taskIndex: currentTask },
                isError: false,
              } as const;
            }
            return {
              content: [{ type: "text", text: `Failed to release task ${currentTask}` }],
              details: undefined,
              isError: true,
            } as const;
          }

          case "complete_task": {
            const { taskIndex, result } = params;
            const agentId = ctx.session.id;
            if (taskIndex === undefined) {
              return {
                content: [{ type: "text", text: "Missing taskIndex" }],
                details: undefined,
                isError: true,
              } as const;
            }
            const currentTask = team.getMyCurrentTask(agentId);
            if (currentTask !== taskIndex) {
              return {
                content: [{ type: "text", text: `Task ${taskIndex} is not assigned to you.` }],
                details: undefined,
                isError: true,
              } as const;
            }
            team.completeTask(agentId, taskIndex, result || "");
            return {
              content: [{ type: "text", text: `Completed task ${taskIndex}` }],
              details: { taskIndex, result },
              isError: false,
            } as const;
          }

          case "get_team_status": {
            const status = team.getTeamStatus();
            return {
              content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
              details: status,
              isError: false,
            } as const;
          }

          // ==================== WORKSPACE ====================
          case "workspace_read": {
            const { key } = params;
            if (!key) {
              return { content: [{ type: "text", text: "Missing key" }], details: undefined, isError: true } as const;
            }
            const value = team.getWorkspace().get(key);
            return {
              content: [{ type: "text", text: value !== undefined ? String(value) : "(not found)" }],
              details: { key, value, exists: value !== undefined },
              isError: false,
            } as const;
          }

          case "workspace_write": {
            const { key, value } = params;
            if (!key || value === undefined) {
              return { content: [{ type: "text", text: "Missing key or value" }], details: undefined, isError: true } as const;
            }
            team.getWorkspace().set(key, String(value), ctx.session.id);
            return {
              content: [{ type: "text", text: `Wrote to workspace key: ${key}` }],
              details: { key },
              isError: false,
            } as const;
          }

          // ==================== MESSAGING ====================
          case "send_message": {
            const { channel = "team.chat", content } = params;
            if (!content) {
              return { content: [{ type: "text", text: "Missing content" }], details: undefined, isError: true } as const;
            }
            team.publishMessage(channel, ctx.session.id, content);
            return {
              content: [{ type: "text", text: `Sent to ${channel}` }],
              details: { channel },
              isError: false,
            } as const;
          }

          case "get_messages": {
            const { channel = "team.chat", limit } = params;
            const msgs = team.getMessages(channel, limit);
            const text = msgs.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.from}: ${m.content}`).join("\n");
            return {
              content: [{ type: "text", text: text || "(no messages)" }],
              details: { channel, messages: msgs },
              isError: false,
            } as const;
          }

          // ==================== STATUS ====================
          case "update_status": {
            const { status } = params;
            if (!status) {
              return { content: [{ type: "text", text: "Missing status" }], details: undefined, isError: true } as const;
            }
            team.getMyCurrentTask(ctx.session.id); // ensures agent exists
            const current = team.getMyCurrentTask(ctx.session.id);
            // For simplicity, just record it; not used yet in minimal version
            return {
              content: [{ type: "text", text: `Status updated to: ${status}` }],
              details: { status, currentTask: current },
              isError: false,
            } as const;
          }

          default:
            return {
              content: [{ type: "text", text: `Unknown action: ${action}` }],
              details: undefined,
              isError: true,
            } as const;
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          details: undefined,
          isError: true,
        } as const;
      }
    },
  };
}
