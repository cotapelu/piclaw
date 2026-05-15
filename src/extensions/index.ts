#!/usr/bin/env node

/**
 * Piclaw Extensions - Main Entry Point
 *
 * This file registers all custom extensions for Piclaw.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerUniversalTool } from "./tools/index.js";
import { registerSubToolLoaderExtension } from "./tools/subtool-loader";
import autoContinueExtension from "./hooks/auto-continue.js";

import piclawHeader from "./piclaw-header.js";

export default function (api: import("@mariozechner/pi-coding-agent").ExtensionAPI) {
  // Register providers
  registerKiloProvider(api);

  // Register custom tools
  registerTodosTool(api);
  registerMemoryTool(api);

  // Register universal tool (replaces echo and system_info)
  registerUniversalTool(api);
  registerSubToolLoaderExtension(api);

  // Register Auto Continue Extension
  autoContinueExtension(api);

  // Register Piclaw Header
  piclawHeader(api);
}
