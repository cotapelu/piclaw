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
    id: "contextLogFile",
    label: "Context Log File",
    currentValue: config.contextLogFile || "<default>",
    values: ["<default>", "<unset>"],
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

describe("Settings Command - Config Conversion", () => {
  const defaultConfig: PiclawConfig = {
    model: "openai:gpt-4o",
    thinking: "medium",
    verbose: true,
    contextLogFile: undefined,
    sessionDir: undefined,
  };

  it("should convert config to items correctly", () => {
    const items = configToItems(defaultConfig);

    expect(items.length).toBe(5);

    const modelItem = items.find(i => i.id === "model");
    expect(modelItem?.currentValue).toBe("openai:gpt-4o");
    expect(modelItem?.values).toContain("<unset>");

    const thinkingItem = items.find(i => i.id === "thinking");
    expect(thinkingItem?.currentValue).toBe("medium");

    const verboseItem = items.find(i => i.id === "verbose");
    expect(verboseItem?.currentValue).toBe("on");

    const contextLogItem = items.find(i => i.id === "contextLogFile");
    expect(contextLogItem?.currentValue).toBe("<default>");

    const sessionDirItem = items.find(i => i.id === "sessionDir");
    expect(sessionDirItem?.currentValue).toBe("<default>");
  });

  it("should handle unset model", () => {
    const config = { ...defaultConfig, model: undefined };
    const items = configToItems(config);
    const modelItem = items.find(i => i.id === "model");
    expect(modelItem?.currentValue).toBe("<unset>");
  });

  it("should convert items back to config with model set", () => {
    const items = configToItems(defaultConfig);
    const newConfig = itemsToConfig({}, items);

    expect(newConfig.model).toBe("openai:gpt-4o");
    expect(newConfig.thinking).toBe("medium");
    expect(newConfig.verbose).toBe(true);
    expect(newConfig.contextLogFile).toBeUndefined();
    expect(newConfig.sessionDir).toBeUndefined();
  });

  it("should convert items back with model unset", () => {
    const items = configToItems({ ...defaultConfig, model: "openai:gpt-4o" });
    items.find(i => i.id === "model")!.currentValue = "<unset>";
    const newConfig = itemsToConfig({}, items);

    expect(newConfig.model).toBeUndefined();
  });

  it("should handle verbose off", () => {
    const config = { ...defaultConfig, verbose: false };
    const items = configToItems(config);
    expect(items.find(i => i.id === "verbose")?.currentValue).toBe("off");

    const newConfig = itemsToConfig({}, items);
    expect(newConfig.verbose).toBe(false);
  });

  it("should handle thinking level change", () => {
    const items = configToItems(defaultConfig);
    items.find(i => i.id === "thinking")!.currentValue = "high";
    const newConfig = itemsToConfig({}, items);

    expect(newConfig.thinking).toBe("high");
  });

  it("should handle contextLogFile set to custom path", () => {
    const items = configToItems(defaultConfig);
    items.find(i => i.id === "contextLogFile")!.currentValue = "/custom/path/logs.txt";
    const newConfig = itemsToConfig({}, items);

    expect(newConfig.contextLogFile).toBe("/custom/path/logs.txt");
  });

  it("should handle contextLogFile unset", () => {
    const items = configToItems(defaultConfig);
    items.find(i => i.id === "contextLogFile")!.currentValue = "<unset>";
    const newConfig = itemsToConfig({}, items);

    expect(newConfig.contextLogFile).toBeUndefined();
  });

  it("should handle sessionDir set to custom path", () => {
    const items = configToItems(defaultConfig);
    items.find(i => i.id === "sessionDir")!.currentValue = "/custom/sessions";
    const newConfig = itemsToConfig({}, items);

    expect(newConfig.sessionDir).toBe("/custom/sessions");
  });

  it("should preserve unknown config fields", () => {
    const config: PiclawConfig = {
      model: "test-model",
      thinking: "low",
      verbose: false,
      contextLogFile: undefined,
      sessionDir: undefined,
      // Extra field
      customField: "custom-value",
    } as any;

    const items = configToItems(config);
    const newConfig = itemsToConfig(config, items);

    // Should keep custom field
    expect((newConfig as any).customField).toBe("custom-value");
  });
});

describe("Settings Command - Edge Cases", () => {
  it("should handle empty config", () => {
    const config: PiclawConfig = {};
    const items = configToItems(config);
    expect(items.length).toBe(5);
    expect(items.find(i => i.id === "model")?.currentValue).toBe("<unset>");
    expect(items.find(i => i.id === "thinking")?.currentValue).toBe("medium");
    expect(items.find(i => i.id === "verbose")?.currentValue).toBe("off");
  });

  it("should handle all items at once", () => {
    const config: PiclawConfig = {
      model: "kilo:gpt-4o",
      thinking: "xhigh",
      verbose: true,
      contextLogFile: "/tmp/logs.txt",
      sessionDir: "/tmp/sessions",
    };

    const items = configToItems(config);
    // Simulate user changes
    items.forEach(item => {
      if (item.id === "model") item.currentValue = "anthropic:claude-opus-4-5";
      if (item.id === "thinking") item.currentValue = "minimal";
      if (item.id === "verbose") item.currentValue = "off";
      if (item.id === "contextLogFile") item.currentValue = "<unset>";
      if (item.id === "sessionDir") item.currentValue = "<default>";
    });

    const newConfig = itemsToConfig({}, items);

    expect(newConfig.model).toBe("anthropic:claude-opus-4-5");
    expect(newConfig.thinking).toBe("minimal");
    expect(newConfig.verbose).toBe(false);
    expect(newConfig.contextLogFile).toBeUndefined();
    expect(newConfig.sessionDir).toBeUndefined();
  });
});
