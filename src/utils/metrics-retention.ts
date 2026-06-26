#!/usr/bin/env node
/**
 * Metrics Retention Utility
 *
 * Provides cleanup of old metrics files to prevent disk bloat.
 */

import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createLogger } from "./logger.js";

const logger = createLogger("MetricsRetention");

/**
 * Clean up old metrics files in the given directory.
 *
 * Files matching the pattern `metrics-YYYY-MM-DD.json` older than `retentionDays`
 * will be deleted. Deletion errors are logged but do not throw.
 *
 * @param metricsDir - Directory containing metrics files (e.g., .piclaw)
 * @param retentionDays - Number of days to retain files (default 30). Must be >= 1.
 */
export async function cleanupOldMetrics(metricsDir: string, retentionDays: number): Promise<void> {
  if (retentionDays <= 0) {
    // Non-positive retention means infinite retention (no cleanup)
    return;
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  try {
    const entries = await readdir(metricsDir, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      if (!/^metrics-\d{4}-\d{2}-\d{2}\.json$/.test(name)) {
        continue;
      }
      const filePath = join(metricsDir, name);
      try {
        const fileStat = await stat(filePath);
        if (fileStat.mtimeMs < cutoff) {
          await unlink(filePath);
          logger.info(`Cleaned up old metrics file: ${filePath}`);
        }
      } catch (err) {
        logger.warn(`Failed to process metrics file ${filePath}:`, err);
      }
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      logger.warn(`Failed to list metrics directory ${metricsDir}:`, err);
    }
    // ENOENT is fine (directory doesn't exist); just ignore.
  }
}
