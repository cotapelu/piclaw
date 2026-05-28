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
});
