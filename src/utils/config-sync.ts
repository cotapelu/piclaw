#!/usr/bin/env node
/**
 * Config Sync Utilities
 *
 * Syncs Piclaw config (~/.piclaw/config.json) to Upstream settings (~/.pi/agent/settings.json)
 * Maintains single source of truth in Piclaw config.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { PiclawConfig } from "../config/config-manager.js";

/** Simple path normalizer (pi upstream compatible) */
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/$/, "");
}


/**
 * Get upstream agent directory.
 * Uses PI_CODING_AGENT_DIR if set, otherwise defaults to ~/.pi/agent.
 */
export function getUpstreamAgentDir(): string {
	const envDir = process.env.PI_CODING_AGENT_DIR;
	if (envDir) {
		let path = envDir;
		// Expand ~ manually
		if (path.startsWith("~/")) {
			path = join(homedir(), path.slice(2));
		} else if (path.startsWith("~\\")) {
			path = join(homedir(), path.slice(2));
		}
		return normalizePath(path);
	}
	return join(homedir(), ".pi", "agent");
}

/**
 * Get path to upstream global settings file.
 */
export function getUpstreamSettingsPath(): string {
	return join(getUpstreamAgentDir(), "settings.json");
}

/**
 * Build upstream settings overrides from Piclaw config.
 * Only maps fields that upstream understands.
 *
 * NOTE: We intentionally DO NOT sync model (defaultProvider/defaultModel)
 * to avoid overwriting user's model selection via /model command.
 * Model is managed entirely by upstream settings.
 */
export function buildOverrides(config: PiclawConfig): Record<string, unknown> {
	const overrides: Record<string, unknown> = {};

	// Thinking level (still synced)
	if (config.thinking) {
		overrides.defaultThinkingLevel = config.thinking;
	}

	// Session directory (still synced)
	if (config.sessionDir) {
		overrides.sessionDir = config.sessionDir;
	}

	// Note: We intentionally DO NOT map:
	// - model (defaultProvider/defaultModel) → let upstream manage
	// - plugins (upstream doesn't use)
	// - verbose (upstream uses quietStartup, different semantics)
	// - tools, keybindings, metricsRetentionDays (piclaw-specific)

	return overrides;
}

/**
 * Deep merge two objects (nested objects merged recursively, primitives/arrays override).
 */
export function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
	const output = { ...target };

	for (const key of Object.keys(source)) {
		const srcVal = source[key];
		const tgtVal = target[key];

		if (srcVal === undefined) continue;

		if (
			typeof srcVal === "object" &&
			srcVal !== null &&
			!Array.isArray(srcVal) &&
			typeof tgtVal === "object" &&
			tgtVal !== null &&
			!Array.isArray(tgtVal)
		) {
			output[key] = deepMerge(tgtVal || {}, srcVal);
		} else {
			output[key] = srcVal;
		}
	}

	return output;
}

/**
 * Sync Piclaw config to upstream settings file.
 * This writes overrides to ~/.pi/agent/settings.json (or custom PI_CODING_AGENT_DIR).
 */
export function syncPiclawToUpstream(config: PiclawConfig): void {
	const settingsPath = getUpstreamSettingsPath();
	let upstream: Record<string, any> = {};

	// Load existing upstream settings if valid
	if (existsSync(settingsPath)) {
		try {
			upstream = JSON.parse(readFileSync(settingsPath, "utf-8"));
		} catch (e) {
			// Corrupted file, start fresh
			upstream = {};
		}
	}

	const overrides = buildOverrides(config);
	if (Object.keys(overrides).length === 0) {
		return; // Nothing to sync
	}

	const merged = deepMerge(upstream, overrides);

	// Ensure directory exists
	const dir = dirname(settingsPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	writeFileSync(settingsPath, JSON.stringify(merged, null, 2), "utf-8");
}
