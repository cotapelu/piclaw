#!/usr/bin/env node

/**
 * Prometheus Metrics Tool
 *
 * Exports team metrics and plugin worker metrics in Prometheus text format for monitoring.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PluginManager } from "../plugins/plugin-manager.js";

export function createPrometheusMetricsTool(cwd: string): any {
  return {
    name: "prometheus_metrics",
    label: "Prometheus Metrics",
    description: "Export team metrics in Prometheus text format for monitoring.",
    promptSnippet: "prometheus_metrics()",
    parameters: {},

    async execute(
      toolCallId: string,
      _params: any,
      signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: any
    ) {
      const metricsFile = join(process.cwd(), ".piclaw", "metrics.json");
      try {
        let data;
      try {
        data = await readFile(metricsFile, "utf-8");
      } catch (initErr) {
        // Fallback: find the latest daily metrics file
        const metricsDir = join(process.cwd(), ".piclaw");
        try {
          const files = await readdir(metricsDir);
          const metricFiles = files.filter(f => f.startsWith("metrics-") && f.endsWith(".json"));
          if (metricFiles.length > 0) {
            metricFiles.sort();
            const latest = metricFiles[metricFiles.length - 1];
            const latestPath = join(metricsDir, latest);
            data = await readFile(latestPath, "utf-8");
          } else {
            throw new Error("No metrics files found");
          }
        } catch (listErr) {
          throw new Error(`Failed to read metrics: ${initErr instanceof Error ? initErr.message : 'unknown'}`);
        }
      }
      let entries: any[] = JSON.parse(data);
      if (!Array.isArray(entries)) entries = [entries];

        let output = "";
        for (const m of entries) {
          const teamId = m.teamId || "unknown";

          const add = (
            name: string,
            value: number,
            type: "gauge" | "counter" | "histogram" = "gauge",
            help?: string
          ) => {
            if (help) output += `# HELP ${name} ${help}\n`;
            output += `# TYPE ${name} ${type}\n`;
            output += `${name}{team_id="${teamId}"} ${value}\n`;
          };

          add("piclaw_team_total_tasks", m.totalTasks, "gauge", "Total number of tasks assigned to the team");
          add("piclaw_team_completed_tasks", m.completedTasks, "gauge", "Number of completed tasks");
          add("piclaw_team_failed_tasks", m.failedTasks, "gauge", "Number of failed tasks");
          add("piclaw_team_pending_tasks", m.pendingTasks, "gauge", "Number of pending tasks");

          if (m.avgTaskDurationMs != null) {
            add("piclaw_team_avg_task_duration_ms", m.avgTaskDurationMs, "gauge", "Average task duration in milliseconds");
          }

          if (m.teamRuntimeMs != null) {
            add("piclaw_team_runtime_seconds", m.teamRuntimeMs / 1000, "counter", "Team total runtime in seconds");
          }

          // Include agent counts as separate labels? For simplicity, output one metric per agent count entry? Could be many; skip for now.
        }

        // Plugin worker metrics (if any) — appended after all team entries
        try {
          const pluginManager = PluginManager.getInstance();
          const pluginMetrics = pluginManager.getWorkersMetrics();
          for (const [name, m] of Object.entries(pluginMetrics)) {
            const safeName = name.replace(/\"/g, '\\\"');
            output += `# HELP piclaw_plugin_worker_requests Total requests sent to plugin worker ${name}\n`;
            output += `# TYPE piclaw_plugin_worker_requests gauge\n`;
            output += `piclaw_plugin_worker_requests{worker="${safeName}"} ${m.requests}\n`;
            output += `# HELP piclaw_plugin_worker_responses Total responses received from plugin worker ${name}\n`;
            output += `# TYPE piclaw_plugin_worker_responses gauge\n`;
            output += `piclaw_plugin_worker_responses{worker="${safeName}"} ${m.responses}\n`;
            output += `# HELP piclaw_plugin_worker_errors Total errors from plugin worker ${name}\n`;
            output += `# TYPE piclaw_plugin_worker_errors gauge\n`;
            output += `piclaw_plugin_worker_errors{worker="${safeName}"} ${m.errors}\n`;
            output += `# HELP piclaw_plugin_worker_avg_latency_ms Average RPC latency for plugin worker ${name}\n`;
            output += `# TYPE piclaw_plugin_worker_avg_latency_ms gauge\n`;
            output += `piclaw_plugin_worker_avg_latency_ms{worker="${safeName}"} ${m.avgLatency}\n`;
            const statusVal = m.status === 'alive' ? 1 : 0;
            output += `# HELP piclaw_plugin_worker_up Plugin worker ${name} up (1) or down/crashed (0)\n`;
            output += `# TYPE piclaw_plugin_worker_up gauge\n`;
            output += `piclaw_plugin_worker_up{worker="${safeName}"} ${statusVal}\n`;
          }
        } catch (e) {
          // ignore if PluginManager not available
        }

        return { content: [{ type: "text", text: output }], isError: false };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `❌ Error reading Prometheus metrics: ${err.message}` }],
          isError: true,
          details: { error: err.message },
        };
      }
    },
  };
}

export function registerPrometheusMetricsTool(api: ExtensionAPI): void {
  const tool = createPrometheusMetricsTool(process.cwd());
  api.registerTool(tool);
}
