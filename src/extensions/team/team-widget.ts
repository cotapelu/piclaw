#!/usr/bin/env node
/**
 * Team Status Widget
 *
 * Shows live team overview in the UI widget area.
 * Displays: active teams, task progress, agent statuses.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TeamRegistry } from "./team-manager.js";

export function registerTeamWidget(api: ExtensionAPI): void {
  // Set up widget on session start
  api.on("session_start", async (_event, ctx) => {
    const ui = ctx.ui;
    let intervalId: ReturnType<typeof setInterval>;

    async function refreshWidget() {
      try {
        const registry = TeamRegistry.getInstance();
        const teams = registry.getAll();
        const lines: string[] = [];

        lines.push(ui.theme.fg("accent", "👥 Team").bold());
        lines.push(""); // spacer

        if (teams.size === 0) {
          lines.push(ui.theme.fg("muted", "No active teams"));
          ui.setWidget("team", lines);
          return;
        }

        // Iterate each active team
        teams.forEach((team, teamId) => {
          const shortId = teamId.slice(-6);
          // Get status asynchronously
          const statusPromise = team.getTeamStatus();
          // We'll handle promise separately to avoid unhandled rejections
          statusPromise.then(status => {
            lines.push(ui.theme.fg("accent", `Team ${shortId}`));
            lines.push(`  Tasks: ${status.completedTasks}/${status.totalTasks} (pending: ${status.pendingTasks}, failed: ${status.failedTasks})`);
            const agentCount = status.agents.length;
            const idleAgents = status.agents.filter(a => a.status === 'idle').length;
            const workingAgents = status.agents.filter(a => a.status === 'working' || a.status === 'in_progress').length;
            lines.push(`  Agents: ${agentCount} (idle: ${idleAgents}, working: ${workingAgents})`);
            lines.push(""); // spacer between teams
            ui.setWidget("team", lines);
          }).catch(() => {
            lines.push(ui.theme.fg("error", `Team ${shortId}: error fetching status`));
            ui.setWidget("team", lines);
          });
        });

        // If no teams (should not happen as we checked), but for safety
        if (teams.size === 0) {
          ui.setWidget("team", lines);
        }
      } catch (e) {
        // Silently ignore refresh errors
      }
    }

    // Initial refresh
    await refreshWidget();

    // Periodic refresh every 2 seconds
    intervalId = setInterval(() => {
      refreshWidget().catch(() => {});
    }, 2000);

    // Clean up on session shutdown
    api.on("session_shutdown", () => {
      clearInterval(intervalId);
    });
  });
}
