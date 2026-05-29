#!/usr/bin/env node
import { logger } from "./logger.js";

/**
 * Helper functions for main.ts (extracted for testability)
 */

import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "node:path";
import type { PiclawConfig } from "../config/config-manager.js";

/**
 * Ensure piclaw extension is registered in global settings.
 * This allows custom slash commands without manual user config.
 */
export async function ensurePiclawExtensionRegistered(agentDir: string, extensionPath: string): Promise<void> {
  const globalSettingsPath = join(agentDir, "settings.json");

  // Ensure the agent directory exists
  const agentDirPath = dirname(globalSettingsPath);
  if (!existsSync(agentDirPath)) {
    mkdirSync(agentDirPath, { recursive: true });
  }

  // Read existing settings or use empty object
  let globalSettings: Record<string, unknown> = {};
  if (existsSync(globalSettingsPath)) {
    try {
      globalSettings = JSON.parse(readFileSync(globalSettingsPath, "utf-8"));
    } catch (err) {
      logger.warn(chalk.yellow(`Failed to parse global settings, creating new.`));
    }
  }

  // Ensure extensions array
  if (!Array.isArray(globalSettings.extensions)) {
    globalSettings.extensions = [extensionPath];
  } else if (!globalSettings.extensions.includes(extensionPath)) {
    globalSettings.extensions.push(extensionPath);
  } else {
    return; // already registered
  }

  // Write back
  try {
    writeFileSync(globalSettingsPath, JSON.stringify(globalSettings, null, 2), "utf-8");
  } catch (err) {
    logger.warn(chalk.yellow(`Failed to write global settings: ${err}`));
  }
}

/**
 * Validate required API keys for configured providers.
 * Checks environment variables and warns user if missing.
 */
export function validateApiKeys(config: PiclawConfig): void {
  const warnings: string[] = [];

  // Check model provider API keys if model is specified
  if (config.model) {
    const [provider] = config.model.split(":");
    switch (provider) {
      case "kilo":
        if (!process.env.KILO_API_KEY) {
          warnings.push(
            "KILO_API_KEY environment variable is not set. " +
            "Set it with: export KILO_API_KEY=your_api_key"
          );
        }
        break;
      case "anthropic":
        if (!process.env.ANTHROPIC_API_KEY) {
          warnings.push(
            "ANTHROPIC_API_KEY environment variable is not set. " +
            "Set it with: export ANTHROPIC_API_KEY=your_api_key"
          );
        }
        break;
      case "openai":
        if (!process.env.OPENAI_API_KEY) {
          warnings.push(
            "OPENAI_API_KEY environment variable is not set. " +
            "Set it with: export OPENAI_API_KEY=your_api_key"
          );
        }
        break;
    }
  }

  // Display warnings
  if (warnings.length > 0) {
    logger.log(chalk.yellow("\n⚠️  API Key Warnings:"));
    for (const warning of warnings) {
      logger.log(chalk.yellow(`  - ${warning}`));
    }
    logger.log("");
  }
}
