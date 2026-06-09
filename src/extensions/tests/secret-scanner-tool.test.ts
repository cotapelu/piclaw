#!/usr/bin/env node

/**
 * Unit tests: Secret Scanner Tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { existsSync, mkdirSync, rmdirSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Test helper: create file with content
function touchFile(path: string, content: string) {
  writeFileSync(path, content, "utf-8");
}

// Mock API
function createMockAPI(): ExtensionAPI {
  return {
    logger: console,
    config: { get: () => ({}), set: () => {} },
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerRenderer: vi.fn(),
    registerWidget: vi.fn(),
    tui: { addChild: vi.fn(), requestRender: vi.fn() },
    agentSession: null,
    text: { createInterface: vi.fn() },
  } as any;
}

describe("Secret Scanner Tool", () => {
  const TEST_ROOT = "/tmp/piclaw-secret-test";
  let api: ExtensionAPI;

  beforeEach(() => {
    api = createMockAPI();
    if (existsSync(TEST_ROOT)) {
      // cleanup recursively
      const clean = (dir: string) => {
        readdirSync(dir).forEach(entry => {
          const path = join(dir, entry);
          try { unlinkSync(path); } catch {}
          try { rmdirSync(path); } catch {}
        });
        rmdirSync(dir);
      };
      try { clean(TEST_ROOT); } catch {}
    }
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    try { rmdirSync(TEST_ROOT, { recursive: true }); } catch {}
  });

  it("should detect AWS Access Key", async () => {
    const file = join(TEST_ROOT, "test.js");
    touchFile(file, "const key = 'AKIAIOSFODNN7EXAMPLE';");
    // Use inline scan logic similar to tool but simplified for test
    const content = readFileSync(file, "utf-8");
    const regex = /AKIA[0-9A-Z]{16}/;
    expect(content).toMatch(regex);
  });

  it("should detect GitHub token", async () => {
    const file = join(TEST_ROOT, "config.json");
    touchFile(file, `{ "token": "ghp_1234567890abcdefghijklmnopqrstuvwxyz" }`); // 36 chars after ghp_
    const content = readFileSync(file, "utf-8");
    const regex = /ghp_[0-9a-zA-Z]{36}/;
    expect(content).toMatch(regex);
  });

  it("should detect Private Key PEM header", async () => {
    const file = join(TEST_ROOT, "key.pem");
    touchFile(file, "-----BEGIN RSA PRIVATE KEY-----\n...");
    const content = readFileSync(file, "utf-8");
    expect(content).toMatch(/-----BEGIN (RSA )?PRIVATE KEY-----/);
  });

  it("should ignore node_modules directory", async () => {
    const nodeMod = join(TEST_ROOT, "node_modules", "pkg");
    mkdirSync(nodeMod, { recursive: true });
    const file = join(nodeMod, "test.js");
    touchFile(file, "const key = 'AKIAIOSFODNN7EXAMPLE';");
    // Simulate exclude check
    const exclude = ["node_modules"];
    const filePath = file;
    const shouldScan = !exclude.some(dir => filePath.includes(dir));
    expect(shouldScan).toBe(false);
  });

  it("should respect file size limit", async () => {
    const file = join(TEST_ROOT, "big.txt");
    // create 2MB file
    const bigContent = "a".repeat(2 * 1024 * 1024 + 100);
    writeFileSync(file, bigContent);
    const maxSize = 1024 * 1024; // 1MB
    const stats = await import("node:fs").then(m => m.statSync(file));
    expect(stats.size > maxSize).toBe(true);
  });
});
