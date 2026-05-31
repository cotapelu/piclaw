import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { PiclawPackageManager } from "../piclaw-package-manager.js";
import * as pkgCommands from "../package-commands.js";

describe("handleInstallCommand (CLI)", () => {
  let originalHome: string;
  let tempHome: string;
  let cwd: string;
  let agentDir: string;

  beforeEach(() => {
    originalHome = homedir();
    tempHome = join(originalHome, ".piclaw-test-home-install");
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    mkdirSync(tempHome, { recursive: true });
    vi.stubEnv('HOME', tempHome);

    cwd = join(tempHome, "test-project");
    mkdirSync(cwd, { recursive: true });
    agentDir = join(homedir(), ".piclaw", "agent");

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("should return false for non-install command", async () => {
    const result = await pkgCommands.handleInstallCommand(["list"]);
    expect(result).toBe(false);
  });

  it("should show help with -h flag", async () => {
    const result = await pkgCommands.handleInstallCommand(["install", "-h"]);
    expect(result).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Usage: piclaw install"));
  });

  it("should show help with --help flag", async () => {
    const result = await pkgCommands.handleInstallCommand(["install", "--help"]);
    expect(result).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Install a pi package"));
  });

  it("should require source argument", async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(["install"]);
    } catch (e) {}
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Missing install source"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should call pm.installAndPersist with correct options", async () => {
    const installSpy = vi.spyOn(PiclawPackageManager.prototype, 'installAndPersist').mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(["install", "npm:test"]);
    } catch (e) {}
    expect(installSpy).toHaveBeenCalledWith("npm:test", { local: false, dryRun: false });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should pass -l flag as local: true", async () => {
    const installSpy = vi.spyOn(PiclawPackageManager.prototype, 'installAndPersist').mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(["install", "npm:test", "-l"]);
    } catch (e) {}
    expect(installSpy).toHaveBeenCalledWith("npm:test", { local: true, dryRun: false });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should combine source and -l flag", async () => {
    const installSpy = vi.spyOn(PiclawPackageManager.prototype, 'installAndPersist').mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(["install", "git:my/repo", "-l"]);
    } catch (e) {}
    expect(installSpy).toHaveBeenCalledWith("git:my/repo", { local: true, dryRun: false });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should accept -d/--dry-run flag", async () => {
    const installSpy = vi.spyOn(PiclawPackageManager.prototype, 'installAndPersist').mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(["install", "npm:test", "-d"]);
    } catch (e) {}
    expect(installSpy).toHaveBeenCalledWith("npm:test", { local: false, dryRun: true });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should handle pm.installAndPersist error", async () => {
    const installSpy = vi.spyOn(PiclawPackageManager.prototype, 'installAndPersist').mockRejectedValue(new Error('Install failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(["install", "npm:test"]);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('✗ Failed'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should reject unknown option", async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(["install", "--unknown"]);
    } catch (e) {}
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Unknown option"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should include filter when --filter provided", async () => {
    const installSpy = vi.spyOn(PiclawPackageManager.prototype, 'installAndPersist').mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const filterSpec = JSON.stringify({ extensions: ['**/*.ts'], skills: ['**/*.skill'] });
    try {
      await pkgCommands.handleInstallCommand(['install', 'npm:test', '--filter', filterSpec]);
    } catch (e) {}
    expect(installSpy).toHaveBeenCalledWith('npm:test', expect.objectContaining({
      local: false,
      dryRun: false,
      filter: { extensions: ['**/*.ts'], skills: ['**/*.skill'] }
    }));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should reject invalid JSON for --filter", async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(["install", "npm:test", "--filter", "{invalid}"]);
    } catch (e) {}
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Invalid JSON for filter"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // Additional install command tests

  it('should error when --filter missing value', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(['install', 'npm:test', '--filter']);
    } catch (e) {}
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Missing value for --filter'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should error when filter contains invalid keys', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(['install', 'npm:test', '--filter', '{"badkey":[]}']);
    } catch (e) {}
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid filter keys'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should error when filter value is not an array', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(['install', 'npm:test', '--filter', '{"extensions":"notarray"}']);
    } catch (e) {}
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Filter 'extensions' must be an array of strings"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should log progress events (start, complete)', async () => {
    let capturedCb: any;
    const setProgressSpy = vi.spyOn(PiclawPackageManager.prototype, 'setProgressCallback').mockImplementation((cb: any) => {
      capturedCb = cb;
    });
    const installSpy = vi.spyOn(PiclawPackageManager.prototype, 'installAndPersist').mockImplementation(async () => {
      if (capturedCb) {
        capturedCb({ type: 'start', action: 'install', source: 'npm:test' });
        capturedCb({ type: 'complete', action: 'install', source: 'npm:test' });
      }
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    try {
      await pkgCommands.handleInstallCommand(['install', 'npm:test']);
    } catch (e) {}
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⏳ install: npm:test'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ install complete: npm:test'));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should log progress error event', async () => {
    let capturedCb: any;
    const setProgressSpy = vi.spyOn(PiclawPackageManager.prototype, 'setProgressCallback').mockImplementation((cb: any) => {
      capturedCb = cb;
    });
    const installSpy = vi.spyOn(PiclawPackageManager.prototype, 'installAndPersist').mockImplementation(async () => {
      if (capturedCb) {
        capturedCb({ type: 'error', action: 'install', source: 'npm:test', message: 'something broke' });
      }
    });
    try {
      await pkgCommands.handleInstallCommand(['install', 'npm:test']);
    } catch (e) {}
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('❌ install failed: npm:test - something broke'));
  });

});