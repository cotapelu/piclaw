import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { PiclawPackageManager } from "../piclaw-package-manager.js";

describe("Integration Flow (Install → Resolve → Remove)", () => {
  let originalHome: string;
  let tempHome: string;
  let cwd: string;
  let agentDir: string;

  beforeEach(() => {
    originalHome = homedir();
    tempHome = join(originalHome, ".piclaw-test-integration");
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

  it("should install, resolve, and remove a local package", async () => {
    // Create dummy package structure
    const pkgRoot = join(cwd, "dummy-pkg");
    mkdirSync(pkgRoot, { recursive: true });
    const extDir = join(pkgRoot, "extensions");
    mkdirSync(extDir, { recursive: true });
    const extFile = join(extDir, "my-ext.ts");
    writeFileSync(extFile, "export default {};");

    const pkgJson = join(pkgRoot, "package.json");
    writeFileSync(pkgJson, JSON.stringify({ name: "dummy-pkg", version: "1.0.0" }));

    const pm = new PiclawPackageManager({ cwd, agentDir });

    // Install
    await pm.installAndPersist(pkgRoot, { local: true });

    // Verify settings
    const settingsPath = join(cwd, ".piclaw", "settings.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const sourceEntry = Array.isArray(settings.packages)
      ? settings.packages.find((p: any) => (typeof p === "string" ? p : p.source) === pkgRoot)
      : undefined;
    expect(sourceEntry).toBeDefined();

    // Resolve extensions
    const resolved = await pm.resolveExtensionSources([pkgRoot], { local: true });
    expect(resolved.extensions).toHaveLength(1);
    expect(resolved.extensions[0].path).toBe(extFile);
    expect(resolved.extensions[0].enabled).toBe(true);
    expect(resolved.extensions[0].metadata.source).toBe(pkgRoot);
    expect(resolved.extensions[0].metadata.scope).toBe("project");
    expect(resolved.extensions[0].metadata.origin).toBe("package");

    // Remove
    await pm.removeAndPersist(pkgRoot, { local: true });

    // Verify removal from settings
    const updatedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const stillExists = (updatedSettings.packages || []).some((p: any) => (typeof p === "string" ? p : p.source) === pkgRoot);
    expect(stillExists).toBe(false);

    // Verify package no longer in configured list
    const configured = pm.listConfiguredPackages();
    expect(configured.some(p => p.source === pkgRoot)).toBe(false);
  });

  it("should handle install failure and propagate error correctly", async () => {
    const pm = new PiclawPackageManager({ cwd, agentDir });

    // Spy on internal runCommand to simulate failure
    const runCommandSpy = vi.spyOn(pm as any, 'runCommand').mockRejectedValue(new Error("npm command failed with code 1"));

    // Attempt to install an npm package (not local, as we want to trigger runCommand)
    await expect(pm.install("npm:test-pkg")).rejects.toThrow("npm command failed with code 1");

    expect(runCommandSpy).toHaveBeenCalledWith("npm", expect.arrayContaining(["install", "-g", "test-pkg"]), expect.anything());

    runCommandSpy.mockRestore();
  });

  it("should handle update failure with transient errors and retry", async () => {
    const pm = new PiclawPackageManager({ cwd, agentDir });

    // Add a package to settings so update will try to process it
    pm.addSourceToSettings("npm:test-pkg", { local: false });

    // Create fake installed path to pass existence check
    const fakeInstallPath = join(cwd, ".piclaw", "npm", "node_modules", "test-pkg");
    mkdirSync(fakeInstallPath, { recursive: true });
    writeFileSync(join(fakeInstallPath, "package.json"), JSON.stringify({ version: "1.0.0" }));

    // Spy on getNpmInstallPath to return fake path
    const getPathSpy = vi.spyOn(pm as any, 'getNpmInstallPath').mockReturnValue(fakeInstallPath);
    // Mock getInstalledNpmVersion
    const getInstalledSpy = vi.spyOn(pm as any, 'getInstalledNpmVersion').mockReturnValue("1.0.0");
    // Mock getLatestNpmVersion to succeed with newer version
    const getLatestSpy = vi.spyOn(pm as any, 'getLatestNpmVersion').mockResolvedValue("2.0.0");

    // Mock runCommand (low-level) to simulate transient errors
    const runCommandSpy = vi.spyOn(pm as any, 'runCommand')
      .mockRejectedValueOnce(new Error("network error"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(undefined);

    await pm.update(undefined, { local: false });

    // Expect that runCommand was called 3 times (initial + 2 retries)
    expect(runCommandSpy).toHaveBeenCalledTimes(3);
    // Check that the args for npm install are correct (user scope uses -g)
    expect(runCommandSpy).toHaveBeenCalledWith("npm", ["install", "-g", "test-pkg", "--no-audit", "--no-fund"], { cwd: undefined });

    getPathSpy.mockRestore();
    getInstalledSpy.mockRestore();
    getLatestSpy.mockRestore();
    runCommandSpy.mockRestore();
  });

  it("should handle resolve when package not installed and continue with others", async () => {
    const pm = new PiclawPackageManager({ cwd, agentDir });

    // Add two packages: one that exists (local dummy), one that doesn't (npm not installed)
    const dummyPkgRoot = join(cwd, "dummy-pkg");
    mkdirSync(dummyPkgRoot, { recursive: true });
    mkdirSync(join(dummyPkgRoot, "extensions"), { recursive: true });
    writeFileSync(join(dummyPkgRoot, "extensions", "ext.ts"), "");
    writeFileSync(join(dummyPkgRoot, "package.json"), JSON.stringify({ name: "dummy" }));

    pm.addSourceToSettings(dummyPkgRoot, { local: true });
    pm.addSourceToSettings("npm:nonexistent-pkg", { local: false });

    // Resolve should succeed and only include the local package
    const resolved = await pm.resolve();
    expect(resolved.extensions).toHaveLength(1);
    expect(resolved.extensions[0].metadata.source).toBe(dummyPkgRoot);
  });
});
