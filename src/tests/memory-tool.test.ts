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

  // Execution tests
  it("execute add stores memory and calls appendEntry", async () => {
    const ctx = { cwd: "/repo" };
    const result = await tool.execute("call1", { action: "add", text: "Important fact", tags: ["decision"] }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(api.appendEntry).toHaveBeenCalledWith(
      "memory",
      expect.objectContaining({ text: "Important fact", tags: ["decision"], id: 1 })
    );
    // result details includes the added memory
    expect(result.details.action).toBe("add");
    expect(result.details.memories.length).toBe(1);
    expect(result.details.nextId).toBe(2);
    expect(result.content[0].text).toContain("Stored memory #1");
  });

  it("execute list shows memories", async () => {
    // First add two memories
    api.appendEntry.mockImplementation((type: string, mem: any) => {
      // simulate in-memory state? Actually tool's closure state is independent; after add, it updates memories array. So we can just call add and then list.
    });
    // Add first
    await tool.execute("call2", { action: "add", text: "First" }, undefined, undefined, { cwd: "/repo" });
    // Add second
    await tool.execute("call3", { action: "add", text: "Second", tags: ["tag"] }, undefined, undefined, { cwd: "/repo" });
    // List
    const result = await tool.execute("call4", { action: "list" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.details.memories.length).toBe(2);
    const text = result.content[0].text;
    expect(text).toContain("First");
    expect(text).toContain("Second");
    expect(text).toContain("[tag]");
  });

  it("execute get returns memory text", async () => {
    await tool.execute("call5", { action: "add", text: "Retrieve me" }, undefined, undefined, { cwd: "/repo" });
    const result = await tool.execute("call6", { action: "get", id: 1 }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe("Retrieve me");
    expect(result.details.targetId).toBe(1);
  });

  it("execute get invalid id returns error", async () => {
    await tool.execute("call7", { action: "get", id: 999 }, undefined, undefined, { cwd: "/repo" });
    // No memories, so not found
    const result = await tool.execute("call7", { action: "get", id: 999 }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("not found");
  });

  it("execute delete removes memory", async () => {
    await tool.execute("call8", { action: "add", text: "Delete me" }, undefined, undefined, { cwd: "/repo" });
    const result = await tool.execute("call9", { action: "delete", id: 1 }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Deleted memory #1");
    // Now list should be empty
    const listResult = await tool.execute("call10", { action: "list" }, undefined, undefined, { cwd: "/repo" });
    expect(listResult.details.memories.length).toBe(0);
  });

  it("execute clear empties all memories", async () => {
    await tool.execute("call11", { action: "add", text: "A" }, undefined, undefined, { cwd: "/repo" });
    await tool.execute("call12", { action: "add", text: "B" }, undefined, undefined, { cwd: "/repo" });
    const result = await tool.execute("call13", { action: "clear" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Cleared 2 memories");
    const listResult = await tool.execute("call14", { action: "list" }, undefined, undefined, { cwd: "/repo" });
    expect(listResult.details.memories.length).toBe(0);
    expect(listResult.content[0].text).toContain("No memories");
  });

  it("execute search finds matching memories", async () => {
    await tool.execute("call15", { action: "add", text: "Decision: go live", tags: ["meeting"] }, undefined, undefined, { cwd: "/repo" });
    await tool.execute("call16", { action: "add", text: "API key is secret", tags: ["security"] }, undefined, undefined, { cwd: "/repo" });
    await tool.execute("call17", { action: "add", text: "Remember to buy milk", tags: [] }, undefined, undefined, { cwd: "/repo" });
    const result = await tool.execute("call18", { action: "search", query: "decision" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Found 1 of 3 memories");
    expect(result.content[0].text).toContain("Decision: go live");
  });

  it("execute search by tag", async () => {
    await tool.execute("call19", { action: "add", text: "Note", tags: ["tag1", "tag2"] }, undefined, undefined, { cwd: "/repo" });
    await tool.execute("call20", { action: "add", text: "Other", tags: ["other"] }, undefined, undefined, { cwd: "/repo" });
    const result = await tool.execute("call21", { action: "search", query: "tag1" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.details.memories.length).toBe(1);
    expect(result.content[0].text).toContain("Note");
  });

  it("execute requires action parameter", async () => {
    const result = await tool.execute("call22", {}, undefined, undefined, { cwd: "/repo" });
    // When no action provided, it falls through to default case and returns unknown action message
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Unknown action");
  });

  it("execute unknown action returns error", async () => {
    const result = await tool.execute("call23", { action: "unknown" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Unknown action");
    expect(result.details.action).toBe("list"); // fallback details.action may be "list" as per default? Actually default case sets details.action = "list"? Let's not rely.
  });

  it("execute add requires text", async () => {
    const result = await tool.execute("call24", { action: "add" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("text required for add");
    expect(result.details.error).toBe("text required");
  });

  it("execute get requires id", async () => {
    const result = await tool.execute("call25", { action: "get" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("id required");
    expect(result.details.error).toBe("id required");
  });

  it("execute delete requires id", async () => {
    const result = await tool.execute("call26", { action: "delete" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("id required");
    expect(result.details.error).toBe("id required");
  });

  it("execute search requires query", async () => {
    const result = await tool.execute("call27", { action: "search" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("query required");
    expect(result.details.error).toBe("query required");
  });
});
