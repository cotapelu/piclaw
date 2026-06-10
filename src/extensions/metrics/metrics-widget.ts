#!/usr/bin/env node
/**
 * Metrics Dashboard Widget
 *
 * Shows real-time resource usage and session stats.
 * Toggle with /metrics command.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const METRICS_WIDGET_STATE = Symbol('metricsWidgetState');

interface MetricsWidgetSessionState {
  enabled: boolean;
  ctx: ExtensionContext | null;
  intervalId: NodeJS.Timeout | null;
}

function getState(ctx: any): MetricsWidgetSessionState | undefined {
  return ctx[METRICS_WIDGET_STATE];
}

function ensureState(ctx: any): MetricsWidgetSessionState {
  let state = getState(ctx);
  if (!state) {
    state = { enabled: true, ctx: ctx, intervalId: null };
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

function buildMetricsLines(ctx: ExtensionContext, theme: any): string[] {
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

  return lines;
}

async function refreshWidget(ctx: ExtensionContext): Promise<void> {
  const ui = ctx.ui;
  const lines: string[] = [];

  lines.push(...buildHeaderLines(ui.theme));
  lines.push(...buildMetricsLines(ctx, ui.theme));

  ui.setWidget("metrics", lines);
}

function startWidget(ctx: ExtensionContext): void {
  const state = ensureState(ctx);
  if (state.intervalId) return;
  state.ctx = ctx;

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
}

/**
 * Toggle metrics widget visibility.
 */
export function toggleMetricsWidget(ctx: any): boolean {
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
 * Get enabled state for current session.
 */
export function getMetricsWidgetEnabled(ctx: any): boolean {
  const state = getState(ctx);
  return state?.enabled ?? true;
}

export function registerMetricsWidget(api: ExtensionAPI): void {
  api.on("session_start", async (_event, ctx: any) => {
    // Create per-session state, default enabled
    const state: MetricsWidgetSessionState = { enabled: true, ctx: ctx, intervalId: null };
    (ctx as any)[METRICS_WIDGET_STATE] = state;
    startWidget(ctx);

    api.on("session_shutdown", () => {
      stopWidget(state);
      delete (ctx as any)[METRICS_WIDGET_STATE];
    });
  });
}
