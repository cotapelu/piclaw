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

// Unique symbol for per-session state attachment
const TEAM_WIDGET_STATE = Symbol('teamWidgetState');

interface TeamWidgetSessionState {
  enabled: boolean;
  ctx: any;
  intervalId: NodeJS.Timeout | null;
}

function getState(ctx: any): TeamWidgetSessionState | undefined {
  return ctx[TEAM_WIDGET_STATE];
}

function ensureState(ctx: any): TeamWidgetSessionState {
  let state = getState(ctx);
  if (!state) {
    state = { enabled: true, ctx: ctx, intervalId: null };
    (ctx as any)[TEAM_WIDGET_STATE] = state;
  }
  return state;
}

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

      // Collect promises for all teams
      let pending = teams.size;
      teams.forEach((team: any, teamId: string) => {
        team.getTeamStatus().then((status: any) => {
          lines.push(...buildTeamLines(ui, teamId, status));
          // Only set widget after all teams processed
          if (--pending === 0) {
            ui.setWidget("team", lines);
            resolve();
          }
        }).catch(() => {
          lines.push(ui.theme.fg("error", `Team ${teamId.slice(-6)}: error fetching status`));
          if (--pending === 0) {
            ui.setWidget("team", lines);
            resolve();
          }
        });
      });
    } catch (e) {
      resolve();
    }
  });
}

function startWidget(ctx: any) {
  const state = ensureState(ctx);
  // Prevent double start
  if (state.intervalId) return;
  state.ctx = ctx;
  const ui = ctx.ui;
  // Initial refresh
  refreshWidget(ui).catch(() => {});
  // Periodic refresh every 2 seconds
  state.intervalId = setInterval(() => {
    if (state.enabled && state.ctx) {
      refreshWidget(state.ctx.ui).catch(() => {});
    }
  }, 2000);
}

function stopWidget(state: TeamWidgetSessionState) {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  if (state.ctx) {
    try {
      state.ctx.ui.setWidget("team", undefined);
    } catch {
      // ignore if UI gone
    }
    state.ctx = null; // break reference
  }
}

/**
 * Toggle team widget visibility.
 * @returns new enabled state (true = visible)
 */
export function toggleTeamWidget(ctx: any): boolean {
  const state = ensureState(ctx);
  state.enabled = !state.enabled;
  if (state.enabled) {
    startWidget(ctx);
  } else {
    stopWidget(state);
  }
  return state.enabled;
}

/**
 * Get current team widget enabled state for a given session context.
 */
export function getTeamWidgetEnabled(ctx: any): boolean {
  const state = getState(ctx);
  return state?.enabled ?? true;
}

export function registerTeamWidget(api: ExtensionAPI): void {
  // Set up widget on session start
  api.on("session_start", async (_event, ctx) => {
    // Create per-session state (default enabled)
    const state: TeamWidgetSessionState = { enabled: true, ctx: ctx, intervalId: null };
    (ctx as any)[TEAM_WIDGET_STATE] = state;

    // If enabled by default, start the widget
    if (state.enabled) {
      startWidget(ctx);
    }

    // Clean up on session shutdown
    api.on("session_shutdown", () => {
      stopWidget(state);
      // Remove reference from ctx
      delete (ctx as any)[TEAM_WIDGET_STATE];
    });
  });

  // Also register the /team command through the command system? Actually team-command.ts registers separately.
  // This function only registers the widget component and toggle logic.
}
