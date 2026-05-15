#!/usr/bin/env node

/**
 * Piclaw CLI Entry Point
 *
 * Thin wrapper that:
 * 1. Parses CLI arguments
 * 2. Loads configuration
 * 3. Boots the core runtime
 * 4. Runs interactive mode
 */

import { parseOptions } from "./cli/args.js";
import { loadConfig } from "./config/config-manager.js";
import { validateApiKeys, ensurePiclawExtensionRegistered } from "./helpers.js";
import { getAgentDir } from "./config/config-manager.js";
import { bootPiclaw } from "./piclaw-core.js";
import { runInteractive } from "./interactive-runner.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  let config: any = undefined;
  try {
    // 1. Parse CLI arguments
    const { opts, cliOverrides } = parseOptions(args);
    const cwd = opts.cwd ?? process.cwd();

    // 2. Load persistent config (merged with CLI overrides)
    config = loadConfig(cliOverrides);

    // 3. Validate API keys for configured providers
    validateApiKeys(config);

    // 4. Ensure Piclaw extension is registered in global settings
    const agentDir = getAgentDir();
    const extensionPath = join(__dirname, "extensions", "index.js");
    await ensurePiclawExtensionRegistered(agentDir, extensionPath);

    // 5. Boot the core runtime (services, session, runtime factory)
    const runtime = await bootPiclaw({
      cwd,
      agentDir,
      sessionDir: config.sessionDir ?? opts.sessionDir,
      tools: config.tools,
      model: config.model,
      thinking: config.thinking,
      verbose: config.verbose,
      contextLogFile: config.contextLogFile ?? opts.contextLogFile,
    });

    // 6. Run interactive TUI mode
    await runInteractive(runtime, { verbose: config.verbose });
  } catch (error: any) {
    console.error("\n❌ Failed to start Piclaw:");

    // Provide helpful error messages based on error type
    if (error.message?.includes("ENOENT")) {
      console.error("  → A required file or directory was not found.");
    } else if (error.message?.includes("EACCES") || error.message?.includes("permission")) {
      console.error("  → Permission denied. Check file permissions.");
    } else if (error.message?.includes("API key") || error.message?.includes("api key")) {
      console.error("  → Missing or invalid API key. Check environment variables.");
    } else if (error.message?.includes("network") || error.message?.includes("ECONNREFUSED")) {
      console.error("  → Network error. Check your internet connection.");
    } else if (error.message?.includes("timeout")) {
      console.error("  → Request timed out. Try again later.");
    }

    console.error(`  Error: ${error.message}`);

    if (config?.verbose) {
      console.error(error);
    } else {
      console.error("  Run with --verbose for more details.");
    }

    process.exit(1);
  }
}

// Export for programmatic usage (e.g., tests)
export { main };
