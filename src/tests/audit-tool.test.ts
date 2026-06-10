#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAuditTool } from "../extensions/tools/audit-tool.js";
import { createBashTool } from "@earendil-works/pi-coding-agent";

// Mock the bash tool
vi.mock("@earendil-works/pi-coding-agent", async () => {
  const actual = await vi.importActual("@earendil-works/pi-coding-agent");
  return {
    ...actual,
    createBashTool: vi.fn(() => ({ execute: vi.fn() }))
  };
});

describe("Audit Tool", () => {
  let mockExecute: any;
  let mockTool: any;

  beforeEach(() => {
    mockExecute = vi.fn();
    (createBashTool as any).mockReturnValue({ execute: mockExecute });
    const mockApi = {
      registerTool: vi.fn((tool) => { mockTool = tool; })
    };
    registerAuditTool(mockApi);
    // The tool is registered immediately (not session-based)
    mockTool = mockApi.registerTool.mock.calls[0][0];
  });

  it("should have correct metadata", () => {
    expect(mockTool.name).toBe("audit");
    expect(mockTool.label).toBe("Dependency Audit");
    expect(mockTool.description).toContain("npm audit");
  });

  it("should execute npm audit --json", async () => {
    mockExecute.mockResolvedValue({
      content: [{ type: "text", text: '{"vulnerabilities":{}}' }],
      isError: false
    });
    const result = await mockTool.execute("call1", {}, undefined, undefined, { cwd: "/repo" });
    expect(mockExecute).toHaveBeenCalledWith(
      "call1",
      { command: "npm audit --json" },
      undefined,
      undefined,
      { cwd: "/repo" }
    );
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("vulnerabilities");
  });

  it("should return error when bash tool fails", async () => {
    mockExecute.mockResolvedValue({
      content: [{ type: "text", text: "audit failed" }],
      isError: true
    });
    const result = await mockTool.execute("call2", {}, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
  });
});
