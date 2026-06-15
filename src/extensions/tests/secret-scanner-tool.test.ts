#!/usr/bin/env node

/**
 * Comprehensive unit tests: Secret Scanner Tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { existsSync, mkdirSync, rmdirSync, unlinkSync, writeFileSync, readFileSync, statSync, chmodSync, readdirSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSecretScannerTool, runScan } from "../tools/secret-scanner-tool";

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
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("found");
    expect(results.count).toBeGreaterThan(0);
    expect(results.files).toContain(file);
    expect(results.output).toMatch("AWS Access Key");
  });

  it("should detect GitHub token", async () => {
    const file = join(TEST_ROOT, "config.json");
    touchFile(file, `{ "token": "ghp_1234567890abcdefghijklmnopqrstuvwxyz" }`);
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("found");
    expect(results.output).toMatch("GitHub Token");
  });

  it("should detect OpenAI API Key", async () => {
    const file = join(TEST_ROOT, ".env");
    touchFile(file, "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJ");
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("found");
    expect(results.output).toMatch("OpenAI API Key");
  });

  it("should detect Anthropic API Key", async () => {
    const file = join(TEST_ROOT, ".env");
    touchFile(file, "ANTHROPIC_API_KEY=sk-ant-1234567890abcdefghijklmnopqrstuv");
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("found");
    expect(results.output).toMatch("Anthropic API Key");
  });

  it("should detect Replicate API Token", async () => {
    const file = join(TEST_ROOT, ".env");
    touchFile(file, "REPLICATE_TOKEN=r8_1234567890abcdefghijklmnopqrstuvwxyz");
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("found");
    expect(results.output).toMatch("Replicate API Token");
  });

  it("should detect Hugging Face Token", async () => {
    const file = join(TEST_ROOT, ".env");
    touchFile(file, "HF_TOKEN=hf_1234567890abcdefghijklmnopqrstuvwxyzABCD");
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("found");
    expect(results.output).toMatch("Hugging Face Token");
  });

  it("should detect Private Key PEM header", async () => {
    const file = join(TEST_ROOT, "key.pem");
    touchFile(file, "-----BEGIN RSA PRIVATE KEY-----\n...");
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("found");
    expect(results.output).toMatch("Private Key");
  });

  it("should ignore node_modules directory", async () => {
    const nodeMod = join(TEST_ROOT, "node_modules", "pkg");
    mkdirSync(nodeMod, { recursive: true });
    const file = join(nodeMod, "test.js");
    touchFile(file, "const key = 'AKIAIOSFODNN7EXAMPLE';");
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("clean");
  });

  it("should respect file size limit", async () => {
    const file = join(TEST_ROOT, "big.txt");
    const bigContent = "a".repeat(2 * 1024 * 1024 + 100);
    writeFileSync(file, bigContent);
    const stats = statSync(file);
    expect(stats.size > 1024 * 1024).toBe(true);
    const results = await runScan({ path: TEST_ROOT, max_size_kb: 1024 });
    expect(results.status).toBe("clean");
  });

  it("should skip non-matching extensions", async () => {
    const file = join(TEST_ROOT, "data.bin");
    touchFile(file, "some content");
    const results = await runScan({ path: TEST_ROOT, extensions: ".js,.ts" });
    expect(results.status).toBe("clean");
  });

  it("should return clean when no secrets present", async () => {
    const file = join(TEST_ROOT, "clean.js");
    touchFile(file, "console.log('Hello world');");
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("clean");
  });

  it("should detect multiple secret types in one file", async () => {
    const file = join(TEST_ROOT, "multi.env");
    touchFile(file, `AWS_KEY=AKIAIOSFODNN7EXAMPLE
GITHUB=ghp_1234567890abcdefghijklmnopqrstuvwxyz
OPENAI=sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJ
`);
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("found");
    expect(results.output).toMatch("AWS Access Key");
    expect(results.output).toMatch("GitHub Token");
    expect(results.output).toMatch("OpenAI API Key");
  });

  it("should handle read errors gracefully", async () => {
    const file = join(TEST_ROOT, "noperm.js");
    touchFile(file, "secret='AKIAIOSFODNN7EXAMPLE';");
    chmodSync(file, 0o000);
    const results = await runScan({ path: TEST_ROOT });
    expect(results.status).toBe("clean");
  });

  it("should register tool and command", () => {
    registerSecretScannerTool(api);
    expect(api.registerTool).toHaveBeenCalled();
    expect(api.registerCommand).toHaveBeenCalledWith("scan-secrets", expect.any(Object));
  });
});
