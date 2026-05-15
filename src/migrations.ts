#!/usr/bin/env node

/**
 * Piclaw Migrations
 *
 * One-time migrations that run on startup.
 * Custom version of pi-mono migrations with Piclaw paths.
 */

import chalk from "chalk";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getAgentDir, getBinDir } from "./config/config-manager.js";

const MIGRATION_GUIDE_URL = "https://github.com/mariozechner/pi-coding-agent/blob/main/CHANGELOG.md#extensions-migration";
const EXTENSIONS_DOC_URL = "https://github.com/mariozechner/pi-coding-agent/blob/main/docs/extensions.md";

/**
 * Migrate legacy oauth.json and settings.json apiKeys to auth.json.
 *
 * @returns Array of provider names that were migrated
 */
export function migrateAuthToAuthJson(): string[] {
	const agentDir = getAgentDir();
	const authPath = join(agentDir, "auth.json");
	const oauthPath = join(agentDir, "oauth.json");
	const settingsPath = join(agentDir, "settings.json");

	// Skip if auth.json already exists
	if (existsSync(authPath)) return [];

	const migrated: Record<string, unknown> = {};
	const providers: string[] = [];

	// Migrate oauth.json
	if (existsSync(oauthPath)) {
		try {
			const oauth = JSON.parse(readFileSync(oauthPath, "utf-8"));
			for (const [provider, cred] of Object.entries(oauth)) {
				migrated[provider] = { type: "oauth", ...(cred as object) };
				providers.push(provider);
			}
			renameSync(oauthPath, `${oauthPath}.migrated`);
		} catch {
			// Skip on error
		}
	}

	// Migrate settings.json apiKeys
	if (existsSync(settingsPath)) {
		try {
			const content = readFileSync(settingsPath, "utf-8");
			const settings = JSON.parse(content);
			if (settings.apiKeys && typeof settings.apiKeys === "object") {
				for (const [provider, key] of Object.entries(settings.apiKeys)) {
					if (!migrated[provider] && typeof key === "string") {
						migrated[provider] = { type: "api_key", key };
						providers.push(provider);
					}
				}
				delete settings.apiKeys;
				writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
			}
		} catch {
			// Skip on error
		}
	}

	if (Object.keys(migrated).length > 0) {
		mkdirSync(dirname(authPath), { recursive: true });
		writeFileSync(authPath, JSON.stringify(migrated, null, 2), { mode: 0o600 });
	}

	return providers;
}

/**
 * Migrate sessions from ~/.piclaw/agent/*.jsonl to proper session directories.
 *
 * Bug in v0.30.0: Sessions were saved to ~/.piclaw/agent/ instead of
 * ~/.piclaw/agent/sessions/<encoded-cwd>/. This migration moves them
 * to the correct location based on the cwd in their session header.
 */
export function migrateSessionsFromAgentRoot(): void {
	const agentDir = getAgentDir();

	// Find all .jsonl files directly in agentDir (not in subdirectories)
	let files: string[];
	try {
		files = readdirSync(agentDir)
			.filter((f) => f.endsWith(".jsonl"))
			.map((f) => join(agentDir, f));
	} catch {
		return;
	}

	if (files.length === 0) return;

	for (const file of files) {
		try {
			// Read first line to get session header
			const firstLine = readFileSync(file, "utf-8").split("\n")[0];
			const header = JSON.parse(firstLine) as any;
			if (header.type !== "session_header") continue;

			const cwd = header.cwd;
			if (!cwd) continue;

			// Compute target directory: ~/.piclaw/agent/sessions/<encoded-cwd>/
			const sessionsDir = join(agentDir, "sessions");
			const encodedCwd = encodeURIComponent(cwd);
			const targetDir = join(sessionsDir, encodedCwd);
			const targetPath = join(targetDir, `${header.id}.jsonl`);

			// Create target directory
			mkdirSync(targetDir, { recursive: true });

			// Move file if target doesn't exist
			if (!existsSync(targetPath)) {
				renameSync(file, targetPath);
				console.log(chalk.green(`  ✓ Migrated session ${header.id} to sessions/`));
			} else {
				// Target exists, remove duplicate (keep existing)
				rmSync(file, { force: true });
			}
		} catch {
			// Skip on error
		}
	}
}

/**
 * Migrate keybindings from global to per-mode format.
 */
export function migrateKeybindingsConfig(): void {
	// Load keybindings from settings.json
	const settingsPath = join(getAgentDir(), "settings.json");
	if (!existsSync(settingsPath)) return;

	try {
		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);

		if (!settings.keybindings) return;

		// Pi-mono keybindings format: { "key": "action" }
		// Piclaw format: { "mode": { "key": "action" } }
		const oldKeybindings = settings.keybindings;
		if (typeof oldKeybindings !== "object") return;

		// Check if already migrated (has mode structure)
		if (Object.values(oldKeybindings).some((v) => typeof v === "object")) return;

		// Convert: all keys go into "global"
		settings.keybindings = {
			global: oldKeybindings,
		};

		writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
		console.log(chalk.green("  ✓ Migrated keybindings to per-mode format"));
	} catch {
		// Skip on error
	}
}

/**
 * Run all migrations.
 *
 * @param cwd - Current working directory (used for workspace-specific migrations)
 * @returns Object with migrated providers and deprecation warnings
 */
export function runMigrations(cwd: string): {
	migratedAuthProviders: string[];
	deprecationWarnings: string[];
} {
	const migratedAuthProviders = migrateAuthToAuthJson();
	const deprecationWarnings: string[] = [];

	// Only run session migration if there are .jsonl files in agent root (old location)
	try {
		const agentDir = getAgentDir();
		const files = readdirSync(agentDir);
		const hasOldSessions = files.some((f) => f.endsWith(".jsonl"));
		if (hasOldSessions) {
			migrateSessionsFromAgentRoot();
		}
	} catch {
		// Ignore
	}

	// Migrate keybindings format
	migrateKeybindingsConfig();

	// Add deprecation warnings here if needed

	return { migratedAuthProviders, deprecationWarnings };
}

/**
 * Show deprecation warnings to the user.
 */
export function showDeprecationWarnings(warnings: string[]): Promise<void> {
	// In interactive mode, show as a message
	// For now, just log
	if (warnings.length > 0) {
		console.log(chalk.yellow("\n⚠️  Deprecation warnings:"));
		for (const warning of warnings) {
			console.log(chalk.yellow(`  - ${warning}`));
		}
		console.log();
	}
	return Promise.resolve();
}
