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
  // Register provider first
  registerKiloProvider(api);

  const config = loadConfig();
  const isolatePlugins = (config as any).plugins?.isolate ?? false;
  let pluginManager: PluginManager | null = null;

  // List of simple tool modules that can be isolated
  const toolModules = [
    'universal-tool',
    'git-tool',
    'test-tool',
    'formatter-tool',
    'audit-tool',
    'build-tool',
    'metrics-tool',
    'prometheus-metrics-tool',
    'session-health-tool',
    'scripts-tool',
    'http-client-tool',
    'cache-manager-tool',
    'db-client-tool',
    'memory-tool'
  ];

  // List of command modules that can be isolated
  const commandModules = [
    'session-tree-command',
    'settings-command',
    'provider-command',
    'copy-command',
    'team-command',
    'metrics-command'
  ];

  // Helper: convert kebab-case to PascalCase
  const toPascal = (s: string) => s.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

  if (isolatePlugins) {
    pluginManager = new PluginManager(api);
    const __dirname = dirname(fileURLToPath(import.meta.url));

    // Load tools in workers and wait for ready
    for (const name of toolModules) {
      const modulePath = join(__dirname, 'tools', `${name}.js`);
      const entryName = `register${toPascal(name)}`;
      await pluginManager.loadExtension(modulePath, name, entryName);
      const worker = pluginManager.getWorker(name)!;
      // Wait for worker ready event
      await new Promise<void>((resolve, reject) => {
        const onMessage = (msg: any) => {
          if (msg.type === 'event' && msg.event === 'ready') {
            worker.underlying.removeListener('message', onMessage);
            resolve();
          }
        };
        worker.underlying.on('message', onMessage);
        worker.underlying.once('error', reject);
      });
    }

    // Load commands in workers and wait for ready
    for (const name of commandModules) {
      const modulePath = join(__dirname, 'commands', `${name}.js`);
      const entryName = `register${toPascal(name)}`;
      await pluginManager.loadExtension(modulePath, name, entryName);
      const worker = pluginManager.getWorker(name)!;
      await new Promise<void>((resolve, reject) => {
        const onMessage = (msg: any) => {
          if (msg.type === 'event' && msg.event === 'ready') {
            worker.underlying.removeListener('message', onMessage);
            resolve();
          }
        };
        worker.underlying.on('message', onMessage);
        worker.underlying.once('error', reject);
      });
    }

    // Load hooks in workers and wait for ready
    const hookModules = [
      'auto-continue',
      'auto-compact-85',
      'context-logger'
    ];
    for (const name of hookModules) {
      const modulePath = join(__dirname, 'hooks', `${name}.js`);
      await pluginManager.loadExtension(modulePath, name);
      const worker = pluginManager.getWorker(name)!;
      await new Promise<void>((resolve, reject) => {
        const onMessage = (msg: any) => {
          if (msg.type === 'event' && msg.event === 'ready') {
            worker.underlying.removeListener('message', onMessage);
            resolve();
          }
        };
        worker.underlying.on('message', onMessage);
        worker.underlying.once('error', reject);
      });
    }

    // Load metrics widget in worker (as proof-of-concept for widget isolation)
    const metricsWidgetPath = join(__dirname, 'metrics', 'metrics-widget.js');
    await pluginManager.loadExtension(metricsWidgetPath, 'metrics-widget');
    const metricsWorker = pluginManager.getWorker('metrics-widget')!;
    await new Promise<void>((resolve, reject) => {
      const onMessage = (msg: any) => {
        if (msg.type === 'event' && msg.event === 'ready') {
          metricsWorker.underlying.removeListener('message', onMessage);
          resolve();
        }
      };
      metricsWorker.underlying.on('message', onMessage);
      metricsWorker.underlying.once('error', reject);
    });

    // Load team widget in worker
    const teamWidgetPath = join(__dirname, 'team', 'team-widget.js');
    await pluginManager.loadExtension(teamWidgetPath, 'team-widget');
    const teamWorker = pluginManager.getWorker('team-widget')!;
    await new Promise<void>((resolve, reject) => {
      const onMessage = (msg: any) => {
        if (msg.type === 'event' && msg.event === 'ready') {
          teamWorker.underlying.removeListener('message', onMessage);
          resolve();
        }
      };
      teamWorker.underlying.on('message', onMessage);
      teamWorker.underlying.once('error', reject);
    });
  } else {
    // Direct registration for all simple tools
    for (const name of toolModules) {
      switch (name) {
        case 'universal-tool':
          registerUniversalTool(api);
          break;
        case 'git-tool':
          registerGitTool(api);
          break;
        case 'test-tool':
          registerTestTool(api);
          break;
        case 'formatter-tool':
          registerFormatterTool(api);
          break;
        case 'audit-tool':
          registerAuditTool(api);
          break;
        case 'build-tool':
          registerBuildTool(api);
          break;
        case 'metrics-tool':
          registerMetricsTool(api);
          break;
        case 'prometheus-metrics-tool':
          registerPrometheusMetricsTool(api);
          break;
        case 'session-health-tool':
          registerSessionHealthTool(api);
          break;
        case 'scripts-tool':
          registerScriptsTool(api);
          break;
        case 'http-client-tool':
          registerHttpClientTool(api);
          break;
        case 'cache-manager-tool':
          registerCacheManagerTool(api);
          break;
        case 'db-client-tool':
          registerDbClientTool(api);
          break;
        case 'memory-tool':
          registerMemoryTool(api);
          break;
      }
    }

    // Direct registration for commands
    for (const name of commandModules) {
      switch (name) {
        case 'session-tree-command':
          registerSessionTreeCommand(api);
          break;
        case 'settings-command':
          registerSettingsCommand(api);
          break;
        case 'provider-command':
          registerProviderCommand(api);
          break;
        case 'copy-command':
          registerCopyCommand(api);
          break;
        case 'team-command':
          registerTeamCommand(api);
          break;
        case 'metrics-command':
          registerMetricsCommand(api);
          break;
      }
    }
  }

  // Non-tool, non-command extensions (always direct)
  registerTodosTool(api);
  registerTeamTool(api);
  registerToolTemplate(api);
  registerSkillReaderExtension(api);
  // Subtool loader extension
  registerSubToolLoaderExtension(api);

  // Custom message renderers (always direct for now)
  registerTodosRenderer(api);
  registerMemoryRenderer(api);
  registerBranchSummaryRenderer(api);
  registerTeamOpsRenderer(api);
  // Widgets: direct only when not isolating
  if (!isolatePlugins) {
    registerTeamWidget(api);
    registerMetricsWidget(api);
  }

  // Hooks: either load via worker or direct
  if (isolatePlugins) {
    // Hook modules loaded above in the isolate block
  } else {
    autoContinueExtension(api);
    autoCompact85Extension(api);
    contextLoggerExtension(api);
  }

  // Keybinding extension (always direct)
  registerKeybindingExtension(api);

  // Header
  piclawHeader(api);
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