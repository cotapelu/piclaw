#!/usr/bin/env node

/**
 * WebSocket Metrics Tool
 *
 * Fetches metrics from the WebSocket TUI server if available.
 * The server must be running and PI_WEBSOCKET_METRICS_URL environment variable set.
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

function createWebSocketMetricsTool(): ToolDefinition<any, any> {
  return {
    name: "websocket-metrics",
    label: "WebSocket Metrics",
    description: "Get WebSocket TUI server metrics (active connections, errors, PTY count). Requires the server to be running with metrics enabled.",
    parameters: { type: "object", properties: {} },
    async execute(_params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: any) {
      const baseUrl = process.env.PI_WEBSOCKET_METRICS_URL;
      if (!baseUrl) {
        return {
          isError: false,
          content: [{ type: "text", text: "WebSocket TUI server not configured for metrics. Set PI_WEBSOCKET_METRICS_URL environment variable to the server base URL (e.g., http://127.0.0.1:8080)." }],
          details: { error: "No metrics URL" }
        };
      }

      try {
        const cleanUrl = baseUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/metrics`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const data = await res.json() as any;
        const lines = [
          `Active connections: ${data.activeConnections}`,
          `Total connections: ${data.totalConnections}`,
          `Total errors: ${data.totalErrors}`,
          `PTYs spawned: ${data.totalPtySpawned}`,
          `Uptime: ${data.uptimeSeconds.toFixed(2)}s`,
          `Started: ${data.startTime}`
        ];
        return {
          isError: false,
          content: lines.map(l => ({ type: "text", text: l })),
          details: data
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching metrics: ${err instanceof Error ? err.message : String(err)}` }],
          details: { error: String(err) }
        };
      }
    },
    renderResult: (result: any, _options: any, theme: any) => {
      if (result.isError) {
        return new Text(theme.fg("error", result.content[0].text), 0, 0);
      }
      return new Text((result.content as Array<{ text: string }>).map(c => c.text).join("\n"), 0, 0);
    }
  };
}

export function registerWebsocketMetricsTool(api: ExtensionAPI): void {
  api.on("session_start", async () => {
    const tool = createWebSocketMetricsTool();
    api.registerTool(tool);
  });
}
