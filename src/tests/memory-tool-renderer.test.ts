import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMemoryTool } from "../extensions/tools/memory-tool";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

function createMockApi(): ExtensionAPI {
  return {
    registerTool: vi.fn(),
    appendEntry: vi.fn(),
    on: vi.fn(),
  } as any;
}

describe("Memory Tool Renderer", () => {
  let api: any;
  let tool: any;

  const theme: any = { fg: (c: string, t?: string) => (t ?? c), bold: (t: string) => t };

  beforeEach(() => {
    api = createMockApi();
    registerMemoryTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  it("renderResult add success shows stored id", () => {
    const memories = [{ id: 1, text: "note", tags: ["a"] }];
    const result = { details: { action: "add", memories, nextId: 2 } };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {} as any);
    expect(comp).toBeInstanceOf(Text);
    expect(comp.text).toContain("Stored #1");
  });

  it("renderResult list with memories shows count", () => {
    const memories = [
      { id: 1, text: "first", tags: [] },
      { id: 2, text: "second", tags: ["tag"] },
    ];
    const result = { details: { action: "list", memories, nextId: 3 } };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {} as any);
    expect(comp.text).toContain("✓ 2 memories");
  });

  it("renderResult list empty shows none", () => {
    const result = { details: { action: "list", memories: [], nextId: 1 } };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {} as any);
    expect(comp.text).toContain("No memories");
  });

  it("renderResult get shows text", () => {
    const result = { details: { action: "get", memories: [], nextId: 1, targetId: 5 } };
    // Without full memory object, but renderResult only uses action to decide message for get/delete/clear/search as generic ✓ get. Actually from earlier read: cases for get, delete, clear, search return "✓ ${action}". So test that.
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {} as any);
    expect(comp.text).toContain("✓ get");
  });

  it("renderResult delete shows generic", () => {
    const result = { details: { action: "delete", memories: [], nextId: 1, targetId: 1 } };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {} as any);
    expect(comp.text).toContain("✓ delete");
  });

  it("renderResult clear shows generic", () => {
    const result = { details: { action: "clear", memories: [], nextId: 1 } };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {} as any);
    expect(comp.text).toContain("✓ clear");
  });

  it("renderResult search shows generic", () => {
    const result = { details: { action: "search", memories: [], nextId: 1 } };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {} as any);
    expect(comp.text).toContain("✓ search");
  });

  it("renderResult shows error when details.error", () => {
    const result = { details: { error: "something wrong" } };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {} as any);
    expect(comp.text).toContain("Error: something wrong");
  });

  it("renderResult shows processing when isPartial", () => {
    const result = { details: {} };
    const comp = tool.renderResult(result, { expanded: false, isPartial: true }, theme, {} as any);
    expect(comp.text).toContain("Processing...");
  });
});
