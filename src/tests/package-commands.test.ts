import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Import the real class
import { PiclawPackageManager } from "../piclaw-package-manager.js";
import * as pkgCommands from "../package-commands.js";

describe("Package Commands (CLI)", () => {
  let originalHome: string;
  let tempHome: string;
  let cwd: string;
  let agentDir: string;

  beforeEach(() => {
    originalHome = homedir();
    tempHome = join(originalHome, ".piclaw-test-home-cmds");
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    mkdirSync(tempHome, { recursive: true });
    vi.stubEnv('HOME', tempHome);

    cwd = join(tempHome, "test-project");
    mkdirSync(cwd, { recursive: true });
    agentDir = join(homedir(), ".piclaw", "agent");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("handleUpdateCommand", () => {
    beforeEach(() => {
      // Spy on console.error and process.exit
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return false for non-update command", async () => {
      const result = await pkgCommands.handleUpdateCommand(["list"]);
      expect(result).toBe(false);
    });

    it("should show help with -h flag", async () => {
      const result = await pkgCommands.handleUpdateCommand(["update", "-h"]);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Usage: piclaw update"));
    });

    it("should show help with --help flag", async () => {
      const result = await pkgCommands.handleUpdateCommand(["update", "--help"]);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Update installed packages"));
    });

    it("should call pm.update for all packages when no source provided", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockResolvedValue(undefined);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit") as any });
      try {
        await pkgCommands.handleUpdateCommand(["update"]);
      } catch (e) {}

      // The constructor should be called and then update called
      expect(updateSpy).toHaveBeenCalledWith(undefined, { local: false, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled(); // success, no exit
    });

    it("should call pm.update with specific source", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockResolvedValue(undefined);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit") as any });
      try {
        await pkgCommands.handleUpdateCommand(["update", "npm:chalk"]);
      } catch (e) {}

      expect(updateSpy).toHaveBeenCalledWith("npm:chalk", { local: false, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should pass -l flag as local: true", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockResolvedValue(undefined);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit") as any });
      try {
        await pkgCommands.handleUpdateCommand(["update", "-l"]);
      } catch (e) {}

      expect(updateSpy).toHaveBeenCalledWith(undefined, { local: true, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should combine source and -l flag", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockResolvedValue(undefined);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit") as any });
      try {
        await pkgCommands.handleUpdateCommand(["update", "git:my/repo", "-l"]);
      } catch (e) {}

      expect(updateSpy).toHaveBeenCalledWith("git:my/repo", { local: true, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should handle pm.update error", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockRejectedValue(new Error("Update failed"));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit") as any });
      try {
        await pkgCommands.handleUpdateCommand(["update"]);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("✗ Failed"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should reject unknown option", async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit") as any });
      try {
        await pkgCommands.handleUpdateCommand(["update", "--unknown"]);
      } catch (e) {}
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Unknown option"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("handleInfoCommand", () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return false for non-info command", async () => {
      const result = await pkgCommands.handleInfoCommand(["list"]);
      expect(result).toBe(false);
    });

    it("should show help with -h", async () => {
      const result = await pkgCommands.handleInfoCommand(["info", "-h"]);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Usage: piclaw info"));
    });

    it("should require source argument", async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit") as any });
      try {
        await pkgCommands.handleInfoCommand(["info"]);
      } catch (e) {}
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Missing package source"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should display package info", async () => {
      vi.spyOn(PiclawPackageManager.prototype, 'listConfiguredPackages').mockReturnValue([
        { source: "npm:test", scope: "user", filtered: false, installedPath: "/path/to/test" }
      ]);
      vi.spyOn(PiclawPackageManager.prototype, 'resolveExtensionSources').mockResolvedValue({
        extensions: [{ path: "/path/to/test/ext.ts", enabled: true, metadata: {} }],
        skills: [],
        prompts: [],
        themes: []
      });

      await pkgCommands.handleInfoCommand(["info", "npm:test"]);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Source: npm:test"));
      expect(console.log).toHaveBeenCalledWith("Scope: user");
      expect(console.log).toHaveBeenCalledWith("Filtered: no");
      expect(console.log).toHaveBeenCalledWith("Installed path: /path/to/test");
      expect(console.log).toHaveBeenCalledWith("Extensions: 1");
    });

    it("should indicate package not found but not error", async () => {
      vi.spyOn(PiclawPackageManager.prototype, 'listConfiguredPackages').mockReturnValue([]);
      vi.spyOn(PiclawPackageManager.prototype, 'resolveExtensionSources').mockResolvedValue({ extensions: [], skills: [], prompts: [], themes: [] });

      await pkgCommands.handleInfoCommand(["info", "npm:missing"]);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("not found"));
    });
  });
});
