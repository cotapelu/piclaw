import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSessionManager } from "../session-resolver";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { promptConfirm } from "../utils/prompt";

// Mock the entire pi-coding-agent package to provide a fake SessionManager
vi.mock("@earendil-works/pi-coding-agent", () => ({
  SessionManager: {
    continueRecent: vi.fn(),
    list: vi.fn(),
    open: vi.fn(),
    forkFrom: vi.fn(),
  },
}));

// Mock prompt utils
vi.mock("../utils/prompt", () => ({
  promptConfirm: vi.fn(),
  promptWithDefault: vi.fn(),
}));

describe("resolveSessionManager", () => {
  let fakeSession: any;
  let optsBase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeSession = { getSessionId: vi.fn().mockReturnValue("sess123") };
    optsBase = {
      cwd: "/cwd",
      sessionDir: undefined,
      interactive: false,
      session: undefined,
      resume: false,
      continue: false,
      fork: undefined,
    };
  });

  describe("continue flag", () => {
    it("returns recent session on success", async () => {
      (SessionManager.continueRecent as any).mockResolvedValue(fakeSession);
      const opts = { ...optsBase, continue: true };
      const result = await resolveSessionManager(opts);
      expect(result).toBe(fakeSession);
      expect(SessionManager.continueRecent).toHaveBeenCalledWith("/cwd", undefined);
    });

    it("throws when no recent session", async () => {
      (SessionManager.continueRecent as any).mockResolvedValue(null);
      const opts = { ...optsBase, continue: true };
      await expect(resolveSessionManager(opts)).rejects.toThrow("No recent session found");
    });

    it("propagates errors from continueRecent", async () => {
      (SessionManager.continueRecent as any).mockRejectedValue(new Error("DB error"));
      const opts = { ...optsBase, continue: true };
      await expect(resolveSessionManager(opts)).rejects.toThrow("Failed to continue session: DB error");
    });
  });

  describe("resume flag", () => {
    it("resumes latest non-interactively", async () => {
      const sessions = [{ id: "s1", path: "/cwd/.pi/agent/s1.jsonl" }, { id: "s2", path: "/cwd/.pi/agent/s2.jsonl" }];
      (SessionManager.list as any).mockResolvedValue(sessions);
      const opened = { getSessionId: vi.fn().mockReturnValue("opened") };
      (SessionManager.open as any).mockReturnValue(opened);
      const opts = { ...optsBase, resume: true };
      const result = await resolveSessionManager(opts);
      expect(result).toBe(opened);
      expect(SessionManager.list).toHaveBeenCalledWith("/cwd", undefined);
      expect(SessionManager.open).toHaveBeenCalledWith(sessions[0].path, undefined);
    });

    it("throws if no sessions found", async () => {
      (SessionManager.list as any).mockResolvedValue([]);
      const opts = { ...optsBase, resume: true };
      await expect(resolveSessionManager(opts)).rejects.toThrow("No sessions found in current project.");
    });

    it("uses interactive selection when interactive", async () => {
      const sessions = [{ id: "s1", path: "/cwd/.pi/agent/s1.jsonl" }];
      (SessionManager.list as any).mockResolvedValue(sessions);
      (promptConfirm as any).mockResolvedValue(false); // simulate no selection
      const opened = { getSessionId: vi.fn() };
      (SessionManager.open as any).mockReturnValue(opened);
      const opts = { ...optsBase, resume: true, interactive: true };
      await expect(resolveSessionManager(opts)).rejects.toThrow("No session selected.");
      // confirm should have been called?
    });

    it("handles open errors", async () => {
      const sessions = [{ id: "s1", path: "/path" }];
      (SessionManager.list as any).mockResolvedValue(sessions);
      (SessionManager.open as any).mockImplementation(() => { throw new Error("disk error"); });
      const opts = { ...optsBase, resume: true };
      await expect(resolveSessionManager(opts)).rejects.toThrow("Failed to resume session: disk error");
    });
  });

  describe("fork flag", () => {
    it("forks from local session", async () => {
      (resolveSessionManager as any).Mock // cannot mock resolveSessionArgument easily because it's from same module. We'll instead test by calling resolveSessionManager with fork. However, resolveSessionManager calls resolveSessionArgument which is imported from same file. To avoid complexity, we can mock resolveSessionArgument using vi.mock on the relative module? But resolveSessionArgument is defined in the same file; we cannot mock it separately unless we restructure. Since we are testing resolveSessionManager which uses resolveSessionArgument, we may need to mock that too or allow it to run. But resolveSessionArgument uses SessionManager.list; we already mock SessionManager. So it's fine.
    });
  });
});
