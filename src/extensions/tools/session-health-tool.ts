#!/usr/bin/env node

/**
 * Session Health Tool
 *
 * Scans Piclaw's persistent data files for corruption and attempts auto-repair.
 * Run periodically or on demand to maintain data integrity.
 */

import { readdir, readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "../../config/config-manager.js";
import { logger } from "../../utils/logger.js";

interface HealthReport {
  checked: number;
  healthy: number;
  corrupted: number;
  repaired: number;
  errors: string[];
}

function getDefaultContent(filename: string): string | null {
  switch (filename) {
    case "todos.json":
      return JSON.stringify({ version: 1, phases: [], nextTaskId: 1, nextPhaseId: 1 }, null, 2);
    case "settings.json":
      return JSON.stringify({}, null, 2);
    case "metrics.json":
      // metrics.json may contain an array of entries; empty array
      return JSON.stringify([], null, 2);
    default:
      return null; // unknown file, skip repair
  }
}

export function createSessionHealthTool(cwd: string): any {
  const baseBashTool: any = createBashTool(cwd, {});

  return {
    name: "session_health",
    label: "Session Health Check",
    description: "Check and repair corrupted Piclaw session files in ~/.piclaw/agent.",
    promptSnippet: "session_health()",
    parameters: {},

    async execute(
      toolCallId: string,
      _params: any,
      signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: any
    ) {
      const agentDir = getAgentDir();
      let report: HealthReport = {
        checked: 0,
        healthy: 0,
        corrupted: 0,
        repaired: 0,
        errors: [],
      };

      try {
        const files = await readdir(agentDir);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          report.checked++;
          const filePath = join(agentDir, file);
          try {
            const content = await readFile(filePath, "utf-8");
            JSON.parse(content); // validate
            report.healthy++;
          } catch (e: any) {
            report.corrupted++;
            const backupPath = filePath + `.corrupted.${Date.now()}`;
            try {
              await rename(filePath, backupPath); // backup
              const defaultContent = getDefaultContent(file);
              if (defaultContent) {
                await writeFile(filePath, defaultContent);
                report.repaired++;
                logger.info(`Repaired corrupted file: ${file} (backed up as ${backupPath})`);
              } else {
                report.errors.push(`Cannot repair unknown file type: ${file}`);
                logger.warn(`Cannot repair unknown file type: ${file}, backed up only`);
              }
            } catch (backupErr: any) {
              report.errors.push(`Failed to repair ${file}: ${backupErr.message}`);
              logger.error(`Failed to repair ${file}:`, backupErr);
            }
          }
        }
      } catch (err: any) {
        report.errors.push(`Error scanning agent directory: ${err.message}`);
        logger.error("Session health check failed:", err);
      }

      const output = `📊 Session Health Report\n` +
        `Checked: ${report.checked} files\n` +
        `Healthy: ${report.healthy}\n` +
        `Corrupted: ${report.corrupted}\n` +
        `Repaired: ${report.repaired}\n` +
        (report.errors.length ? `Errors:\n${report.errors.map(e => `  - ${e}`).join('\n')}` : '');

      return { content: [{ type: "text", text: output }], isError: false };
    },
  };
}

export function registerSessionHealthTool(api: ExtensionAPI): void {
  const tool = createSessionHealthTool(process.cwd());
  api.registerTool(tool);
}
