#!/usr/bin/env node
/**
 * Team Status Widget
 *
 * Shows live team overview in the UI widget area.
 * Displays: active teams, task progress, agent statuses.
 * Supports toggle via /team command.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TeamRegistry } from "./team-manager.js";

// State for toggling
let teamWidgetEnabled = true;
let currentCtx: any = null;
let intervalId: NodeJS.Timeout | null = null;

function buildHeaderLines(theme: any): string[] {
  return [
    theme.fg("accent", "👥 Team").bold(),
    ""
  ];
}

function buildTeamLines(ui: any, teamId: string, status: any): string[] {
  const shortId = teamId.slice(-6);
  const lines: string[] = [];
  lines.push(ui.theme.fg("accent", `Team ${shortId}`));
  lines.push(`  Tasks: ${status.completedTasks}/${status.totalTasks} (pending: ${status.pendingTasks}, failed: ${status.failedTasks})`);
  const agentCount = status.agents.length;
  const idleAgents = status.agents.filter((a: any) => a.status === 'idle').length;
  const workingAgents = status.agents.filter((a: any) => a.status === 'working' || a.status === 'in_progress').length;
  lines.push(`  Agents: ${agentCount} (idle: ${idleAgents}, working: ${workingAgents})`);
  lines.push(""); // spacer
  return lines;
}

function refreshWidget(ui: any): Promise<void> {
  return new Promise((resolve) => {
    try {
      const registry = TeamRegistry.getInstance();
      const teams = registry.getAll();
      const lines: string[] = [];

      lines.push(...buildHeaderLines(ui.theme));

      if (teams.size === 0) {
        lines.push(ui.theme.fg("muted", "No active teams"));
        ui.setWidget("team", lines);
        resolve();
        return;
      }

      teams.forEach((team: any, teamId: string) => {
        team.getTeamStatus().then((status: any) => {
          lines.push(...buildTeamLines(ui, teamId, status));
          ui.setWidget("team", lines);
          resolve();
        }).catch(() => {
          lines.push(ui.theme.fg("error", `Team ${teamId.slice(-6)}: error fetching status`));
          ui.setWidget("team", lines);
          resolve();
        });
      });
    } catch (e) {
      resolve();
    }
  });
}

function startWidget(ctx: any) {
  currentCtx = ctx;
  const ui = ctx.ui;
  // Initial refresh (fire and forget)
  refreshWidget(ui).catch(() => {});
  // Periodic refresh every 2 seconds
  intervalId = setInterval(() => {
    if (teamWidgetEnabled && currentCtx) {
      refreshWidget(currentCtx.ui).catch(() => {});
    }
  }, 2000);
}

function stopWidget() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (currentCtx) {
    currentCtx.ui.setWidget("team", undefined);
    currentCtx = null;
  }
}

/**
 * Toggle team widget visibility.
 * @returns new enabled state (true = visible)
 */
export function toggleTeamWidget(): boolean {
  teamWidgetEnabled = !teamWidgetEnabled;
  if (teamWidgetEnabled) {
    if (currentCtx) {
      startWidget(currentCtx);
    }
  } else {
    stopWidget();
  }
  return teamWidgetEnabled;
}

/**
 * Get current team widget enabled state.
 */
export function getTeamWidgetEnabled(): boolean {
  return teamWidgetEnabled;
}

export function registerTeamWidget(api: ExtensionAPI): void {
  // Set up widget on session start
  api.on("session_start", async (_event, ctx) => {
    if (teamWidgetEnabled) {
      startWidget(ctx);
    }

    // Clean up on session shutdown
    api.on("session_shutdown", () => {
      stopWidget();
    });
  });
}
