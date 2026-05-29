import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleUpdateCommand(["update"]);
      } catch (e) {}

      // The constructor should be called and then update called
      expect(updateSpy).toHaveBeenCalledWith(undefined, { local: false, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled(); // success, no exit
    });

    it("should call pm.update with specific source", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockResolvedValue(undefined);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleUpdateCommand(["update", "npm:chalk"]);
      } catch (e) {}

      expect(updateSpy).toHaveBeenCalledWith("npm:chalk", { local: false, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should pass -l flag as local: true", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockResolvedValue(undefined);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleUpdateCommand(["update", "-l"]);
      } catch (e) {}

      expect(updateSpy).toHaveBeenCalledWith(undefined, { local: true, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should combine source and -l flag", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockResolvedValue(undefined);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleUpdateCommand(["update", "git:my/repo", "-l"]);
      } catch (e) {}

      expect(updateSpy).toHaveBeenCalledWith("git:my/repo", { local: true, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should handle pm.update error", async () => {
      const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockRejectedValue(new Error("Update failed"));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleUpdateCommand(["update"]);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("✗ Failed"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should reject unknown option", async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
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
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
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
        extensions: [{ path: "/path/to/test/ext.ts", enabled: true, metadata: { source: "npm:test", scope: "user", origin: "package" } }],
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

  describe("handleRemoveCommand", () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return false for non-remove command", async () => {
      const result = await pkgCommands.handleRemoveCommand(["list"]);
      expect(result).toBe(false);
    });

    it("should show help with -h flag", async () => {
      const result = await pkgCommands.handleRemoveCommand(["remove", "-h"]);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Usage: piclaw remove"));
    });

    it("should show help with --help flag", async () => {
      const result = await pkgCommands.handleRemoveCommand(["remove", "--help"]);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Remove a package"));
    });

    it("should require source argument", async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleRemoveCommand(["remove"]);
      } catch (e) {}
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Missing remove source"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should call pm.removeAndPersist correctly", async () => {
      const removeSpy = vi.spyOn(PiclawPackageManager.prototype, 'removeAndPersist').mockResolvedValue(undefined);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleRemoveCommand(["remove", "npm:test", "-l"]);
      } catch (e) {}
      expect(removeSpy).toHaveBeenCalledWith("npm:test", { local: true, dryRun: false });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should handle remove error", async () => {
      const removeSpy = vi.spyOn(PiclawPackageManager.prototype, 'removeAndPersist').mockRejectedValue(new Error("Remove failed"));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleRemoveCommand(["remove", "npm:test"]);
      } catch (e) {}
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("✗ Failed"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should show dry-run message when dry-run flag", async () => {
      const removeSpy = vi.spyOn(PiclawPackageManager.prototype, 'removeAndPersist').mockResolvedValue(undefined);
      await pkgCommands.handleRemoveCommand(["remove", "npm:test", "-d"]);
      // Check that dry-run message appears after successful call
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("[DRY-RUN] Simulated removal"));
      // Should not show regular success
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("✓ Removed"));
    });
  });

  describe("handleHealthCommand", () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return false for non-health command", async () => {
      const result = await pkgCommands.handleHealthCommand(["list"]);
      expect(result).toBe(false);
    });
  });

  describe("handlePinCommand", () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return false for non-pin command", async () => {
      const result = await pkgCommands.handlePinCommand(["list"]);
      expect(result).toBe(false);
    });

    it("should require both old and new sources", async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handlePinCommand(["pin", "npm:foo@1.0"]);
      } catch (e) {}
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Missing arguments"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should pin successfully", async () => {
      const settingsPath = join(cwd, ".piclaw", "settings.json");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({ packages: ["npm:bar@1.0"] }));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handlePinCommand(["pin", "npm:bar@1.0", "npm:bar@2.0", "-l"]);
      } catch (e) {
        // Should not throw
        console.error("Unexpected error:", e);
      }
      // Debug: if exit was called, log error messages
      if (exitSpy) {
        const calls = (console.error as any).mock.calls;
        if (calls && calls.length > 0) {
          console.log('console.error calls:', calls);
        }
      }
      expect(console.error).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();

      const updated = JSON.parse(readFileSync(settingsPath, "utf-8"));
      expect(updated.packages).toContain("npm:bar@2.0");
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("✓ Pinned"));
    });

    it("should fail when old source not found", async () => {
      const settingsPath = join(cwd, ".piclaw", "settings.json");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({ packages: ["npm:other@1.0"] }));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handlePinCommand(["pin", "npm:missing@1.0", "npm:new@2.0", "-l"]);
      } catch (e) {}
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Old source not found"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("handleExportCommand", () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return false for non-export command", async () => {
      const result = await pkgCommands.handleExportCommand(["list"]);
      expect(result).toBe(false);
    });

    it("should export to stdout when no file specified", async () => {
      const settingsPath = join(cwd, ".piclaw", "settings.json");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({ packages: ["npm:a", "git:b"] }));

      // Mock process.stdout.write to capture output
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      await pkgCommands.handleExportCommand(["export", "-l"]);

      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"npm:a"'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Exported 2 packages'));
    });

    it("should export to file when provided", async () => {
      const settingsPath = join(cwd, ".piclaw", "settings.json");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({ packages: ["npm:x"] }));

      const outFile = join(cwd, "out.json");
      await pkgCommands.handleExportCommand(["export", outFile, "-l"]);

      expect(existsSync(outFile)).toBe(true);
      const content = readFileSync(outFile, "utf-8");
      expect(JSON.parse(content)).toContain("npm:x");
    });

    it("should export from project settings when -l flag", async () => {
      const settingsPath = join(cwd, ".piclaw", "settings.json");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({ packages: ["npm:proj"] }));

      const outFile = join(cwd, "proj.json");
      await pkgCommands.handleExportCommand(["export", outFile, "-l"]);

      expect(existsSync(outFile)).toBe(true);
      const content = readFileSync(outFile, "utf-8");
      expect(content).toContain("npm:proj");
    });
  });

  describe("handleImportCommand", () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return false for non-import command", async () => {
      const result = await pkgCommands.handleImportCommand(["list"]);
      expect(result).toBe(false);
    });

    it("should require input file", async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error("exit"); });
      try {
        await pkgCommands.handleImportCommand(["import"]);
      } catch (e) {}
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Missing input file"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should import from file", async () => {
      const settingsPath = join(cwd, ".piclaw", "settings.json");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });
      // Initially empty settings
      writeFileSync(settingsPath, JSON.stringify({ packages: [] }));

      const inFile = join(cwd, "in.json");
      writeFileSync(inFile, JSON.stringify(["npm:new1", "git:new2"]));

      await pkgCommands.handleImportCommand(["import", inFile, "-l"]);

      const updated = JSON.parse(readFileSync(settingsPath, "utf-8"));
      expect(updated.packages).toContain("npm:new1");
      expect(updated.packages).toContain("git:new2");
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Imported 2 new packages"));
    });

    it("should skip duplicates", async () => {
      const settingsPath = join(cwd, ".piclaw", "settings.json");
      mkdirSync(join(cwd, ".piclaw"), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({ packages: ["npm:existing"] }));

      const inFile = join(cwd, "in.json");
      writeFileSync(inFile, JSON.stringify(["npm:existing", "npm:new"]));

      await pkgCommands.handleImportCommand(["import", inFile, "-l"]);

      const updated = JSON.parse(readFileSync(settingsPath, "utf-8"));
      // Should not add duplicate
      expect(updated.packages.filter((p: any) => (typeof p === 'string' ? p : p.source) === 'npm:existing')).toHaveLength(1);
      expect(updated.packages).toContain("npm:new");
    });
  });

});
