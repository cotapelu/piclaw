#!/usr/bin/env node
/**
 * Team Status Widget
 *
 * Shows live team overview in the UI widget area.
 * Displays: active teams, task progress, agent statuses.
 * Uses event-driven updates instead of polling for better performance.
 *
 * Toggle with /team command.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { recordRender } from "../utils/widget-performance.js";
import { getTeamManager } from "./team-manager-context.js"; // for direct fallback

// Unique symbol for per-session state attachment
const TEAM_WIDGET_STATE = Symbol('teamWidgetState');

interface TeamWidgetSessionState {
  enabled: boolean;
  ctx: any;
  intervalId: NodeJS.Timeout | null; // polling interval
  lastLines: string[] | null; // memoization cache
}

function getState(ctx: any): TeamWidgetSessionState | undefined {
  return ctx[TEAM_WIDGET_STATE];
}

function ensureState(ctx: any): TeamWidgetSessionState {
  let state = getState(ctx);
  if (!state) {
    state = { enabled: true, ctx: ctx, intervalId: null, lastLines: null };
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

async function refreshWidget(ctx: any): Promise<void> {
  const startTime = performance.now();
  const ui = ctx.ui;
  const state = getState(ctx) || ensureState(ctx);
  const lines: string[] = [];

  lines.push(...buildHeaderLines(ui.theme));

  const isolated = typeof (ctx as any).getAllTeams === 'function';

  if (isolated) {
    try {
      const teamIds = await (ctx as any).getAllTeams();
      if (teamIds.length === 0) {
        lines.push(ui.theme.fg("muted", "No active teams"));
      } else {
        for (const teamId of teamIds) {
          try {
            const status = await (ctx as any).getTeamStatus(teamId);
            lines.push(...buildTeamLines(ui, teamId, status));
          } catch {
            lines.push(ui.theme.fg("error", `Team ${teamId.slice(-6)}: error fetching status`));
          }
        }
      }
    } catch (e) {
      lines.push(ui.theme.fg("error", "Error fetching team data"));
    }
  } else {
    // Direct mode
    try {
      const manager = getTeamManager(ctx);
      const teams = manager.getAll();
      if (teams.size === 0) {
        lines.push(ui.theme.fg("muted", "No active teams"));
      } else {
        const teamEntries = Array.from(teams.entries());
        for (const [teamId, team] of teamEntries) {
          try {
            const status = await team.getTeamStatus();
            lines.push(...buildTeamLines(ui, teamId, status));
          } catch {
            lines.push(ui.theme.fg("error", `Team ${teamId.slice(-6)}: error fetching status`));
          }
        }
      }
    } catch (e) {
      lines.push(ui.theme.fg("error", "Error fetching team data"));
    }
  }

  const cached = state.lastLines !== null && arraysEqual(state.lastLines, lines);
  if (!cached) {
    ui.setWidget("team", lines);
    state.lastLines = lines;
  }
  const elapsed = performance.now() - startTime;
  recordRender("team-widget", elapsed, cached);
}

// Helper: compare arrays for equality
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function startWidget(ctx: any): void {
  const state = ensureState(ctx);
  if (state.intervalId) return;
  state.ctx = ctx;
  state.lastLines = null;

  refreshWidget(ctx).catch(() => {});

  state.intervalId = setInterval(() => {
    if (state.enabled && state.ctx) {
      refreshWidget(state.ctx).catch(() => {});
    }
  }, 5000);
}

function stopWidget(state: TeamWidgetSessionState): void {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  if (state.ctx) {
    try {
      state.ctx.ui.setWidget("team", undefined);
    } catch {}
    state.ctx = null;
  }
  state.lastLines = null;
}

/**
 * Toggle team widget visibility.
 * @returns new enabled state (true = visible)
 */
export function toggleTeamWidget(ctx: any): boolean {
  const state = ensureState(ctx);
  state.enabled = !state.enabled;
  if (state.enabled) {
    // Clear cache to force fresh render when re-enabling
    state.lastLines = null;
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
    // Ensure per-session state exists (default enabled)
    const state = ensureState(ctx);
    state.enabled = true;
    state.ctx = ctx;

    // Start the widget
    startWidget(ctx);

    // Clean up on session shutdown
    api.on("session_shutdown", () => {
      stopWidget(state);
      delete (ctx as any)[TEAM_WIDGET_STATE];
    });
  });

  // The /team command is registered separately by team-command.ts
}

export default registerTeamWidget;
