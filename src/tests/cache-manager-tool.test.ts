#!/usr/bin/env node
/**
 * Cache Manager Tool Tests
 *
 * Tests CacheManager class (core logic) and the execute wrapper.
 */

import { test, expect, describe, beforeEach, afterEach } from "vitest";
import { CacheManager } from "../extensions/tools/cache-manager-tool.js";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Helper: create minimal ExtensionContext
function createContext(cwd: string): ExtensionContext {
  return {
    ui: {} as any,
    mode: "tui",
    hasUI: true,
    cwd,
    sessionManager: {} as any,
    modelRegistry: {} as any,
    model: undefined,
    isIdle: () => true,
    isProjectTrusted: () => true,
    signal: undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  };
}

// Helper to clear cache files
function clearCacheDir(cwd: string): void {
  const dir = join(cwd, ".piclaw", "agent");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

describe("CacheManager", () => {
  let cwd: string;
  let ctx: ExtensionContext;

  beforeEach(() => {
    cwd = join(tmpdir(), "cache-mgr-test-" + Date.now());
    mkdirSync(cwd, { recursive: true });
    clearCacheDir(cwd);
    ctx = createContext(cwd);
  });

  afterEach(() => {
    clearCacheDir(cwd);
    try { rmSync(cwd, { recursive: true, force: true }); } catch {}
  });

  test("set and get", async () => {
    const mgr = new CacheManager(cwd);
    await mgr.set("k1", "v1");
    const g = await mgr.get("k1");
    expect(g.found).toBe(true);
    expect(g.value).toBe("v1");
  });

  test("get missing returns not found", async () => {
    const mgr = new CacheManager(cwd);
    const g = await mgr.get("missing");
    expect(g.found).toBe(false);
  });

  test("delete removes key", async () => {
    const mgr = new CacheManager(cwd);
    await mgr.set("k", "v");
    const del = await mgr.delete("k");
    expect(del).toBe(true);
    const g = await mgr.get("k");
    expect(g.found).toBe(false);
  });

  test("clear empties cache", async () => {
    const mgr = new CacheManager(cwd);
    await mgr.set("a", 1);
    await mgr.set("b", 2);
    await mgr.clear();
    const keys = await mgr.keys();
    expect(keys.length).toBe(0);
  });

  test("keys with pattern", async () => {
    const mgr = new CacheManager(cwd);
    await mgr.set("user:1", 1);
    await mgr.set("user:2", 2);
    await mgr.set("config", 3);
    const userKeys = await mgr.keys("user:*");
    expect(userKeys.sort()).toEqual(["user:1", "user:2"]);
  });

  test("stats", async () => {
    const mgr = new CacheManager(cwd);
    await mgr.set("x", "val");
    const s = await mgr.stats();
    expect(s.total).toBe(1);
    expect(s.expired).toBe(0);
    expect(s.memoryUsageBytes).toBeGreaterThan(0);
  });

  test("TTL expiration", async () => {
    const mgr = new CacheManager(cwd);
    await mgr.set("temp", "data", 50);
    let g = await mgr.get("temp");
    expect(g.found).toBe(true);
    await new Promise(r => setTimeout(r, 70));
    g = await mgr.get("temp");
    expect(g.found).toBe(false);
    expect(g.expired).toBe(true);
  });

  test("cleanupExpired removes expired", async () => {
    const mgr = new CacheManager(cwd);
    await mgr.set("short", 1, 30);
    await mgr.set("long", 2, 500);
    await new Promise(r => setTimeout(r, 100));
    const removed = await mgr.cleanupExpired();
    expect(removed).toBe(1);
    const stats = await mgr.stats();
    expect(stats.total).toBe(1);
    const g = await mgr.get("long");
    expect(g.found).toBe(true);
  });

  test("persistence: loadFromFile restores entries", async () => {
    // Create manager, set some keys
    const mgr1 = new CacheManager(cwd);
    await mgr1.set("a", 1);
    await mgr1.set("b", 2);
    await mgr1.saveToFile();

    // New manager loads
    const mgr2 = new CacheManager(cwd);
    const loaded = await mgr2.loadFromFile();
    expect(loaded).toBe(true);
    const ga = await mgr2.get("a");
    expect(ga.found).toBe(true);
    expect(ga.value).toBe(1);
    const gb = await mgr2.get("b");
    expect(gb.found).toBe(true);
    expect(gb.value).toBe(2);
  });

  test("persistence skips expired entries on load", async () => {
    const mgr1 = new CacheManager(cwd);
    await mgr1.set("ephemeral", "data", 50);
    await new Promise(r => setTimeout(r, 80));
    // Save will persist all, but load should skip expired
    await mgr1.saveToFile();

    const mgr2 = new CacheManager(cwd);
    const loaded = await mgr2.loadFromFile();
    expect(loaded).toBe(true);
    const g = await mgr2.get("ephemeral");
    expect(g.found).toBe(false);
  });
});

describe("Cache Manager Tool Execute", () => {
  let cwd: string;
  let ctx: ExtensionContext;

  beforeEach(() => {
    cwd = join(tmpdir(), "cache-exe-" + Date.now());
    mkdirSync(cwd, { recursive: true });
    clearCacheDir(cwd);
    ctx = createContext(cwd);
  });

  afterEach(() => {
    clearCacheDir(cwd);
    try { rmSync(cwd, { recursive: true, force: true }); } catch {}
  });

  // Import the tool execute function directly
  let executeFn: any;
  beforeAll(async () => {
    const mod = await import("../extensions/tools/cache-manager-tool.js");
    executeFn = mod.executeCacheManager;
  });

  test("action set and get via execute", async () => {
    await executeFn("id1", { action: "set", key: "foo", value: "bar" }, undefined, undefined, ctx);
    const res = await executeFn("id2", { action: "get", key: "foo" }, undefined, undefined, ctx);
    expect(res.isError).toBe(false);
    expect(res.details.found).toBe(true);
    expect(res.details.value).toBe("bar");
  });

  test("execute returns error for invalid action", async () => {
    const res = await executeFn("id1", { action: "bogus" }, undefined, undefined, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Invalid action");
  });

  test("execute stats returns numbers", async () => {
    await executeFn("s1", { action: "set", key: "x", value: 1 }, undefined, undefined, ctx);
    const res = await executeFn("s2", { action: "stats" }, undefined, undefined, ctx);
    expect(res.isError).toBe(false);
    expect(res.details.total).toBe(1);
  });
});
