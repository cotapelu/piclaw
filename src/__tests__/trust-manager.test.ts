import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TrustManager } from "../trust-manager.js";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("TrustManager", () => {
  let agentDir: string;
  let trustManager: TrustManager;

  beforeEach(() => {
    // Create temp agent directory
    agentDir = join(tmpdir(), `piclaw-test-${Date.now()}`);
    mkdirSync(agentDir, { recursive: true });
    trustManager = new TrustManager(agentDir);
  });

  afterEach(() => {
    // Cleanup trust store file if exists
    const storePath = trustManager["getStorePath"]();
    if (existsSync(storePath)) {
      unlinkSync(storePath);
    }
  });

  describe("load()", () => {
    it("should return empty object when store file doesn't exist", () => {
      const store = trustManager["load"]();
      expect(store).toEqual({});
    });

    it("should load existing trust store", () => {
      const storePath = trustManager["getStorePath"]();
      const testData = { "/test/path": { trusted: true, timestamp: 123456 } };
      writeFileSync(storePath, JSON.stringify(testData), "utf-8");

      const store = trustManager["load"]();
      expect(store).toEqual(testData);
    });

    it("should return empty object on corrupt JSON", () => {
      const storePath = trustManager["getStorePath"]();
      writeFileSync(storePath, "invalid{json", "utf-8");

      // Should not throw, just return empty
      const store = trustManager["load"]();
      expect(store).toEqual({});
    });
  });

  describe("save()", () => {
    it("should create directory if not exists", () => {
      const storePath = trustManager["getStorePath"]();
      expect(existsSync(storePath)).toBe(false);

      trustManager["store"]["/test"] = { trusted: true, timestamp: Date.now() };
      trustManager["save"]();

      expect(existsSync(storePath)).toBe(true);
    });

    it("should write valid JSON", () => {
      trustManager.setTrust("/test/project", true);
      const storePath = trustManager["getStorePath"]();
      const content = readFileSync(storePath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty("/test/project");
      expect(parsed["/test/project"].trusted).toBe(true);
      expect(typeof parsed["/test/project"].timestamp).toBe("number");
    });
  });

  describe("hasTrustInputs()", () => {
    it("should detect AGENTS.md", () => {
      const cwd = join(agentDir, "project");
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS", "utf-8");

      expect(trustManager.hasTrustInputs(cwd)).toBe(true);
    });

    it("should detect CLAUDE.md", () => {
      const cwd = join(agentDir, "project");
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, "CLAUDE.md"), "# CLAUDE", "utf-8");

      expect(trustManager.hasTrustInputs(cwd)).toBe(true);
    });

    it("should detect .piclaw/ directory", () => {
      const cwd = join(agentDir, "project");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });

      expect(trustManager.hasTrustInputs(cwd)).toBe(true);
    });

    it("should return false if no trust inputs", () => {
      const cwd = join(agentDir, "empty-project");
      mkdirSync(cwd, { recursive: true });

      expect(trustManager.hasTrustInputs(cwd)).toBe(false);
    });

    it("should return true if multiple trust inputs exist", () => {
      const cwd = join(agentDir, "project");
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS", "utf-8");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });

      expect(trustManager.hasTrustInputs(cwd)).toBe(true);
    });
  });

  describe("getCachedTrust() / setTrust()", () => {
    it("should return null for unknown project", () => {
      expect(trustManager.getCachedTrust("/unknown")).toBeNull();
    });

    it("should store and retrieve trust decision", () => {
      trustManager.setTrust("/project1", true);
      expect(trustManager.getCachedTrust("/project1")).toBe(true);

      trustManager.setTrust("/project2", false);
      expect(trustManager.getCachedTrust("/project2")).toBe(false);
    });

    it("should persist across instances", () => {
      trustManager.setTrust("/project", true);

      const newManager = new TrustManager(agentDir);
      expect(newManager.getCachedTrust("/project")).toBe(true);
    });
  });

  describe("resolve()", () => {
    it("should respect force override", async () => {
      const result = await trustManager.resolve("/test", { interactive: false, force: true });
      expect(result).toBe(true);

      const result2 = await trustManager.resolve("/test", { interactive: false, force: false });
      expect(result2).toBe(false);
    });

    it("should use cached decision when available", async () => {
      trustManager.setTrust("/cached", true);

      const result = await trustManager.resolve("/cached", { interactive: false });
      expect(result).toBe(true);
    });

    it("should auto-trust when no trust inputs", async () => {
      const cwd = join(agentDir, "no-inputs");
      mkdirSync(cwd, { recursive: true });

      const result = await trustManager.resolve(cwd, { interactive: false });
      expect(result).toBe(true);
    });

    it("should default false in non-interactive mode when has trust inputs", async () => {
      const cwd = join(agentDir, "with-inputs");
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS", "utf-8");

      const result = await trustManager.resolve(cwd, { interactive: false });
      expect(result).toBe(false);
    });

    it("should prompt user in interactive mode", async () => {
      const cwd = join(agentDir, "interactive");
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS", "utf-8");

      // Mock promptUser to return true
      const mockPrompt = vi.spyOn(trustManager as any, "promptUser").mockResolvedValue(true);

      const result = await trustManager.resolve(cwd, { interactive: true });
      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalled();

      mockPrompt.mockRestore();
    });

    it("should save trust decision after interactive prompt", async () => {
      const cwd = join(agentDir, "save-test");
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS", "utf-8");

      const mockPrompt = vi.spyOn(trustManager as any, "promptUser").mockResolvedValue(false);

      await trustManager.resolve(cwd, { interactive: true });

      expect(trustManager.getCachedTrust(cwd)).toBe(false);
      mockPrompt.mockRestore();
    });
  });

  // Skipping promptUser tests - requires complex readline mocking
  // The interactive flow is tested indirectly via resolve() with mock

});
