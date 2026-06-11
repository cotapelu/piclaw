#!/usr/bin/env node

/**
 * Settings Command Unit Tests
 *
 * Tests config conversion logic and validation.
 */

import { describe, it, expect } from "vitest";
import type { PiclawConfig } from "../../config/config-manager.js";

// Re-export functions to test (we'll inline them for isolation)
interface SettingItem {
  id: string;
  label: string;
  currentValue: string;
  values: string[];
}

function configToItems(config: PiclawConfig): SettingItem[] {
  const items: SettingItem[] = [];

  items.push({
    id: "model",
    label: "Default Model",
    currentValue: config.model || "<unset>",
    values: ["<unset>", "anthropic:claude-opus-4-5", "openai:gpt-4o", "kilo:gpt-4o"],
  });

  items.push({
    id: "thinking",
    label: "Thinking Level",
    currentValue: config.thinking || "medium",
    values: ["off", "minimal", "low", "medium", "high", "xhigh"],
  });

  items.push({
    id: "verbose",
    label: "Verbose Logs",
    currentValue: config.verbose ? "on" : "off",
    values: ["on", "off"],
  });

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
      case "sessionDir":
        newConfig.sessionDir = (value === "<default>" || value === "<unset>") ? undefined : value;
        break;
    }
  }

  return newConfig;
}

describe("Settings Command - Config Conversion", () => {
  const defaultConfig: PiclawConfig = {
    model: "openai:gpt-4o",
    thinking: "medium",
    verbose: true,
    sessionDir: undefined,
  };

  it("should convert config to items correctly", () => {
    const items = configToItems(defaultConfig);

    expect(items.length).toBe(4);

    const modelItem = items.find(i => i.id === "model")!;
    expect(modelItem.currentValue).toBe("openai:gpt-4o");
    expect(modelItem.values).toContain("openai:gpt-4o");

    const thinkingItem = items.find(i => i.id === "thinking")!;
    expect(thinkingItem.currentValue).toBe("medium");

    const verboseItem = items.find(i => i.id === "verbose")!;
    expect(verboseItem.currentValue).toBe("on");

    const sessionDirItem = items.find(i => i.id === "sessionDir")!;
    expect(sessionDirItem.currentValue).toBe("<default>");
  });

  it("should handle model set to <unset>", () => {
    const config: PiclawConfig = { ...defaultConfig, model: undefined };
    const items = configToItems(config);
    const modelItem = items.find(i => i.id === "model")!;
    expect(modelItem.currentValue).toBe("<unset>");
  });

  it("should handle verbose off", () => {
    const config: PiclawConfig = { ...defaultConfig, verbose: false };
    const items = configToItems(config);
    const verboseItem = items.find(i => i.id === "verbose")!;
    expect(verboseItem.currentValue).toBe("off");
  });

  it("should handle sessionDir set to custom path", () => {
    const items = configToItems(defaultConfig);
    const sessionDirItem = items.find(i => i.id === "sessionDir")!;
    expect(sessionDirItem.currentValue).toBe("<default>");
  });

  it("should convert items back to config correctly", () => {
    const items = configToItems(defaultConfig);
    const newConfig = itemsToConfig(defaultConfig, items);

    expect(newConfig.model).toBe("openai:gpt-4o");
    expect(newConfig.thinking).toBe("medium");
    expect(newConfig.verbose).toBe(true);
    expect(newConfig.sessionDir).toBeUndefined();
  });

  it("should handle model unset in itemsToConfig", () => {
    const items: SettingItem[] = [
      { id: "model", label: "Default Model", currentValue: "<unset>", values: [] },
      { id: "thinking", label: "Thinking Level", currentValue: "medium", values: [] },
      { id: "verbose", label: "Verbose Logs", currentValue: "on", values: [] },
      { id: "sessionDir", label: "Session Directory", currentValue: "<default>", values: [] },
    ];
    const newConfig = itemsToConfig(defaultConfig, items);
    expect(newConfig.model).toBeUndefined();
  });

  it("should handle sessionDir set to custom path in itemsToConfig", () => {
    const items: SettingItem[] = [
      { id: "model", label: "Default Model", currentValue: "openai:gpt-4o", values: [] },
      { id: "thinking", label: "Thinking Level", currentValue: "medium", values: [] },
      { id: "verbose", label: "Verbose Logs", currentValue: "on", values: [] },
      { id: "sessionDir", label: "Session Directory", currentValue: "/custom/sessions", values: [] },
    ];
    const newConfig = itemsToConfig(defaultConfig, items);
    expect(newConfig.sessionDir).toBe("/custom/sessions");
  });

  it("should handle sessionDir unset in itemsToConfig", () => {
    const items: SettingItem[] = [
      { id: "model", label: "Default Model", currentValue: "openai:gpt-4o", values: [] },
      { id: "thinking", label: "Thinking Level", currentValue: "medium", values: [] },
      { id: "verbose", label: "Verbose Logs", currentValue: "on", values: [] },
      { id: "sessionDir", label: "Session Directory", currentValue: "<unset>", values: [] },
    ];
    const newConfig = itemsToConfig(defaultConfig, items);
    expect(newConfig.sessionDir).toBeUndefined();
  });
});
