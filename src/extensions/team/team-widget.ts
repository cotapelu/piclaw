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
import { TeamRegistry } from "./team-manager.js";
import { recordRender } from "../utils/widget-performance.js";

// Unique symbol for per-session state attachment
const TEAM_WIDGET_STATE = Symbol('teamWidgetState');

interface TeamWidgetSessionState {
  enabled: boolean;
  ctx: any;
  discoveryIntervalId: NodeJS.Timeout | null; // polls for new teams
  lastLines: string[] | null; // memoization cache
  attachedTeamIds: Set<string>; // teams we're subscribed to
  renderScheduled: boolean; // debounce flag
}

function getState(ctx: any): TeamWidgetSessionState | undefined {
  return ctx[TEAM_WIDGET_STATE];
}

function ensureState(ctx: any): TeamWidgetSessionState {
  let state = getState(ctx);
  if (!state) {
    state = {
      enabled: true,
      ctx: ctx,
      discoveryIntervalId: null,
      lastLines: null,
      attachedTeamIds: new Set(),
      renderScheduled: false,
    };
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
  const state = ensureState(ctx);
  const lines: string[] = [];

  lines.push(...buildHeaderLines(ui.theme));

  try {
    const registry = TeamRegistry.getInstance();
    const teams = registry.getAll();

    if (teams.size === 0) {
      lines.push(ui.theme.fg("muted", "No active teams"));
      // Memoization: only update if changed
      const cached = state.lastLines !== null && arraysEqual(state.lastLines, lines);
      if (!cached) {
        ui.setWidget("team", lines);
        state.lastLines = lines;
      }
      const elapsed = performance.now() - startTime;
      recordRender("team-widget", elapsed, cached);
      return;
    }

    // Collect status for all teams (sequential to preserve order)
    const teamEntries = Array.from(teams.entries());
    for (const [teamId, team] of teamEntries) {
      try {
        const status = await team.getTeamStatus();
        lines.push(...buildTeamLines(ui, teamId, status));
      } catch {
        lines.push(ui.theme.fg("error", `Team ${teamId.slice(-6)}: error fetching status`));
      }
    }

    // Memoization: only update if changed
    const cached = state.lastLines !== null && arraysEqual(state.lastLines, lines);
    if (!cached) {
      ui.setWidget("team", lines);
      state.lastLines = lines;
    }
    const elapsed = performance.now() - startTime;
    recordRender("team-widget", elapsed, cached);
  } catch (e) {
    const elapsed = performance.now() - startTime;
    recordRender("team-widget", elapsed, false);
    // Ignore errors
  }
}

// Debounced render scheduling to avoid flooding
function scheduleRender(ctx: any): void {
  const state = getState(ctx);
  if (!state || !state.enabled) return;
  if (state.renderScheduled) return;
  state.renderScheduled = true;
  refreshWidget(ctx).catch(() => {}).finally(() => {
    state.renderScheduled = false;
  });
}

// Attach to a single team's updates
function attachTeam(team: any, ctx: any): void {
  team.setOnUpdate(() => scheduleRender(ctx));
}

// Discover and attach to all current teams
function attachToAllTeams(ctx: any): void {
  try {
    const registry = TeamRegistry.getInstance();
    const teams = registry.getAll();
    const currentIds = new Set(teams.keys());
    const state = getState(ctx);
    if (!state) return;

    // Detach from teams no longer in registry (cleanup)
    for (const teamId of state.attachedTeamIds) {
      if (!currentIds.has(teamId)) {
        state.attachedTeamIds.delete(teamId);
      }
    }

    // Attach to new teams
    for (const [teamId, team] of teams) {
      if (!state.attachedTeamIds.has(teamId)) {
        attachTeam(team, ctx);
        state.attachedTeamIds.add(teamId);
      }
    }
  } catch {
    // ignore
  }
}

// Helper: compare arrays for equality
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function startWidget(ctx: any) {
  const state = ensureState(ctx);
  // Prevent double start
  if (state.discoveryIntervalId) return;
  state.ctx = ctx;
  state.lastLines = null;
  state.attachedTeamIds = new Set();
  state.renderScheduled = false;

  // Attach to existing teams and kick off initial render
  attachToAllTeams(ctx);
  refreshWidget(ctx).catch(() => {});

  // Periodically discover new teams (e.g., teams created after widget started)
  state.discoveryIntervalId = setInterval(() => {
    if (state.enabled && state.ctx) {
      attachToAllTeams(state.ctx);
    }
  }, 5000);
}

function stopWidget(state: TeamWidgetSessionState) {
  if (state.discoveryIntervalId) {
    clearInterval(state.discoveryIntervalId);
    state.discoveryIntervalId = null;
  }
  if (state.ctx) {
    try {
      state.ctx.ui.setWidget("team", undefined);
    } catch {
      // ignore if UI gone
    }
    state.ctx = null; // break reference
  }
  // Detach from all teams
  try {
    const registry = TeamRegistry.getInstance();
    const teams = registry.getAll();
    for (const teamId of state.attachedTeamIds) {
      const team = teams.get(teamId);
      if (team) {
        team.setOnUpdate(undefined); // clear handler
      }
    }
  } catch {}
  state.attachedTeamIds.clear();
  state.lastLines = null;
  state.renderScheduled = false;
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
    // Create per-session state (default enabled)
    const state: TeamWidgetSessionState = {
      enabled: true,
      ctx: ctx,
      discoveryIntervalId: null,
      lastLines: null,
      attachedTeamIds: new Set(),
      renderScheduled: false,
    };
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
