#!/usr/bin/env node

import { describe, it, expect, vi } from "vitest";
import { registerMemoryTool } from "../extensions/tools/memory-tool";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function createMockApi(): ExtensionAPI {
  return {
    registerTool: vi.fn(),
    appendEntry: vi.fn(),
    on: vi.fn(),
  } as any;
}

describe("Memory Tool", () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = createMockApi();
    registerMemoryTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  it("has correct metadata", () => {
    expect(tool.name).toBe("memory");
    expect(tool.label).toBe("Memory");
    expect(tool.description).toContain("Store and retrieve");
  });

  it("has execute and render functions", () => {
    expect(typeof tool.execute).toBe("function");
    expect(typeof tool.renderCall).toBe("function");
    expect(typeof tool.renderResult).toBe("function");
  });

  it("renderCall formats action", () => {
    const theme: any = { fg: (c: string, t?: string) => (t ?? c), bold: (t) => t };
    const comp = tool.renderCall({ action: "add", text: "note", tags: ["a"] }, theme, {} as any);
    expect(comp.text).toContain("memory");
    expect(comp.text).toContain("add");
  });
});
