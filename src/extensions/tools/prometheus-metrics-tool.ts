#!/usr/bin/env node

/**
 * Prometheus Metrics Tool
 *
 * Exports team metrics in Prometheus text format for monitoring.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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
        const data = await readFile(metricsFile, "utf-8");
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
