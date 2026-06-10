import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSessionArgument } from "../session-resolver";

// Mock the entire pi-coding-agent package to provide fake SessionManager
vi.mock("@earendil-works/pi-coding-agent", () => ({
  SessionManager: {
    list: vi.fn(),
    listAll: vi.fn(),
  },
}));

import { SessionManager } from "@earendil-works/pi-coding-agent";

describe("resolveSessionArgument Full", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches local session by prefix", async () => {
    (SessionManager.list as any).mockResolvedValue([
      { id: "abc123", path: "/cwd/.pi/agent/abc123.jsonl" },
      { id: "abc456", path: "/cwd/.pi/agent/abc456.jsonl" },
      { id: "xyz789", path: "/cwd/.pi/agent/xyz789.jsonl" },
    ]);
    const result = await resolveSessionArgument("abc", "/cwd");
    expect(result.type).toBe("local");
    expect(result.sessionId).toBe("abc123");
    expect(result.path).toBe("/cwd/.pi/agent/abc123.jsonl");
    expect(SessionManager.list).toHaveBeenCalledWith("/cwd", undefined);
  });

  it("returns not_found if local matches empty", async () => {
    (SessionManager.list as any).mockResolvedValue([]);
    (SessionManager.listAll as any).mockResolvedValue([]);
    const result = await resolveSessionArgument("none", "/cwd");
    expect(result.type).toBe("not_found");
    expect(result.arg).toBe("none");
  });

  it("falls back to global sessions if local no match", async () => {
    (SessionManager.list as any).mockResolvedValue([]);
    (SessionManager.listAll as any).mockResolvedValue([
      { id: "global1", path: "/global/global1.jsonl", cwd: "/cwd" },
      { id: "g2", path: "/global/g2.jsonl", cwd: "/cwd" },
    ]);
    const result = await resolveSessionArgument("g2", "/cwd");
    expect(result.type).toBe("global");
    expect(result.sessionId).toBe("g2");
    expect(result.path).toBe("/global/g2.jsonl");
    expect(result.cwd).toBe("/cwd");
    expect(SessionManager.listAll).toHaveBeenCalled();
  });

  it("calls SessionManager.list with custom sessionDir", async () => {
    (SessionManager.list as any).mockResolvedValue([]);
    (SessionManager.listAll as any).mockResolvedValue([]);
    await resolveSessionArgument("x", "/cwd", "/custom/sessions");
    expect(SessionManager.list).toHaveBeenCalledWith("/cwd", "/custom/sessions");
  });

  it("handles local list throwing", async () => {
    (SessionManager.list as any).mockRejectedValue(new Error("fail"));
    (SessionManager.listAll as any).mockResolvedValue([]);
    const result = await resolveSessionArgument("any", "/cwd");
    expect(result.type).toBe("not_found");
  });
});
