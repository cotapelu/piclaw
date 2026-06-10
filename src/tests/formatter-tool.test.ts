#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerFormatterTool } from "../extensions/tools/formatter-tool.js";
import { createBashTool } from "@earendil-works/pi-coding-agent";

vi.mock("@earendil-works/pi-coding-agent", async () => {
  const actual = await vi.importActual("@earendil-works/pi-coding-agent");
  return {
    ...actual,
    createBashTool: vi.fn(() => ({ execute: vi.fn() }))
  };
});

describe("Formatter Tool", () => {
  let mockExecute: any;
  let tool: any;

  beforeEach(() => {
    mockExecute = vi.fn();
    (createBashTool as any).mockReturnValue({ execute: mockExecute });
    const mockApi = { registerTool: vi.fn((t) => { tool = t; }) };
    registerFormatterTool(mockApi);
  });

  it("has correct metadata", () => {
    expect(tool.name).toBe("formatter");
    expect(tool.label).toBe("Code Formatter");
    expect(tool.description).toContain("Prettier");
  });

  it("executes formatting command with cwd and file list", async () => {
    mockExecute.mockResolvedValue({ content: [{ type: "text", text: "formatted" }], isError: false });
    const result = await tool.execute("call1", { files: ["src/index.ts", "lib/util.ts"] }, undefined, undefined, { cwd: "/proj" });
    expect(mockExecute).toHaveBeenCalledWith(
      "call1",
      { command: 'npx prettier --write "src/index.ts" "lib/util.ts"' },
      undefined,
      undefined,
      { cwd: "/proj" }
    );
    expect(result.isError).toBe(false);
  });

  it("returns error from bash", async () => {
    mockExecute.mockResolvedValue({ content: [], isError: true });
    const result = await tool.execute("call2", { files: ["a.ts"] }, undefined, undefined, { cwd: "/" });
    expect(result.isError).toBe(true);
  });
});
