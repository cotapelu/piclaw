#!/usr/bin/env node

/**
 * Piclaw Extensions - Main Entry Point
 *
 * This file registers all custom extensions for Piclaw.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerUniversalTool } from "./tools/index.js";
import { registerTeamTool } from "./team/index.js";
import { registerSubToolLoaderExtension } from "./tools/subtool-loader.js";
import { registerToolTemplate } from "./tools/tool-template.js";
import { registerSkillReaderExtension } from "./tools/skill-reader";
import autoContinueExtension from "./hooks/auto-continue.js";
import autoCompact85Extension from "./hooks/auto-compact-85.js";

import piclawHeader from "./piclaw-header.js";

export default function (api: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
  // Register providers
  registerKiloProvider(api);

  // Register custom tools
  //
  registerTodosTool(api);
  //
  registerMemoryTool(api);
  registerTeamTool(api);
  registerToolTemplate(api);
  registerSkillReaderExtension(api);

  // Register universal tool (replaces echo and system_info)
  registerUniversalTool(api);
  // Register subtool loader extension
  registerSubToolLoaderExtension(api);
  // (subtool-loader replaced by skill-loader)

  // Register Auto Continue Extension
  autoContinueExtension(api);

  // Register Auto Compact at 75% Extension
  autoCompact85Extension(api);

  // Register Piclaw Header
  piclawHeader(api);
}
