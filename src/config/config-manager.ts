#!/usr/bin/env node
import { logger } from "../utils/logger.js";

/**
 * Piclaw Configuration Manager
 * Handles persistent user configuration (~/.piclaw/config.json)
 * And essential path helpers.
 */

import { existsSync, mkdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "fs";

// ============================================================================
// Constants
// ============================================================================

export const CONFIG_DIR_NAME = ".piclaw";

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the agent config directory (~/.piclaw/agent)
 */
export function getAgentDir(): string {
	const envDir = process.env.PICLAW_AGENT_DIR;
	if (envDir) {
		if (envDir === "~") return homedir();
		if (envDir.startsWith("~/") || envDir.startsWith("~\\")) return join(homedir(), envDir.slice(2));
		return envDir;
	}
	return join(homedir(), CONFIG_DIR_NAME, "agent");
}

/**
 * Get path to managed binaries directory
 */
export function getBinDir(): string {
	return join(getAgentDir(), "bin");
}


export interface PiclawConfig {
	/** Default model to use (e.g., "anthropic:claude-opus-4-5") */
	model?: string;
	/** Default thinking level */
	thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	/** Default tool allowlist. If not set, all tools are available. */
	tools?: string[];
	/** Custom session directory */
	sessionDir?: string;
	/** Whether to show verbose logs */
	verbose?: boolean;
	/** Custom keybindings: map command name (e.g., "team", "settings") to key string (e.g., "t", "ctrl+s") */
	keybindings?: Record<string, string>;
}

function getConfigDir(): string {
  return join(homedir(), CONFIG_DIR_NAME);
}

function getConfigFilePath(): string {
  return join(getConfigDir(), "config.json");
}

const DEFAULT_CONFIG: PiclawConfig = {
	model: undefined,
	thinking: "medium",
	// Include all custom tools by default
	tools: [
		// Built-in tools
		"read", "bash", "edit", "write",
		// Piclaw custom tools

		"todos",
		"memory",
		"echo",
		"system-info",
		"http",
	],
	sessionDir: undefined,
	verbose: false,
};

/**
 * Load configuration from disk.
 * Returns merged config: defaults < file < CLI overrides
 */
export function loadConfig(cliOverrides?: Partial<PiclawConfig>): PiclawConfig {
	const configDir = getConfigDir();
	const configPath = getConfigFilePath();

	// Ensure config directory exists
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true });
	}

	// Load file config if exists
	let fileConfig: PiclawConfig = { ...DEFAULT_CONFIG };
	if (existsSync(configPath)) {
		try {
			const content = readFileSync(configPath, "utf-8");
			fileConfig = JSON.parse(content);
			// Validate and sanitize
			if (fileConfig.thinking && !["off", "minimal", "low", "medium", "high", "xhigh"].includes(fileConfig.thinking)) {
				logger.warn(`Invalid thinking level in config: ${fileConfig.thinking}. Using default.`);
				fileConfig.thinking = DEFAULT_CONFIG.thinking;
			}
			// Validate verbose
			if (fileConfig.verbose !== undefined && typeof fileConfig.verbose !== 'boolean') {
				logger.warn(`Invalid verbose config (expected boolean), got ${typeof fileConfig.verbose}. Using default.`);
				fileConfig.verbose = DEFAULT_CONFIG.verbose;
			}
			// Validate tools
			if (fileConfig.tools !== undefined && !Array.isArray(fileConfig.tools)) {
				logger.warn('Invalid tools config (expected array of strings). Using default.');
				fileConfig.tools = DEFAULT_CONFIG.tools;
			}
		// Validate model format (if provided)
		if (fileConfig.model && typeof fileConfig.model === 'string' && !/^[^:]+:[^:]+$/.test(fileConfig.model)) {
		  logger.warn(`Invalid model ID format: ${fileConfig.model}. Expected format 'provider:model'. Using default.`);
		  fileConfig.model = DEFAULT_CONFIG.model;
		}
		// Validate keybindings (must be an object if provided)
		if (fileConfig.keybindings !== undefined && (typeof fileConfig.keybindings !== 'object' || fileConfig.keybindings === null)) {
		  logger.warn('Invalid keybindings config (expected object). Using default.');
		  fileConfig.keybindings = undefined;
		}
	} catch (err) {
			logger.warn(`Failed to parse config file: ${err}. Using defaults.`);
			fileConfig = { ...DEFAULT_CONFIG };
		}
	}

	// Validate keybindings values (must be non-empty strings)
	if (fileConfig.keybindings) {
	  const kb = fileConfig.keybindings as Record<string, any>;
	  let valid = true;
	  for (const value of Object.values(kb)) {
	    if (typeof value !== "string" || value.trim() === "") {
	      valid = false;
	      break;
	    }
	  }
	  if (!valid) {
	    logger.warn("Invalid keybinding values (must be non-empty strings). Using default.");
	    fileConfig.keybindings = undefined;
	  }
	}

	// Merge: fileConfig is base, cliOverrides take precedence
	return { ...fileConfig, ...cliOverrides };
}

/**
 * Save configuration to disk (with file mutation queue for concurrency safety).
 */
export async function saveConfig(config: PiclawConfig): Promise<void> {
	const configDir = getConfigDir();
	const configPath = getConfigFilePath();

	await withFileMutationQueue(configPath, async () => {
		if (!existsSync(configDir)) {
			mkdirSync(configDir, { recursive: true });
		}
		const content = JSON.stringify(config, null, 2);
		await fs.writeFile(configPath, content, "utf-8");
	});
}

/**
 * Get the config file path (for display/debugging)
 */
export function getConfigPath(): string {
	return getConfigFilePath();
}
