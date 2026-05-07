#!/usr/bin/env node

/**
 * Piclaw Extensions - Main Entry Point
 *
 * This file registers all custom extensions for Piclaw.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerEchoTool, registerSystemInfoTool } from "./tools/index.js";
import autoContinueExtension from "./hooks/auto-continue.js";
import { registerTeamTool } from "./tools/team-tool.js";

export default function (api: import("@mariozechner/pi-coding-agent").ExtensionAPI) {
  // Register providers
  registerKiloProvider(api);

  // Register custom tools
  registerTodosTool(api);
  registerMemoryTool(api);

  // Register additional tools
  registerEchoTool(api);
  registerSystemInfoTool(api);

  // Register Team Tool
  registerTeamTool(api);

  // Register Auto Continue Extension
  autoContinueExtension(api);
}
