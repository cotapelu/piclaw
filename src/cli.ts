#!/usr/bin/env node
import { main as upstreamMain } from "@earendil-works/pi-coding-agent";
import { getExtensionFactories } from "./extensions/index.js";
import { initLogger, createLogger } from "./utils/logger.js";
import { parseWebsocketArgs, startWebsocketTuiServer } from "./websocket-tui-server.js";
import { join } from "node:path";
import { existsSync } from "node:fs";

// Create a module-scoped logger for CLI
const logger = createLogger("CLI");

// Wrapper main
async function main() {
  // Set restrictive umask so session files (and other sensitive files) are created with 0600 permissions
  try { process.umask(0o077); } catch {}
  // Initialize structured logging early
  await initLogger();

  const args = process.argv.slice(2);
  const wsOptions = parseWebsocketArgs(args);

  if (wsOptions.enabled) {
    // Validate that the CLI entry point exists (require built dist)
    const childEntry = join(process.cwd(), 'dist', 'cli.js');
    if (!existsSync(childEntry)) {
      logger.error(
        `WebSocket TUI mode requires the CLI to be built. Please run 'npm run build' first. ` +
        `Looking for: ${childEntry}`
      );
      process.exit(1);
    }

    try {
      const { stop } = startWebsocketTuiServer({
        port: wsOptions.port,
        address: wsOptions.address,
        token: wsOptions.token,
        cliArgs: wsOptions.remainingArgs,
        cwd: process.cwd(),
      });

      // Graceful shutdown
      const shutdown = () => {
        stop();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      logger.info(`WebSocket TUI server started. Open http://${wsOptions.address}:${wsOptions.port}/`);
      if (wsOptions.token) {
        logger.info(`Use ?token=${wsOptions.token} in the URL for authentication.`);
      }

      // Keep the process alive
      await new Promise(() => {});
    } catch (err: unknown) {
      logger.error("Failed to start WebSocket TUI server:", err as Error);
      process.exit(1);
    }
    return;
  }

  // Upstream handles everything else (including @file for including file content)
  await upstreamMain(args, {
    extensionFactories: getExtensionFactories()
  });
}

main().catch(err => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
