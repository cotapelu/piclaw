#!/usr/bin/env node
/**
 * Metrics Dashboard Widget
 *
 * Shows real-time resource usage and session stats.
 * Toggle with /metrics command.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { recordRender, getWidgetMetrics } from "../utils/widget-performance.js";

const METRICS_WIDGET_STATE = Symbol('metricsWidgetState');

interface MetricsWidgetSessionState {
  enabled: boolean;
  ctx: ExtensionContext | null;
  intervalId: NodeJS.Timeout | null;
  lastLines: string[] | null; // memoization cache
}

function getState(ctx: any): MetricsWidgetSessionState | undefined {
  return ctx[METRICS_WIDGET_STATE];
}

function ensureState(ctx: any): MetricsWidgetSessionState {
  let state = getState(ctx);
  if (!state) {
    state = { enabled: true, ctx: ctx as ExtensionContext, intervalId: null, lastLines: null };
    (ctx as any)[METRICS_WIDGET_STATE] = state;
  }
  return state;
}

function buildHeaderLines(theme: any): string[] {
  return [
    theme.fg("accent", "📊 Metrics").bold(),
    ""
  ];
}

async function getLatestTeamMetrics(): Promise<any | null> {
  try {
    const metricsPath = join(process.cwd(), ".piclaw", "metrics.json");
    const data = await readFile(metricsPath, "utf-8");
    const entries = JSON.parse(data);
    if (!Array.isArray(entries) || entries.length === 0) return null;
    return entries[entries.length - 1]; // latest
  } catch {
    return null;
  }
}

async function buildMetricsLines(ctx: ExtensionContext, theme: any, teamMetrics: any | null): Promise<string[]> {
  const lines: string[] = [];

  // Context usage (tokens)
  const usage = ctx.getContextUsage();
  if (usage && usage.tokens !== null) {
    lines.push(`${theme.fg("muted", "Tokens:")} ${usage.tokens} / ${usage.contextWindow} (${usage.percent?.toFixed(1) ?? '?'}%)`);
  } else {
    lines.push(theme.fg("muted", "No token usage data"));
  }

  // Model info
  if (ctx.model) {
    lines.push(`${theme.fg("muted", "Model:")} ${ctx.model.id}`);
  }

  // Abort status
  if (ctx.signal) {
    lines.push(theme.fg("warning", "Operation abortable"));
  }

  // Agent idle status
  const idle = ctx.isIdle();
  lines.push(`${theme.fg("muted", "Status:")} ${idle ? theme.fg("green", "idle") : theme.fg("yellow", "working")}`);

  // Separator
  lines.push("");

  // Performance section
  lines.push(theme.fg("accent", "⚡ Performance").bold());
  const mem = process.memoryUsage();
  const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hrs = Math.floor((uptime % 86400) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const secs = Math.floor(uptime % 60);
  const uptimeStr = days > 0 ? `${days}d ${hrs}h ${mins}m ${secs}s` : `${hrs}h ${mins}m ${secs}s`;
  lines.push(`${theme.fg("muted", "Uptime:")} ${uptimeStr}`);
  lines.push(`${theme.fg("muted", "Memory:")} RSS ${rssMB} MB, Heap ${heapMB} MB`);

  // Widget performance stats (from memoization)
  const teamMetricsPerf = getWidgetMetrics("team-widget");
  const metricsPerf = getWidgetMetrics("metrics-widget");
  if (teamMetricsPerf || metricsPerf) {
    lines.push("");
    lines.push(theme.fg("accent", "📈 Widget Rendering").bold());
    if (teamMetricsPerf) {
      const hitRate = ((teamMetricsPerf.cacheHits / teamMetricsPerf.renderCount) * 100).toFixed(1);
      const avg = teamMetricsPerf.renderCount > 0 ? (teamMetricsPerf.totalRenderTimeMs / teamMetricsPerf.renderCount).toFixed(2) : "0";
      lines.push(`${theme.fg("muted", "Team widget:")} ${teamMetricsPerf.renderCount} renders, ${theme.fg(teamMetricsPerf.cacheHits > 0 ? "green" : "muted", hitRate + "% cache")}, avg ${avg} ms`);
    }
    if (metricsPerf) {
      const hitRate = ((metricsPerf.cacheHits / metricsPerf.renderCount) * 100).toFixed(1);
      const avg = metricsPerf.renderCount > 0 ? (metricsPerf.totalRenderTimeMs / metricsPerf.renderCount).toFixed(2) : "0";
      lines.push(`${theme.fg("muted", "Metrics widget:")} ${metricsPerf.renderCount} renders, ${theme.fg(metricsPerf.cacheHits > 0 ? "green" : "muted", hitRate + "% cache")}, avg ${avg} ms`);
    }
  }

  // Team metrics (if available)
  if (teamMetrics) {
    lines.push("");
    lines.push(theme.fg("accent", "👥 Team").bold());
    lines.push(`${theme.fg("muted", "Total tasks:")} ${teamMetrics.totalTasks ?? 0}`);
    lines.push(`${theme.fg("muted", "Completed:")} ${teamMetrics.completedTasks ?? 0}`);
    lines.push(`${theme.fg("muted", "Failed:")} ${teamMetrics.failedTasks ?? 0}`);
    if (teamMetrics.avgTaskDurationMs != null) {
      lines.push(`${theme.fg("muted", "Avg task:")} ${teamMetrics.avgTaskDurationMs} ms`);
    }
  }

  // Plugin worker metrics (if isolation enabled)
  try {
    const ctxAny = ctx as any;
    if (typeof ctxAny.getPluginMetrics === 'function') {
      const pluginMetrics = await ctxAny.getPluginMetrics();
      const workers = Object.entries(pluginMetrics) as [string, any][];
      if (workers.length > 0) {
        lines.push('');
        lines.push(theme.fg('accent', '🧩 Plugin Workers').bold());
        for (const [name, m] of workers) {
          const status = m.status === 'alive' ? theme.fg('green', 'alive') : theme.fg('error', m.status);
          lines.push(`${theme.fg('muted', name)}: ${status}, ${m.requests} req, ${m.responses} resp, ${m.errors} err`);
          if (m.lastError) {
            lines.push(`  ${theme.fg('dim', 'Last error: ' + m.lastError)}`);
          }
        }
      }
    }
  } catch (e) {
    // ignore if PluginManager not available
  }

  return lines;
}

async function refreshWidget(ctx: ExtensionContext): Promise<void> {
  const startTime = performance.now();
  const ui = ctx.ui;
  const state = getState(ctx) || ensureState(ctx);
  const lines: string[] = [];

  lines.push(...buildHeaderLines(ui.theme));

  // Fetch latest team metrics in the background
  const teamMetrics = await getLatestTeamMetrics();
  const metricsLines = await buildMetricsLines(ctx, ui.theme, teamMetrics);
  lines.push(...metricsLines);

  // Memoization: only update if changed
  const cached = state.lastLines !== null && arraysEqual(state.lastLines, lines);
  if (!cached) {
    ui.setWidget("metrics", lines);
    state.lastLines = lines;
  }
  const elapsed = performance.now() - startTime;
  recordRender("metrics-widget", elapsed, cached);
}

// Helper: compare arrays for equality
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function startWidget(ctx: ExtensionContext): void {
  const state = ensureState(ctx);
  if (state.intervalId) return;
  state.ctx = ctx;
  state.lastLines = null; // reset cache

  refreshWidget(ctx).catch(() => {});

  state.intervalId = setInterval(() => {
    if (state.enabled && state.ctx) {
      refreshWidget(state.ctx).catch(() => {});
    }
  }, 5000);
}

function stopWidget(state: MetricsWidgetSessionState): void {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  if (state.ctx) {
    try {
      state.ctx.ui.setWidget("metrics", undefined);
    } catch {}
    state.ctx = null;
  }
  state.lastLines = null; // clear cache
}

/**
 * Toggle metrics widget visibility.
 */
export function toggleMetricsWidget(ctx: any): boolean {
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
 * Get enabled state for current session.
 */
export function getMetricsWidgetEnabled(ctx: any): boolean {
  const state = getState(ctx);
  return state?.enabled ?? true;
}

export function registerMetricsWidget(api: ExtensionAPI): void {
  api.on("session_start", async (_event, ctx: any) => {
    // Create per-session state, default enabled
    const state: MetricsWidgetSessionState = { enabled: true, ctx: ctx, intervalId: null, lastLines: null };
    (ctx as any)[METRICS_WIDGET_STATE] = state;
    startWidget(ctx);

    api.on("session_shutdown", () => {
      stopWidget(state);
      delete (ctx as any)[METRICS_WIDGET_STATE];
    });
  });
}

export default registerMetricsWidget;
