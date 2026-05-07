#!/usr/bin/env node
/**
 * Piclaw Custom Extension
 * 
 * Note: Kilo provider is already registered via kilo-provider.ts
 * This file can be extended with additional custom functionality.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerTodosTool } from "./tools/todos-tool.js";
import { registerMemoryTool } from "./tools/memory-tool.js";
import { registerEchoTool } from "./tools/echo-tool.js";
import { registerSystemInfoTool } from "./tools/system-info-tool.js";
import { registerTeamTool } from "./tools/team-tool.js";

export default function (api: ExtensionAPI) {
  // Register custom tools
  registerTodosTool(api);
  registerMemoryTool(api);
  registerEchoTool(api);
  registerSystemInfoTool(api);
  
  // Register team tool - allows LLM to spawn multiple agents
  registerTeamTool(api);
}