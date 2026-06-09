#!/usr/bin/env node

/**
 * Team Ops Renderer
 *
 * Beautiful UI for team_ops tool results.
 * Shows team status, tasks, workspace, messages.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

interface TeamStatusDetails {
  teamId: string;
  totalAgents: number;
  activeAgents: number;
  pendingTasks: number;
  completedTasks: number;
  agents?: Array<{ id: string; status: string; currentTask?: string }>;
}

interface TeamMessage {
  from: string;
  channel: string;
  content: string;
  timestamp: string;
}

interface WorkspaceEntry {
  key: string;
  value: string;
  owner?: string;
}

/**
 * Register the team_ops renderer.
 */
export function registerTeamOpsRenderer(api: ExtensionAPI): void {
  if (typeof api.registerMessageRenderer !== 'function') {
    return;
  }

  api.registerMessageRenderer("team_ops_result", (msg: any, options, theme) => {
    const details = msg.details as any;
    if (!details) {
      return new Text("👥 Team operation");
    }

    const lines: string[] = [];

    // Header
    lines.push(theme.fg("accent", "👥 Team Ops").bold());

    // Action from content
    const contentText = msg.content?.[0]?.text || "";
    if (contentText && !contentText.includes("❌")) {
      lines.push(`\n${theme.fg("text", contentText)}`);
    }

    // Error handling
    if (details.error || msg.isError) {
      lines.push(`\n${theme.fg("error", `❌ ${details.error || "Error occurred"}`)}`);
      return new Text(lines.join("\n"));
    }

    // Type-specific rendering
    if (details.action === "get_team_status") {
      const status = details as TeamStatusDetails;
      lines.push(`\nTeam: ${status.teamId}`);
      lines.push(`Agents: ${status.activeAgents}/${status.totalAgents} active`);
      lines.push(`Tasks: ${status.pendingTasks} pending, ${status.completedTasks} completed`);

      if (status.agents && status.agents.length > 0) {
        lines.push("\nAgents:");
        for (const agent of status.agents) {
          const statusIcon = agent.status === "working" ? "🔄" : "💤";
          lines.push(`  ${statusIcon} ${agent.id}: ${agent.status}${agent.currentTask ? ` - ${agent.currentTask.substring(0, 40)}...` : ''}`);
        }
      }
    } else if (details.action === "get_messages") {
      const messages = details.messages as TeamMessage[] || [];
      lines.push(`\nMessages (${messages.length}):`);
      for (const msg of messages.slice(0, 10)) {
        lines.push(`  [${msg.channel}] ${theme.fg("accent", msg.from)}: ${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}`);
      }
      if (messages.length > 10) {
        lines.push(`  ${theme.fg("dim", `...and ${messages.length - 10} more.`)}`);
      }
    } else if (details.action === "workspace_read") {
      lines.push(`\nWorkspace key: ${theme.fg("accent", details.key)}`);
      if (details.value !== undefined) {
        lines.push(`Value: ${theme.fg("text", details.value.substring(0, 200))}${details.value.length > 200 ? '...' : ''}`);
      } else {
        lines.push(theme.fg("dim", "No value set"));
      }
    } else if (details.action === "workspace_write") {
      lines.push(`\n${theme.fg("success", "✓ Wrote to workspace")}: ${details.key}`);
    } else if (details.action === "send_message") {
      lines.push(`\n${theme.fg("success", "✓ Message sent")} to ${details.channel || 'team.chat'}`);
    } else if (details.action === "claim_task") {
      if (details.taskIndex !== undefined) {
        lines.push(`\n${theme.fg("success", "✓ Claimed task")} #${details.taskIndex}`);
      } else {
        lines.push(`\n${theme.fg("warning", "No tasks available")}`);
      }
    } else if (details.action === "complete_task") {
      lines.push(`\n${theme.fg("success", "✓ Completed task")} #${details.taskIndex}`);
    } else if (details.action === "release_task") {
      lines.push(`\n${theme.fg("accent", "↩ Released task")} #${details.taskIndex}`);
    } else if (details.action === "update_status") {
      lines.push(`\n${theme.fg("accent", "● Status updated")}: ${details.status}`);
    }

    return new Text(lines.join("\n"));
  });
}
