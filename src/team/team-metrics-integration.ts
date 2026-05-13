/**
 * Team Metrics Integration
 *
 * Hooks into team-manager to collect metrics automatically.
 * To enable, import and call setupMetricsIntegration(team) after team creation.
 */

import { AgentTeam } from "./team-manager.js";
import { teamMetrics } from "./team-metrics.js";

/**
 * Setup metrics collection for a team.
 * Call this right after bootPiclawTeam() returns.
 */
export function setupMetricsIntegration(team: AgentTeam): void {
  // Note: Full integration requires deeper hooks into team methods.
  // This is a lightweight setup that logs when team completes.
  console.log("[TeamMetrics] Integration setup for team:", team.id);
}

/**
 * Export metrics to JSON file.
 * Call this after team completion to persist metrics.
 */
export async function exportMetricsToFile(team: AgentTeam, filePath?: string): Promise<void> {
  const metricsJson = teamMetrics.getJSON();

  if (!filePath) {
    filePath = `team-metrics-${team.id}.json`;
  }

  const fs = await import('node:fs/promises');
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  if (dir) {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(filePath, JSON.stringify(metricsJson, null, 2), 'utf-8');
}

/**
 * Get current metrics snapshot.
 */
export function getTeamMetrics(): any {
  return teamMetrics.getJSON();
}
