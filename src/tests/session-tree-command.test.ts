import { describe, it, expect } from "vitest";
import { EntryDetailView } from "../extensions/commands/session-tree-command";

function fakeTheme() {
  return { fg: (color: string, text: string) => text };
}

describe("EntryDetailView", () => {
  it("renders message entry with role and text content", () => {
    const view = new EntryDetailView({} as any, fakeTheme());
    const entry = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Test message content" }],
      },
    };
    view.setEntry(entry);
    const lines = view.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Entry ID: m1");
    expect(text).toContain("Type: message");
    expect(text).toContain("Role: assistant");
    expect(text).toContain("Text: Test message content");
  });

  it("renders branch_summary entry", () => {
    const view = new EntryDetailView({} as any, fakeTheme());
    const entry = {
      type: "branch_summary",
      id: "b1",
      parentId: "root",
      timestamp: Date.now(),
      fromId: "abc123",
      summary: "This is a branch summary",
    };
    view.setEntry(entry);
    const lines = view.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Entry ID: b1");
    expect(text).toContain("Type: branch_summary");
    expect(text).toContain("From: abc123");
    expect(text).toContain("Summary: This is a branch summary");
  });

  it("renders compaction entry", () => {
    const view = new EntryDetailView({} as any, fakeTheme());
    const entry = {
      type: "compaction",
      id: "c1",
      parentId: null,
      timestamp: Date.now(),
      tokensBefore: 1234,
      firstKeptEntryId: "e1",
      summary: "Compaction summary text",
    };
    view.setEntry(entry);
    const text = view.render(80).join("\n");
    expect(text).toContain("Type: compaction");
    expect(text).toContain("Tokens before: 1234");
    expect(text).toContain("First kept: e1");
    expect(text).toContain("Summary: Compaction summary text");
  });

  it("renders custom_message entry", () => {
    const view = new EntryDetailView({} as any, fakeTheme());
    const entry = {
      type: "custom_message",
      id: "cm1",
      parentId: null,
      timestamp: Date.now(),
      customType: "info",
      display: "Info message",
      content: "Custom content string",
    };
    view.setEntry(entry);
    const text = view.render(80).join("\n");
    expect(text).toContain("Type: custom_message");
    expect(text).toContain("Custom type: info");
    expect(text).toContain("Display: Info message");
    expect(text).toContain("Content: Custom content string");
  });

  it("renders label entry", () => {
    const view = new EntryDetailView({} as any, fakeTheme());
    const entry = {
      type: "label",
      id: "l1",
      parentId: "p1",
      timestamp: Date.now(),
      targetId: "target1",
      label: "important",
    };
    view.setEntry(entry);
    const text = view.render(80).join("\n");
    expect(text).toContain("Type: label");
    expect(text).toContain("Target: target1");
    expect(text).toContain("Label: important");
  });

  it("renders unknown entry type", () => {
    const view = new EntryDetailView({} as any, fakeTheme());
    const entry = {
      type: "unknown_type" as any,
      id: "x1",
      parentId: null,
      timestamp: Date.now(),
    };
    view.setEntry(entry);
    const text = view.render(80).join("\n");
    expect(text).toContain("Unknown entry type: unknown_type");
  });

  it("caches render result when width unchanged", () => {
    const view = new EntryDetailView({} as any, fakeTheme());
    const entry = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
    };
    view.setEntry(entry);
    const lines1 = view.render(80);
    const lines2 = view.render(80);
    expect(lines1).toBe(lines2);
  });

  it("invalidates cache on setEntry", () => {
    const view = new EntryDetailView({} as any, fakeTheme());
    const entry1 = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "user",
        content: [{ type: "text", text: "First" }],
      },
    };
    view.setEntry(entry1);
    const lines1 = view.render(80);
    const entry2 = {
      type: "message",
      id: "m2",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Second" }],
      },
    };
    view.setEntry(entry2);
    const lines2 = view.render(80);
    expect(lines1).not.toBe(lines2);
    expect(lines2.some(l => l.includes("m2"))).toBe(true);
  });
});
