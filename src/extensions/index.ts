#!/usr/bin/env node

/**
 * Piclaw Extensions - Main Entry Point
 *
 * This file registers all custom extensions for Piclaw.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerEchoTool, registerSystemInfoTool } from "./tools/index.js";
import autoMemory from "./auto-memory.js";

export default function (api: import("@mariozechner/pi-coding-agent").ExtensionAPI) {
  // Register providers
  registerKiloProvider(api);

  // Register custom tools
  registerTodosTool(api);
  registerMemoryTool(api);

  // Register additional tools
  registerEchoTool(api);
  registerSystemInfoTool(api);

  // Load auto-memory integration
  autoMemory(api);
}
