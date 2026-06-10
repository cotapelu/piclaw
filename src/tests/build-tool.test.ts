#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerBuildTool } from "../extensions/tools/build-tool.js";
import { createBashTool } from "@earendil-works/pi-coding-agent";

vi.mock("@earendil-works/pi-coding-agent", async () => {
  const actual = await vi.importActual("@earendil-works/pi-coding-agent");
  return {
    ...actual,
    createBashTool: vi.fn(() => ({ execute: vi.fn() }))
  };
});

describe("Build Tool", () => {
  let mockExecute: any;
  let mockTool: any;

  beforeEach(() => {
    mockExecute = vi.fn();
    (createBashTool as any).mockReturnValue({ execute: mockExecute });
    const mockApi = {
      registerTool: vi.fn((tool) => { mockTool = tool; })
    };
    registerBuildTool(mockApi);
    mockTool = mockApi.registerTool.mock.calls[0][0];
  });

  it("should have correct metadata", () => {
    expect(mockTool.name).toBe("build");
    expect(mockTool.label).toBe("Build System");
    expect(mockTool.description).toContain("npm run build");
  });

  it("should execute npm run build", async () => {
    mockExecute.mockResolvedValue({
      content: [{ type: "text", text: "Build successful" }],
      isError: false
    });
    const result = await mockTool.execute("call1", {}, undefined, undefined, { cwd: "/repo" });
    expect(mockExecute).toHaveBeenCalledWith(
      "call1",
      { command: "npm run build" },
      undefined,
      undefined,
      { cwd: "/repo" }
    );
    expect(result.isError).toBe(false);
  });

  it("should propagate errors from bash", async () => {
    mockExecute.mockResolvedValue({
      content: [{ type: "text", text: "Build failed" }],
      isError: true
    });
    const result = await mockTool.execute("call2", {}, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
  });
});
