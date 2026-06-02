#!/usr/bin/env node
import { logger } from "./utils/logger.js";

import { parseOptions } from "./cli/args.js";
import { loadConfig } from "./config/config-manager.js";
import { validateApiKeys, ensurePiclawExtensionRegistered } from "./utils/helpers.js";
import { getAgentDir } from "./config/config-manager.js";
import { bootPiclaw } from "./piclaw-core.js";
import { runInteractive } from "./interactive-runner.js";
import { runPrintMode, runRpcMode } from "@earendil-works/pi-coding-agent";
import { handlePackageCommand } from "./package-commands.js";
import { buildInitialMessage } from "./file-processor.js";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { takeOverStdout, restoreStdout } from "./utils/output-guard.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Read all content from piped stdin.
 */
async function readPipedStdin(): Promise<string | undefined> {
  if (process.stdin.isTTY) {
    return undefined;
  }

  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data.trim() || undefined);
    });
    process.stdin.resume();
  });
}

async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  let config: any = undefined;
  try {
    // Handle package commands first
    if (await handlePackageCommand(args)) {
      return;
    }

    // 1. Parse CLI arguments
    const { opts, cliOverrides } = parseOptions(args);
    const cwd = opts.cwd ?? process.cwd();

    // 2. Load persistent config (merged with CLI overrides)
    config = loadConfig(cliOverrides);

    // 3. Validate API keys
    validateApiKeys(config);

    // 4. Ensure Piclaw extension is registered
    const agentDir = getAgentDir();
    const extensionPath = join(__dirname, "extensions", "index.js");
    await ensurePiclawExtensionRegistered(agentDir, extensionPath);

    // 5. Boot the core runtime
    const runtime = await bootPiclaw({
      cwd,
      agentDir,
      sessionDir: config.sessionDir ?? opts.sessionDir,
      tools: config.tools,
      model: config.model,
      thinking: config.thinking,
      verbose: config.verbose,
      contextLogFile: config.contextLogFile ?? opts.contextLogFile,
      // Session flags
      session: opts.session,
      resume: opts.resume,
      continue: opts.continue,
      fork: opts.fork,
      // Files/mode (passed through)
      files: opts.files,
      messages: opts.message,
      mode: opts.mode,
    });

    // Set global runtime for extensions
    const { setGlobalRuntime } = await import("./runtime-runner.js");
    setGlobalRuntime(runtime);

    // 6. Prepare initial message from files + stdin if provided
    let initialMessage: string | undefined;
    let initialImages: any[] | undefined;

    if (opts.files && opts.files.length > 0) {
      const settingsManager = runtime.services.settingsManager;
      const autoResize = settingsManager.getImageAutoResize?.() ?? true;
      const stdinContent = await readPipedStdin();
      const { text, images } = await buildInitialMessage(
        opts.files,
        stdinContent,
        autoResize
      );
      initialMessage = text;
      initialImages = images;
    }

    // 7. Log session info
    const sessionMgr = runtime.session.sessionManager as SessionManager;
    logger.info(`Session: ${sessionMgr.getSessionId()}`);
    logger.debug(`Session file: ${sessionMgr.getSessionFile()}`);

    // 8. Route based on mode
    const mode = opts.mode ?? 'interactive';

    if (mode === 'rpc') {
      // RPC mode: JSON-RPC over stdin/stdout
      takeOverStdout();
      await runRpcMode(runtime);
      restoreStdout();
    } else if (mode === 'print' || mode === 'json') {
      // Print/JSON mode: single turn output
      takeOverStdout();

      // Additional messages after initial (from --message flags)
      const additionalMessages = opts.message || [];

      // For print/json mode, we need to send initial message + additional messages sequentially
      // The runtime will handle this via runPrintMode options
      const exitCode = await runPrintMode(runtime, {
        mode: mode === 'json' ? 'json' : 'text',
        messages: additionalMessages,
        initialMessage,
        initialImages,
      } as any); // Type assertion needed if strict

      restoreStdout();
      if (exitCode !== 0) {
        process.exitCode = exitCode;
      }
    } else {
      // Interactive mode (default)
      await runInteractive(runtime, {
        verbose: config.verbose,
        initialMessage,
        initialImages,
      });
    }

  } catch (error: any) {
    logger.error("\n❌ Failed to start Piclaw:");

    if (error.message?.includes("ENOENT")) {
      logger.error("  → A required file or directory was not found.");
    } else if (error.message?.includes("EACCES") || error.message?.includes("permission")) {
      logger.error("  → Permission denied. Check file permissions.");
    } else if (error.message?.includes("API key") || error.message?.includes("api key")) {
      logger.error("  → Missing or invalid API key. Check environment variables.");
    } else if (error.message?.includes("network") || error.message?.includes("ECONNREFUSED")) {
      logger.error("  → Network error. Check your internet connection.");
    } else if (error.message?.includes("timeout")) {
      logger.error("  → Request timed out. Try again later.");
    } else if (error.message?.includes("429") || error.message?.toLowerCase().includes("rate limit")) {
      logger.error("  → Rate limit exceeded. Please wait before retrying.");
    }

    logger.error(`  Error: ${error.message}`);

    if (config?.verbose) {
      logger.error(error);
    } else {
      logger.error("  Run with --verbose for more details.");
    }

    process.exit(1);
  }
}

export { main };
