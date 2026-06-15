#!/usr/bin/env node
import { main as upstreamMain } from "@earendil-works/pi-coding-agent";
import { handleCustomCommands } from "./custom-commands.js";
import { getExtensionFactories } from "./extensions/index.js";
import { initLogger, createLogger } from "./utils/logger.js";

// Create a module-scoped logger for CLI
const logger = createLogger("CLI");

// Wrapper main
async function main() {
  // Initialize structured logging early
  await initLogger();

  const args = process.argv.slice(2);

  // Custom commands (pin, export, import, health)
  if (await handleCustomCommands(args)) return;

  // Upstream handles everything else (including @file for including file content)
  await upstreamMain(args, {
    extensionFactories: getExtensionFactories()
  });
}

main().catch(err => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
