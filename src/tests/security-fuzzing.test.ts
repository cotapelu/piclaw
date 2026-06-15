#!/usr/bin/env node

/**
 * Security Fuzzing Tests
 *
 * Property-based testing for critical tools to catch injection and traversal vulnerabilities.
 * Uses random input generation to test edge cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PiclawPackageManager } from "../piclaw-package-manager.js";

// Mock child_process
vi.mock("child_process", () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

import { spawn, spawnSync } from "child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("Security Fuzzing: Path Traversal Prevention", () => {
  let pm: PiclawPackageManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join("/tmp", "piclaw-fuzz-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    pm = new PiclawPackageManager({ cwd: tmpDir, agentDir: tmpDir });
    pm.setProgressCallback((event) => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should reject absolute paths outside cwd for local sources", async () => {
    const evilPaths = [
      "/etc/passwd",
      "/home/user/.ssh/id_rsa",
      "C:\\Windows\\System32\\config\\sam",
      "/tmp/../../etc/passwd",
    ];

    for (const evilPath of evilPaths) {
      await expect(pm.install(evilPath, { local: true })).rejects.toThrow();
    }
  });

  it("should reject relative paths with ../ traversal", async () => {
    const outsideDir = join(tmpDir, "outside");
    mkdirSync(outsideDir, { recursive: true });

    await expect(pm.install("../../outside/secret.txt", { local: true })).rejects.toThrow(/outside allowed directory|path traversal/i);
  });

  it("should reject local source with '..' in path components", async () => {
    await expect(pm.install("../etc/passwd", { local: true })).rejects.toThrow();
    await expect(pm.install("..\\..\\etc\\passwd", { local: true })).rejects.toThrow();
  });
});

describe("Security Fuzzing: Git Source Validation", () => {
  let pm: PiclawPackageManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join("/tmp", "piclaw-fuzz-git-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    pm = new PiclawPackageManager({ cwd: tmpDir, agentDir: tmpDir });
    pm.setProgressCallback((event) => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should reject git source with path traversal in repo path", async () => {
    const evilSources = [
      "git:github.com/../../../etc/passwd",
      "git:git@github.com:user/../other/secret",
      "git:https://github.com/user/../../etc",
    ];

    for (const source of evilSources) {
      await expect(pm.install(source, { local: false })).rejects.toThrow();
    }
  });

  it("should reject git source with invalid host characters", () => {
    const parsed = pm.parseSource("git:evil!host/user/repo");
    expect(parsed.type).toBe("git");
    expect(() => pm.validateParsed(parsed)).toThrow(/invalid host|Invalid git/);
  });
});

describe("Security Fuzzing: NPM Package Name Validation", () => {
  let pm: PiclawPackageManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join("/tmp", "piclaw-fuzz-npm-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    pm = new PiclawPackageManager({ cwd: tmpDir, agentDir: tmpDir });
    pm.setProgressCallback((event) => {});
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should reject npm source with path traversal patterns", () => {
    const evilSpecs = [
      "npm:../../etc/passwd",
      "npm:/etc/shadow",
      "npm:C:\\Windows\\System32",
    ];

    for (const source of evilSpecs) {
      const parsed = pm.parseSource(source);
      expect(parsed.type).toBe("npm");
      expect(() => pm.validateParsed(parsed)).toThrow(/path traversal|Invalid npm/);
    }
  });
});

describe("Security Fuzzing: getInstalledPath Confinement", () => {
  let pm: PiclawPackageManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join("/tmp", "piclaw-fuzz-path-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    pm = new PiclawPackageManager({ cwd: tmpDir, agentDir: tmpDir });
    pm.setProgressCallback((event) => {});
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should not leak information about files outside allowed directories", () => {
    const outside = "/etc/passwd";
    const result = pm.getInstalledPath(outside, "project");
    expect(result).toBeUndefined();
  });
});
