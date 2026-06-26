import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadConfig, saveConfig, getConfigPath, getAgentDir, getBinDir, type PiclawConfig } from "../config/config-manager.js";
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

describe("ConfigManager", () => {
  let originalHome: string;
  let tempHome: string;

  beforeEach(() => {
    originalHome = homedir();
    // Create a temporary home directory for testing
    tempHome = join(originalHome, ".piclaw-test-home");
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    mkdirSync(tempHome, { recursive: true });

    // Stub HOME environment variable to redirect config location
    vi.stubEnv('HOME', tempHome);
  });

  afterEach(() => {
    // Restore HOME
    vi.unstubAllEnvs();

    // Cleanup temp home
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  describe("loadConfig", () => {
    it("should return default config when no config file exists", () => {
      const config = loadConfig();
      expect(config).toEqual({
        model: undefined,
        plugins: { isolate: true },
        thinking: "medium",
        tools: ["read", "bash", "edit", "write", "todos", "memory", "echo", "system-info", "http"],
        sessionDir: undefined,
        verbose: false,
        metricsRetentionDays: 30,
      });
    });

    it("should load config from file", () => {
      const configDir = join(tempHome, ".piclaw");
      mkdirSync(configDir, { recursive: true });
      const testConfig: PiclawConfig = {
        model: "anthropic:claude-opus-4-5",
        thinking: "high",
        tools: ["read", "write", "bash"],
        verbose: true,
      };
      writeFileSync(join(configDir, "config.json"), JSON.stringify(testConfig, null, 2));

      const config = loadConfig();
      expect(config).toEqual({
        model: "anthropic:claude-opus-4-5",
        thinking: "high",
        tools: ["read", "write", "bash"],
        sessionDir: undefined,
        verbose: true,
      });
    });

    it("should fallback to default thinking level if invalid", () => {
      const configDir = join(tempHome, ".piclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "config.json"), JSON.stringify({ thinking: "invalid" }, null, 2));

      const config = loadConfig();
      expect(config.thinking).toBe("medium");
    });

    it('should fallback to default model if invalid format', () => {
      const configDir = join(tempHome, '.piclaw');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'config.json'), JSON.stringify({ model: 'invalid-model' }, null, 2));

      const config = loadConfig();
      expect(config.model).toBe(undefined);
    });

    it('should fallback default keybindings if invalid type', () => {
      const configDir = join(tempHome, '.piclaw');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'config.json'), JSON.stringify({ keybindings: 'not-an-object' }, null, 2));

      const config = loadConfig();
      expect(config.keybindings).toBeUndefined();
    });

    it('should validate keybindings values (non-empty strings)', () => {
      const configDir = join(tempHome, '.piclaw');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'config.json'), JSON.stringify({
        keybindings: { cmd1: '', cmd2: '  ', cmd3: 'valid' }
      }, null, 2));

      const config = loadConfig();
      expect(config.keybindings).toBeUndefined();
    });

    it('should fallback to default metricsRetentionDays if invalid', () => {
      const configDir = join(tempHome, '.piclaw');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'config.json'), JSON.stringify({ metricsRetentionDays: -5 }, null, 2));

      const config = loadConfig();
      expect(config.metricsRetentionDays).toBe(30);
    });

    it('should accept valid metricsRetentionDays', () => {
      const configDir = join(tempHome, '.piclaw');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'config.json'), JSON.stringify({ metricsRetentionDays: 60 }, null, 2));

      const config = loadConfig();
      expect(config.metricsRetentionDays).toBe(60);
    });

    it('should merge CLI overrides on top of file config', () => {
      const configDir = join(tempHome, ".piclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "config.json"), JSON.stringify({
        model: "anthropic:claude-opus-4-5",
        thinking: "low",
      }, null, 2));

      const cliOverrides: Partial<PiclawConfig> = { model: "openai:gpt-4" };
      const config = loadConfig(cliOverrides);
      expect(config.model).toBe("openai:gpt-4"); // CLI override
      expect(config.thinking).toBe("low"); // from file
    });

    it("should create config directory if missing", () => {
      // No need to manually create .piclaw dir; loadConfig should create it
      const configDir = join(tempHome, ".piclaw");
      expect(existsSync(configDir)).toBe(false);

      loadConfig();

      expect(existsSync(configDir)).toBe(true);
    });

    it("should handle malformed JSON in config file", () => {
      const configDir = join(tempHome, ".piclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "config.json"), "{ invalid json");

      // Should not throw, and return defaults
      const config = loadConfig();
      expect(config).toEqual({
        model: undefined,
        plugins: { isolate: true },
        thinking: "medium",
        tools: ["read", "bash", "edit", "write", "todos", "memory", "echo", "system-info", "http"],
        sessionDir: undefined,
        verbose: false,
        metricsRetentionDays: 30,
      });
    });
  });

  describe("saveConfig", () => {
    it("should save config to file", async () => {
      const configDir = join(tempHome, ".piclaw");
      mkdirSync(configDir, { recursive: true });

      const testConfig: PiclawConfig = {
        model: "openai:gpt-4",
        thinking: "xhigh",
        tools: ["read", "grep"],
        verbose: true,
      };
      await saveConfig(testConfig);

      const savedContent = readFileSync(join(configDir, "config.json"), "utf-8");
      const parsed = JSON.parse(savedContent);
      expect(parsed).toEqual(testConfig);
    });

    it("should create config directory if missing", async () => {
      const configDir = join(tempHome, ".piclaw");
      expect(existsSync(configDir)).toBe(false);

      await saveConfig({});

      expect(existsSync(configDir)).toBe(true);
      expect(existsSync(join(configDir, "config.json"))).toBe(true);
    });
  });

  describe("getConfigPath", () => {
    it("should return correct path", () => {
      const path = getConfigPath();
      expect(path).toContain(".piclaw");
      expect(path).toContain("config.json");
      expect(path).toContain(tempHome);
    });
  });

  describe("getAgentDir", () => {
    beforeEach(() => {
      // Ensure no leftover env
      vi.unstubAllEnvs();
    });

    it("should return default path when PICLAW_AGENT_DIR not set", () => {
      vi.unstubAllEnvs(); // ensure env not set
      const dir = getAgentDir();
      const expected = join(homedir(), ".piclaw", "agent");
      expect(dir).toBe(expected);
    });

    it("should resolve '~' to home directory", () => {
      vi.stubEnv('PICLAW_AGENT_DIR', '~');
      const dir = getAgentDir();
      expect(dir).toBe(homedir());
    });

    it("should resolve '~/subdir' to home + subdir", () => {
      vi.stubEnv('PICLAW_AGENT_DIR', '~/myagent');
      const dir = getAgentDir();
      expect(dir).toBe(join(homedir(), 'myagent'));
    });

    it("should handle absolute path without tilde", () => {
      vi.stubEnv('PICLAW_AGENT_DIR', '/custom/agent');
      const dir = getAgentDir();
      expect(dir).toBe('/custom/agent');
    });
  });

  describe("getBinDir", () => {
    it("should return agentDir + '/bin'", () => {
      // Use a custom agent dir to control output
      vi.stubEnv('PICLAW_AGENT_DIR', '/tmp/agent');
      const binDir = getBinDir();
      expect(binDir).toBe('/tmp/agent/bin');
    });
  });
});
