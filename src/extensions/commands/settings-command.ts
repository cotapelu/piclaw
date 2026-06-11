#!/usr/bin/env node

/**
 * Settings Command
 *
 * Interactive UI to configure Piclaw settings.
 * Edits ~/.piclaw/config.json via loadConfig/saveConfig.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Text, Spacer, SettingsList } from "@earendil-works/pi-tui";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { loadConfig, saveConfig, type PiclawConfig } from "../../config/config-manager.js";

interface SettingItem {
  id: string;
  label: string;
  currentValue: string;
  values: string[];
}

function configToItems(config: PiclawConfig): SettingItem[] {
  const items: SettingItem[] = [];

  // Model (free text - but we validate it's non-empty)
  items.push({
    id: "model",
    label: "Default Model",
    currentValue: config.model || "<unset>",
    values: ["<unset>", "anthropic:claude-opus-4-5", "openai:gpt-4o", "kilo:gpt-4o"],
  });

  // Thinking level
  items.push({
    id: "thinking",
    label: "Thinking Level",
    currentValue: config.thinking || "medium",
    values: ["off", "minimal", "low", "medium", "high", "xhigh"],
  });

  // Verbose
  items.push({
    id: "verbose",
    label: "Verbose Logs",
    currentValue: config.verbose ? "on" : "off",
    values: ["on", "off"],
  });

  // Context log file
  items.push({
    id: "contextLogFile",
    label: "Context Log File",
    currentValue: config.contextLogFile || "<default>",
    values: ["<default>", "<unset>"],
  });

  // Session dir
  items.push({
    id: "sessionDir",
    label: "Session Directory",
    currentValue: config.sessionDir || "<default>",
    values: ["<default>", "<unset>"],
  });

  return items;
}

function itemsToConfig(config: PiclawConfig, items: SettingItem[]): PiclawConfig {
  const newConfig = { ...config };

  for (const item of items) {
    const value = item.currentValue;
    switch (item.id) {
      case "model":
        newConfig.model = value === "<unset>" ? undefined : value;
        break;
      case "thinking":
        newConfig.thinking = value as "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
        break;
      case "verbose":
        newConfig.verbose = value === "on";
        break;
      case "contextLogFile":
        newConfig.contextLogFile = value === "<default>" ? undefined : value === "<unset>" ? undefined : value;
        break;
      case "sessionDir":
        newConfig.sessionDir = value === "<default>" ? undefined : value;
        break;
    }
  }

  return newConfig;
}

export function registerSettingsCommand(api: ExtensionAPI): void {
  api.registerCommand("settings", {
    description: "Configure Piclaw settings (model, thinking, logs, etc.)",
    handler: async (_args: string, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/settings requires TUI mode", "error");
        return;
      }

      // Load current config
      let currentConfig = loadConfig();

      await ctx.ui.custom((_tui, theme, _kb, done) => {
        const container = new Container();

        container.addChild(new Text(theme.fg("accent", theme.bold("⚙️ Piclaw Settings")), 1, 0));
        container.addChild(new Spacer(1));

        const items = configToItems(currentConfig);

        const settingsList = new SettingsList(
          items,
          Math.min(items.length + 2, 15),
          getSettingsListTheme(),
          (id, newValue) => {
            // Update in-memory config
            const updatedItems = items.map(item => item.id === id ? { ...item, currentValue: newValue } : item);
            currentConfig = itemsToConfig(currentConfig, updatedItems);
            // Async save with error handling
            (async () => {
              try {
                await saveConfig(currentConfig);
                ctx.ui.notify(`Saved ${id} = ${newValue}`, "info");
              } catch (err: any) {
                ctx.ui.notify(`Failed to save ${id}: ${err.message}`, "error");
              }
            })();
          },
          () => {
            // Close
            done(undefined);
          },
          { enableSearch: true }
        );

        container.addChild(settingsList);

        const component = {
          render(width: number) {
            return container.render(width);
          },
          invalidate() {
            container.invalidate();
          },
          handleInput(data: string) {
            settingsList.handleInput?.(data);
            _tui.requestRender();
          },
        };

        return component;
      });

      ctx.ui.notify("Settings configuration complete", "info");
    },
  });
}

// Helper to update a single item in array
function updateItemValue(items: SettingItem[], id: string, newValue: string): SettingItem[] {
  return items.map(item => {
    if (item.id === id) {
      return { ...item, currentValue: newValue };
    }
    return item;
  });
}
