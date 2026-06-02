import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  resolveSessionArgument,
  selectSessionInteractive,
  resolveSessionManager,
  validateSessionFlags,
  type ResolvedSession,
} from "../session-resolver";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import * as promptUtils from "../utils/prompt";

// Mock SessionManager static methods
vi.mock("@earendil-works/pi-coding-agent", async () => {
  const actual = await vi.importActual("@earendil-works/pi-coding-agent");
  return {
    ...actual,
    SessionManager: {
      create: vi.fn(),
      open: vi.fn(),
      list: vi.fn(),
      listAll: vi.fn(),
      forkFrom: vi.fn(),
      continueRecent: vi.fn(),
    },
  };
});

// Mock prompt utilities
vi.mock("../utils/prompt.js", () => ({
  promptConfirm: vi.fn(),
  promptWithDefault: vi.fn(),
  selectSessionInteractive: vi.fn(),
}));

const MockedSessionManager = SessionManager as any;

describe("SessionResolver", () => {
  const cwd = "/project";
  const sessionDir = ".piclaw/sessions";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveSessionArgument", () => {
    it("resolves absolute path", async () => {
      const path = "/absolute/session.jsonl";
      const resolved = await resolveSessionArgument(path, cwd);
      expect(resolved.type).toBe("local");
      expect(resolved.path).toBe(path);
    });

    it("resolves relative path to cwd", async () => {
      const resolved = await resolveSessionArgument("sessions/abc.jsonl", cwd);
      expect(resolved.path).toBe("/project/sessions/abc.jsonl");
    });

    it("recognizes .jsonl suffix as session file", async () => {
      const resolved = await resolveSessionArgument("saved/12345.jsonl", cwd);
      expect(resolved.type).toBe("local");
    });

    it("searches local sessions by ID prefix", async () => {
      MockedSessionManager.list.mockResolvedValue([
        { id: "abc123", path: "/local/abc123.jsonl" },
        { id: "def456", path: "/local/def456.jsonl" },
      ]);

      const resolved = await resolveSessionArgument("abc", cwd, sessionDir);
      expect(resolved.type).toBe("local");
      expect(resolved.sessionId).toBe("abc123");
    });

    it("searches global sessions if local not found", async () => {
      MockedSessionManager.list.mockResolvedValue([]);
      MockedSessionManager.listAll.mockResolvedValue([
        { id: "global-session", path: "/global/global.jsonl", cwd: "/other" },
      ]);

      const resolved = await resolveSessionArgument("global", cwd);
      expect(resolved.type).toBe("global");
      expect(resolved.cwd).toBe("/other");
    });

    it("returns not_found if no match", async () => {
      MockedSessionManager.list.mockResolvedValue([]);
      MockedSessionManager.listAll.mockResolvedValue([]);

      const resolved = await resolveSessionArgument("unknown", cwd);
      expect(resolved.type).toBe("not_found");
    });
  });

  describe("selectSessionInteractive", () => {
    it("lists sessions and returns selected path", async () => {
      const sessions = [
        { id: "s1", path: "/p1.jsonl" },
        { id: "s2", path: "/p2.jsonl" },
      ];
      (promptUtils.promptWithDefault as any).mockResolvedValue("2");

      const result = await selectSessionInteractive(sessions, cwd);
      expect(result).toBe("/p2.jsonl");
    });

    it("returns undefined on cancel (empty input)", async () => {
      (promptUtils.promptWithDefault as any).mockResolvedValue("");

      const result = await selectSessionInteractive(
        [{ id: "s1", path: "/p1.jsonl" }],
        cwd
      );
      expect(result).toBeUndefined();
    });

    it("handles invalid input", async () => {
      (promptUtils.promptWithDefault as any).mockResolvedValue("99");

      const result = await selectSessionInteractive(
        [{ id: "s1", path: "/p1.jsonl" }],
        cwd
      );
      expect(result).toBeUndefined();
    });
  });

  describe("validateSessionFlags", () => {
    it("accepts single flag", () => {
      expect(() =>
        validateSessionFlags({ session: "abc", resume: false, continue: false, fork: undefined })
      ).not.toThrow();
    });

    it("rejects multiple flags", () => {
      expect(() =>
        validateSessionFlags({ session: "abc", resume: true, continue: false, fork: undefined })
      ).toThrow("Conflicting session flags");
    });
  });

  describe("resolveSessionManager", () => {
    const defaultOpts = {
      cwd,
      sessionDir,
      interactive: true,
    };

    it("creates new session when no flags", async () => {
      const fakeSession = { getSessionId: () => "new123" };
      MockedSessionManager.create.mockReturnValue(fakeSession);

      const mgr = await resolveSessionManager({ ...defaultOpts });
      expect(MockedSessionManager.create).toHaveBeenCalledWith(cwd, sessionDir);
      expect(mgr.getSessionId()).toBe("new123");
    });

    it("continues recent session", async () => {
      const fakeSession = { getSessionId: () => "recent456" };
      MockedSessionManager.continueRecent.mockResolvedValue(fakeSession);

      const mgr = await resolveSessionManager({
        ...defaultOpts,
        continue: true,
      });

      expect(MockedSessionManager.continueRecent).toHaveBeenCalledWith(cwd, sessionDir);
      expect(mgr.getSessionId()).toBe("recent456");
    });

    it("fails continue if no recent session", async () => {
      MockedSessionManager.continueRecent.mockResolvedValue(null);

      await expect(
        resolveSessionManager({ ...defaultOpts, continue: true })
      ).rejects.toThrow("No recent session found");
    });

    it("resumes with interactive picker", async () => {
      MockedSessionManager.list.mockResolvedValue([
        { id: "s1", path: "/p1.jsonl" },
      ]);
      // Mock promptWithDefault to return "1" (first session)
      (promptUtils.promptWithDefault as any).mockResolvedValue("1");
      const fakeSession = { getSessionId: () => "s1" };
      MockedSessionManager.open.mockReturnValue(fakeSession);

      const mgr = await resolveSessionManager({
        ...defaultOpts,
        resume: true,
      });

      expect(mgr.getSessionId()).toBe("s1");
      expect(MockedSessionManager.open).toHaveBeenCalledWith("/p1.jsonl", sessionDir);
      expect(promptUtils.promptWithDefault).toHaveBeenCalled();
    });

    it("forks from existing session", async () => {
      MockedSessionManager.list.mockResolvedValue([
        { id: "source-id", path: "/source.jsonl" },
      ]);
      const fakeForked = { getSessionId: () => "forked-new" };
      MockedSessionManager.forkFrom.mockReturnValue(fakeForked);

      const mgr = await resolveSessionManager({
        ...defaultOpts,
        fork: "source-id",
      });

      expect(MockedSessionManager.forkFrom).toHaveBeenCalledWith("/source.jsonl", cwd, sessionDir);
      expect(mgr.getSessionId()).toBe("forked-new");
    });

    it("opens specific session", async () => {
      MockedSessionManager.list.mockResolvedValue([
        { id: "target", path: "/target.jsonl" },
      ]);
      const fakeSession = { getSessionId: () => "target" };
      MockedSessionManager.open.mockReturnValue(fakeSession);

      const mgr = await resolveSessionManager({
        ...defaultOpts,
        session: "target",
      });

      expect(MockedSessionManager.open).toHaveBeenCalledWith("/target.jsonl", sessionDir);
    });

    it("prompts for confirmation when forking global session", async () => {
      MockedSessionManager.list.mockResolvedValue([]);
      MockedSessionManager.listAll.mockResolvedValue([
        { id: "global-sess", path: "/global/glob.jsonl", cwd: "/other" },
      ]);
      (promptUtils.promptConfirm as any).mockResolvedValue(true);

      const fakeSession = { getSessionId: () => "new-fork" };
      MockedSessionManager.forkFrom.mockReturnValue(fakeSession);

      const mgr = await resolveSessionManager({
        ...defaultOpts,
        fork: "global-sess",
      });

      expect(promptUtils.promptConfirm).toHaveBeenCalledWith(
        expect.stringContaining("different project")
      );
      expect(mgr.getSessionId()).toBe("new-fork");
    });

    it("cancels fork if user declines", async () => {
      MockedSessionManager.list.mockResolvedValue([]);
      MockedSessionManager.listAll.mockResolvedValue([
        { id: "global-sess", path: "/global/glob.jsonl", cwd: "/other" },
      ]);
      (promptUtils.promptConfirm as any).mockResolvedValue(false);

      await expect(
        resolveSessionManager({ ...defaultOpts, fork: "global-sess" })
      ).rejects.toThrow("Fork cancelled");
    });
  });
});
