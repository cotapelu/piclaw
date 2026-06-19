#!/usr/bin/env node
/**
 * Widget Performance Tracker
 *
 * Tracks render counts, cache hits, and timing for TUI widgets.
 * Used by metrics-widget to display optimization stats.
 */

interface WidgetMetrics {
  renderCount: number;
  cacheHits: number;
  lastRenderMs: number;
  totalRenderTimeMs: number;
}

const metricsMap: Map<string, WidgetMetrics> = new Map();

export function recordRender(widgetName: string, tookMs: number, cached: boolean): void {
  let metrics = metricsMap.get(widgetName);
  if (!metrics) {
    metrics = {
      renderCount: 0,
      cacheHits: 0,
      lastRenderMs: 0,
      totalRenderTimeMs: 0,
    };
    metricsMap.set(widgetName, metrics);
  }
  metrics.renderCount++;
  if (cached) metrics.cacheHits++;
  metrics.lastRenderMs = tookMs;
  metrics.totalRenderTimeMs += tookMs;
}

export function getWidgetMetrics(widgetName: string): WidgetMetrics | undefined {
  return metricsMap.get(widgetName);
}

export function getAllWidgetMetrics(): Map<string, WidgetMetrics> {
  return new Map(metricsMap);
}

export function resetWidgetMetrics(): void {
  metricsMap.clear();
}
