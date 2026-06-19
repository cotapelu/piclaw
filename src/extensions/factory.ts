#!/usr/bin/env node

/**
 * Piclaw Extensions - Factory Module
 *
 * This module contains the main extension aggregator function
 * and configuration utilities for extension loading.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerUniversalTool } from "./tools/index.js";

// Plugin isolation support
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { loadConfig } from "../config/config-manager.js";
import { PluginManager } from "./plugins/plugin-manager.js";
import { registerGitTool } from "./tools/git-tool.js";
import { registerTestTool } from "./tools/test-tool.js";
import { registerFormatterTool } from "./tools/formatter-tool.js";
import { registerAuditTool } from "./tools/audit-tool.js";
import { registerBuildTool } from "./tools/build-tool.js";
import { registerMetricsTool } from "./tools/metrics-tool.js";
// import { registerSecretScannerTool } from "./tools/secret-scanner-tool.js"; // REMOVED: memory leak tool
import { registerScriptsTool } from "./tools/scripts-tool.js";
import { registerHttpClientTool } from "./tools/http-client-tool.js";
import { registerDbClientTool } from "./tools/db-client-tool.js";
import { registerCacheManagerTool } from "./tools/cache-manager-tool.js";
import { registerPrometheusMetricsTool } from "./tools/prometheus-metrics-tool.js";
import { registerSessionHealthTool } from "./tools/session-health-tool.js";
import { registerTeamTool } from "./team/index.js";
import { registerSubToolLoaderExtension } from "./tools/subtool-loader.js";
import { registerToolTemplate } from "./tools/tool-template.js";
import { registerSkillReaderExtension } from "./tools/skill-reader.js";
import autoContinueExtension from "./hooks/auto-continue.js";
import autoCompact85Extension from "./hooks/auto-compact-85.js";
import contextLoggerExtension from "./context-logger.js";

import piclawHeader from "./piclaw-header.js";
import { registerTodosRenderer } from "./renderers/todos-renderer.js";
import { registerTeamWidget } from "./team/team-widget.js";
import { registerMetricsWidget } from "./metrics/metrics-widget.js";
import { registerMemoryRenderer } from "./renderers/memory-renderer.js";
import { registerBranchSummaryRenderer } from "./renderers/branch-summary-renderer.js";
import { registerTeamOpsRenderer } from "./renderers/team-ops-renderer.js";
import { registerSessionTreeCommand } from "./commands/session-tree-command.js";
import { registerSettingsCommand } from "./commands/settings-command.js";
import { registerProviderCommand } from "./commands/provider-command.js";
import { registerCopyCommand } from "./commands/copy-command.js";
import { registerTeamCommand } from "./commands/team-command.js";
import { registerMetricsCommand } from "./commands/metrics-command.js";
import { registerKeybindingExtension } from "./keybinding/keybinding-extension.js";

/**
 * Main extension aggregator function
 *
 * Registers all custom extensions for Piclaw.
 * Called by the extension factory system.
 */
export default async function extensionsAggregator(api: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
  const config = loadConfig();
  const isolatePlugins = (config as any).plugins?.isolate ?? false;
  let pluginManager: PluginManager | null = null;

  if (isolatePlugins) {
    pluginManager = new PluginManager(api);
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const universalPath = join(__dirname, 'tools', 'universal-tool.js');
    await pluginManager.loadExtension(universalPath, 'universal-tool');
    const worker = pluginManager.getWorker('universal-tool')!;
    // Wait for worker ready event
    await new Promise<void>((resolve, reject) => {
      const onMessage = (msg: any) => {
        if (msg.type === 'event' && msg.event === 'ready') {
          worker.underlying.removeListener('message', onMessage);
          resolve();
        }
      };
      worker.underlying.on('message', onMessage);
      worker.underlying.once('error', (err: any) => reject(err));
    });
  }

  // Register non-isolated built-in extensions
  if (!isolatePlugins) {
    registerUniversalTool(api);
  }

  // Register providers
  registerKiloProvider(api);

  // Register custom tools (others remain direct)
  registerTodosTool(api);
  registerMemoryTool(api);
  registerTeamTool(api);
  registerToolTemplate(api);
  registerSkillReaderExtension(api);

  // Git tool
  registerGitTool(api);
  // Test tool
  registerTestTool(api);
  // Formatter tool
  registerFormatterTool(api);
  // Audit tool
  registerAuditTool(api);
  // Build tool
  registerBuildTool(api);
  // Metrics tool
  registerMetricsTool(api);
  // Prometheus metrics tool
  registerPrometheusMetricsTool(api);
  // Session health check tool
  registerSessionHealthTool(api);
  // Scripts tool
  registerScriptsTool(api);
  // HTTP client tool
  registerHttpClientTool(api);
  // Cache manager tool
  registerCacheManagerTool(api);
  // Database client tool
  registerDbClientTool(api);
  // Subtool loader extension
  registerSubToolLoaderExtension(api);

  // Custom message renderers
  registerTodosRenderer(api);
  registerMemoryRenderer(api);
  registerTeamWidget(api);
  registerBranchSummaryRenderer(api);
  registerTeamOpsRenderer(api);
  registerMetricsWidget(api);

  // Commands
  registerSessionTreeCommand(api);
  registerSettingsCommand(api);
  registerProviderCommand(api);
  registerCopyCommand(api);
  registerTeamCommand(api);
  registerMetricsCommand(api);
  // Keybinding extension
  registerKeybindingExtension(api);

  // Hooks
  autoContinueExtension(api);
  autoCompact85Extension(api);

  // Header
  piclawHeader(api);

  // Context Logger
  contextLoggerExtension(api);
}

/**
 * Returns array of extension factory functions
 * Used by the extension loader system
 */
export function getExtensionFactories() {
  return [extensionsAggregator];
}

// Re-export aggregator with clear name
export { extensionsAggregator };

// Type-only export for consistency
export type { extensionsAggregator as ExtensionsAggregator };
