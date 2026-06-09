#!/usr/bin/env node

/**
 * Metrics Tool Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { registerMetricsTool, createMetricsTool } from "../extensions/tools/metrics-tool.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

describe("Metrics Tool", () => {
  it("should create metrics tool with correct properties", () => {
    const cwd = process.cwd();
    const tool = createMetricsTool(cwd);
    expect(tool.name).toBe("metrics");
    expect(tool.label).toBe("Metrics Export");
    expect(tool.description).toContain("usage");
    expect(tool.parameters).toEqual({});
    expect(typeof tool.execute).toBe("function");
  });

  it("should return metrics JSON with required fields", async () => {
    const cwd = process.cwd();
    const tool = createMetricsTool(cwd);
    const mockCtx = {
      sessionManager: {
        getTree: () => [
          { id: "1", type: "message" },
          { id: "2", type: "message" },
          { id: "3", type: "tool_call" },
        ],
      },
    } as any;

    const result = await tool.execute("test-call", {}, undefined, undefined, mockCtx);

    expect(result.isError).toBe(false);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const metrics = JSON.parse(result.content[0].text);
    expect(metrics).toHaveProperty("timestamp");
    expect(metrics).toHaveProperty("uptime");
    expect(metrics).toHaveProperty("memory");
    expect(metrics).toHaveProperty("sessionEntries");
    expect(metrics.sessionEntries).toBe(3);
    expect(typeof metrics.uptime).toBe("number");
    expect(metrics.memory).toHaveProperty("rss");
    expect(metrics.memory).toHaveProperty("heapTotal");
    expect(metrics.memory).toHaveProperty("heapUsed");
  });

  it("should handle missing session manager", async () => {
    const cwd = process.cwd();
    const tool = createMetricsTool(cwd);
    const mockCtx = { sessionManager: undefined } as any;

    const result = await tool.execute("test-call", {}, undefined, undefined, mockCtx);

    expect(result.isError).toBe(false);
    const metrics = JSON.parse(result.content[0].text);
    expect(metrics.sessionEntries).toBe(0);
  });

  it("should register with API", () => {
    const mockApi = { registerTool: vi.fn() };
    registerMetricsTool(mockApi as any);
    expect(mockApi.registerTool).toHaveBeenCalledTimes(1);
  });
});
