import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saveConfig, getConfigPath } from "../config/config-manager.js";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

describe("ConfigManager Concurrency", () => {
  let originalHome: string;
  let tempHome: string;

  beforeEach(() => {
    originalHome = homedir();
    tempHome = join(originalHome, ".piclaw-test-home-conc");
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    mkdirSync(tempHome, { recursive: true });
    vi.stubEnv('HOME', tempHome);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it("should serialize concurrent saves without corruption", async () => {
    const config1 = {
      model: "anthropic:claude-3",
      thinking: "low" as const,
      tools: ["read", "bash"],
      verbose: false,
    };
    const config2 = {
      model: "openai:gpt-4",
      thinking: "high" as const,
      tools: ["write", "edit"],
      verbose: true,
    };

    // Initiate both saves concurrently; the mutation queue should serialize them
    await Promise.all([
      saveConfig(config1),
      saveConfig(config2),
    ]);

    const configPath = getConfigPath();
    expect(existsSync(configPath)).toBe(true);
    const content = readFileSync(configPath, "utf-8");
    const saved = JSON.parse(content);

    // The final config should be either config1 or config2; both acceptable due to ordering,
    // but file must contain a valid JSON equal to one of the inputs.
    const matchesCfg1 = JSON.stringify(saved) === JSON.stringify(config1);
    const matchesCfg2 = JSON.stringify(saved) === JSON.stringify(config2);
    expect(matchesCfg1 || matchesCfg2).toBe(true);
  });
});
