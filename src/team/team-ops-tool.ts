/**
 * Team Ops Tool - Child agent collaboration tool
 *
 * This tool provides all collaboration actions for child agents:
 * - Task management (claim, release, steal)
 * - Messaging (send_message, broadcast, send_direct)
 * - Workspace (read, write with locking)
 * - Context (update_status, report_blocker, add_decision)
 *
 * Also emits events to team.events channel for parent observation.
 */

import type { AgentSessionRuntime, ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { AgentTeam } from "./team-manager.js";

/**
 * Emit a team event to the message bus
 */
function emitTeamEvent(team: AgentTeam, agentId: string, eventType: string, data: any) {
  const messageBus = team.getMessageBus();
  messageBus.publish({
    channel: "team.events",
    from: agentId,
    content: JSON.stringify({
      type: eventType,
      agentId,
      timestamp: Date.now(),
      data
    }),
    type: "system",
  });
}

/**
 * Create team_ops tool for child agents
 * This tool is registered to each child agent's session
 */
export function createTeamOpsTool(team: AgentTeam): ToolDefinition {
  return {
    name: "team_ops",
    label: "Team Ops",
    description:
      "Advanced team collaboration: claim/release tasks, read/write workspace (with locking), send messages, get team status, request help, steal work.",
    parameters: {
      type: "object",
      properties: {
        // Task management
        action: {
          type: "string",
          enum: [
            "claim_task", "release_task", "steal_task", "get_my_task",
            "get_team_status", "get_stuck_tasks",
            // Workspace (with conflict resolution)
            "workspace_read", "workspace_write", "workspace_lock", "workspace_unlock", "workspace_list", "workspace_info",
            // Messaging
            "send_message", "get_messages", "broadcast", "send_direct",
            // Team context
            "get_context", "update_status", "add_decision", "report_blocker",
            // Dynamic management
            "request_help", "get_load_distribution",
          ],
          description: "Action to perform"
        },
        // Task params
        taskIndex: { type: "number", description: "Task index" },
        reason: { type: "string", description: "Reason for action (block, help, etc.)" },
        // Workspace params
        key: { type: "string", description: "Workspace key/path" },
        value: { type: "string", description: "Value to write (JSON string)" },
        lock: { type: "boolean", description: "Acquire lock on read (default false)" },
        lockToken: { type: "string", description: "Lock token from previous lock" },
        // Messaging params
        channel: { type: "string", description: "Channel name (e.g., team.chat, team.help)" },
        content: { type: "string", description: "Message content" },
        to: { type: "string", description: "Recipient agent ID (for direct messages)" },
        since: { type: "number", description: "Get messages since timestamp" },
        limit: { type: "number", description: "Limit number of messages" },
        // Context params
        status: { type: "string", enum: ["idle", "working", "waiting", "help_requested", "blocked", "complete"], description: "Agent status" },
        activity: { type: "string", description: "Activity description" },
        progress: { type: "number", description: "Progress percentage (0-100)" },
        issue: { type: "string", description: "Decision issue" },
        decision: { type: "string", description: "Decision made" },
        rationale: { type: "string", description: "Decision rationale" },
        makers: { type: "array", items: { type: "string" }, description: "Agents involved in decision" },
      },
      required: ["action"]
    },
    async execute(params: any, ctx: any) {
      const agentRuntime = ctx.runtime as AgentSessionRuntime;
      const agentId = team.getAgentId(agentRuntime);
      if (!agentId) {
        return { error: "Unknown agent" } as any;
      }

      const { action } = params;
      
      try {
        switch (action) {
          // ==================== TASK MANAGEMENT ====================
          case "claim_task": {
            const taskIndex = team.claimTask(agentId);
            if (taskIndex !== null) {
              emitTeamEvent(team, agentId, "task_claimed", { taskIndex, task: team.tasks[taskIndex] });
              return {
                taskIndex,
                task: team.tasks[taskIndex],
                assignedTo: agentId
              } as any;
            }
            return { taskIndex: null, message: "No pending tasks" } as any;
          }
          
          case "release_task": {
            const released = team.releaseTask(agentId, params.taskIndex);
            if (released) {
              emitTeamEvent(team, agentId, "task_released", { taskIndex: params.taskIndex });
            }
            return { success: released } as any;
          }
          
          case "steal_task": {
            const taskIndex = team.stealTask(agentId);
            if (taskIndex !== null) {
              emitTeamEvent(team, agentId, "task_stolen", { taskIndex, stolenFrom: team.getTaskAssignee(taskIndex) });
              return {
                taskIndex,
                task: team.tasks[taskIndex],
                stolenFrom: team.getTaskAssignee(taskIndex)
              } as any;
            }
            return { taskIndex: null, message: "No stealable tasks" } as any;
          }
          
          case "get_my_task": {
            const taskIndex = team.getMyCurrentTask(agentId);
            if (taskIndex !== null) {
              return { taskIndex, task: team.tasks[taskIndex] } as any;
            }
            return { taskIndex: null } as any;
          }
          
          case "get_team_status": {
            return team.getTeamStatus() as any;
          }
          
          case "get_stuck_tasks": {
            return { stuckTasks: team.getStuckTasks() } as any;
          }
          
          // ==================== WORKSPACE (COLLABORATIVE) ====================
          case "workspace_read": {
            if (!params.key) {
              return { value: null } as any;
            }
            const result = team.getCollaborativeWorkspace().read(params.key);
            emitTeamEvent(team, agentId, "workspace_read", { key: params.key, found: !!result });
            if (!result) {
              return { value: null, version: 0, locked: false } as any;
            }
            return { 
              value: result.value, 
              version: result.version,
              locked: result.locked,
              lockedBy: result.lockedBy 
            } as any;
          }
          
          case "workspace_write": {
            if (params.key === undefined || params.value === undefined) {
              return { success: false, error: "key and value required" } as any;
            }
            let parsedValue: any = params.value;
            if (typeof params.value === 'string') {
              try {
                parsedValue = JSON.parse(params.value);
              } catch (e) {
                // Keep as string if not JSON
              }
            }
            const result = await team.getCollaborativeWorkspace().write(
              params.key, parsedValue, agentId, 
              params.description || `Written by ${agentId}`
            );
            emitTeamEvent(team, agentId, "workspace_written", { key: params.key });
            return result as any;
          }
          
          case "workspace_lock": {
            if (!params.key) {
              return { locked: false, error: "key required" } as any;
            }
            const lockResult = team.getCollaborativeWorkspace().tryLock(params.key, agentId, params.ttl);
            return { locked: lockResult.locked, lockToken: lockResult.lockToken, lockedBy: lockResult.owner } as any;
          }
          
          case "workspace_unlock": {
            if (!params.key) return { success: false } as any;
            const success = team.getCollaborativeWorkspace().releaseLock(params.key, agentId);
            return { success } as any;
          }
          
          case "workspace_list": {
            return { keys: team.getCollaborativeWorkspace().list() } as any;
          }
          
          case "workspace_info": {
            return team.getCollaborativeWorkspace().getArtifactInfo(params.key) as any;
          }
          
          // ==================== MESSAGING ====================
          case "send_message": {
            if (!params.channel || !params.content) {
              return { success: false, error: "channel and content required" } as any;
            }
            const msg = team.getMessageBus().publish({
              channel: params.channel,
              from: agentId,
              content: params.content,
              type: params.type || "chat",
            });
            emitTeamEvent(team, agentId, "message_sent", { channel: params.channel, preview: params.content.substring(0, 50) });
            return { success: true, messageId: msg.id } as any;
          }
          
          case "get_messages": {
            if (!params.channel) {
              return { messages: [] } as any;
            }
            const messages = team.getMessageBus().getMessages(params.channel, {
              limit: params.limit || 50,
              since: params.since,
            });
            return { messages } as any;
          }
          
          case "broadcast": {
            if (!params.content) {
              return { success: false, error: "content required" } as any;
            }
            team.getMessageBus().broadcast(agentId, params.content, params.type || "notification");
            return { success: true } as any;
          }
          
          case "send_direct": {
            if (!params.to || !params.content) {
              return { success: false, error: "to and content required" } as any;
            }
            team.getMessageBus().sendDirectMessage(agentId, params.to, params.content);
            return { success: true } as any;
          }
          
          // ==================== TEAM CONTEXT ====================
          case "get_context": {
            return { context: team.getContext().getSnapshot() } as any;
          }
          
          case "update_status": {
            team.getContext().setAgentStatus(
              agentId,
              params.status || "idle",
              params.activity,
              params.progress
            );
            emitTeamEvent(team, agentId, "status_changed", { status: params.status, activity: params.activity });
            return { success: true } as any;
          }
          
          case "add_decision": {
            if (!params.issue || !params.decision || !params.rationale) {
              return { success: false, error: "issue, decision, and rationale required" } as any;
            }
            team.getContext().addDecision(
              params.issue,
              params.decision,
              params.rationale,
              params.makers || [agentId]
            );
            return { success: true } as any;
          }
          
          case "report_blocker": {
            if (!params.reason) {
              return { success: false, error: "reason required" } as any;
            }
            const taskIndex = team.getMyCurrentTask(agentId);
            team.getContext().blockTask(agentId, taskIndex ?? -1, params.reason, params.severity || "medium");
            return { success: true } as any;
          }
          
          case "get_load_distribution": {
            return { distribution: team.getLoadDistribution() } as any;
          }
          
          case "request_help": {
            const taskIndex = team.getMyCurrentTask(agentId);
            if (taskIndex === null) {
              return { success: false, message: "No active task" } as any;
            }
            team.requestHelp(agentId, taskIndex, params.reason || "Help needed");
            emitTeamEvent(team, agentId, "help_requested", { taskIndex, reason: params.reason });
            return { success: true } as any;
          }
          
          default:
            return { error: `Unknown action: ${action}` } as any;
        }
      } catch (err: any) {
        return { success: false, error: err.message } as any;
      }
    },
  };
}
