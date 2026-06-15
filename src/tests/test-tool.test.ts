#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTestTool } from "../extensions/tools/test-tool.js";
import { createBashTool } from "@earendil-works/pi-coding-agent";

vi.mock("@earendil-works/pi-coding-agent", async () => {
  const actual = await vi.importActual("@earendil-works/pi-coding-agent");
  return {
    ...actual,
    createBashTool: vi.fn(() => ({ execute: vi.fn() }))
  };
});

describe("Test Tool", () => {
  let mockExecute: any;
  let tool: any;

  beforeEach(() => {
    mockExecute = vi.fn();
    (createBashTool as any).mockReturnValue({ execute: mockExecute });
    const mockApi = { registerTool: vi.fn((t) => { tool = t; }) };
    registerTestTool(mockApi);
  });

  it("has correct metadata", () => {
    expect(tool.name).toBe("test");
    expect(tool.label).toBe("Test Runner");
    expect(tool.description).toContain("vitest");
  });

  it("executes npm test with specific files", async () => {
    mockExecute.mockResolvedValue({ content: [{ type: "text", text: "tests passed" }], isError: false });
    await tool.execute("call1", { files: ["src/tests/foo.test.ts", "src/tests/bar.test.ts"] }, undefined, undefined, { cwd: "/repo" });
    expect(mockExecute).toHaveBeenCalledWith(
      "call1",
      { command: "npm test -- 'src/tests/foo.test.ts' 'src/tests/bar.test.ts'" },
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("executes npm test in watch mode", async () => {
    mockExecute.mockResolvedValue({ content: [], isError: false });
    await tool.execute("call2", { watch: true }, undefined, undefined, { cwd: "/repo" });
    expect(mockExecute).toHaveBeenCalledWith(
      "call2",
      { command: "npm test -- --watch" },
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("executes npm test without args", async () => {
    mockExecute.mockResolvedValue({ content: [], isError: false });
    await tool.execute("call3", {}, undefined, undefined, { cwd: "/repo" });
    expect(mockExecute).toHaveBeenCalledWith(
      "call3",
      { command: "npm test" },
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("propagates errors", async () => {
    mockExecute.mockResolvedValue({ content: [{ type: "text", text: "error" }], isError: true });
    const result = await tool.execute("call4", {}, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
  });
});
