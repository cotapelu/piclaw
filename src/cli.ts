#!/usr/bin/env node
import { main as upstreamMain } from "@earendil-works/pi-coding-agent";
import { handleCustomCommands } from "./custom-commands.js";
import { getExtensionFactories } from "./extensions/index.js";

// Wrapper main
async function main() {
  const args = process.argv.slice(2);

  // Custom commands (pin, export, import, health)
  if (await handleCustomCommands(args)) return;

  // Upstream handles everything else (including @file for including file content)
  await upstreamMain(args, {
    extensionFactories: getExtensionFactories()
  });
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
