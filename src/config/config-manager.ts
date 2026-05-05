#!/usr/bin/env node

/**
 * Piclaw Configuration Manager
 * Handles persistent user configuration (~/.piclaw/config.json)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

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
	/** Path to file where LLM context (system prompt, messages, tools) will be logged before each request */
	contextLogFile?: string;
}

function getConfigDir(): string {
  return join(homedir(), ".piclaw");
}

export function getDefaultContextLogFile(cwd: string): string {
  return join(cwd, ".piclaw", "context", "context.log");
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
		"subtool_loader",
		"todos",
		"memory",
		"echo",
		"system-info",
	],
	sessionDir: undefined,
	verbose: false,
	contextLogFile: undefined,
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
				console.warn(`Invalid thinking level in config: ${fileConfig.thinking}. Using default.`);
				fileConfig.thinking = DEFAULT_CONFIG.thinking;
			}
		} catch (err) {
			console.warn(`Failed to parse config file: ${err}. Using defaults.`);
			fileConfig = { ...DEFAULT_CONFIG };
		}
	}

	// Merge: fileConfig is base, cliOverrides take precedence
	return { ...fileConfig, ...cliOverrides };
}

/**
 * Save configuration to disk.
 */
export function saveConfig(config: PiclawConfig): void {
	const configDir = getConfigDir();
	const configPath = getConfigFilePath();

	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true });
	}
	const content = JSON.stringify(config, null, 2);
	writeFileSync(configPath, content, "utf-8");
}

/**
 * Get the config file path (for display/debugging)
 */
export function getConfigPath(): string {
	return getConfigFilePath();
}
