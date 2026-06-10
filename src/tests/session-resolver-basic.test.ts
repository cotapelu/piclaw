import { describe, it, expect } from "vitest";
import { validateSessionFlags, resolveSessionArgument } from "../session-resolver";

describe("validateSessionFlags", () => {
  it("allows empty options", () => {
    expect(validateSessionFlags({})).toBeUndefined();
  });

  it("allows exactly one flag", () => {
    expect(validateSessionFlags({ session: "sess" })).toBeUndefined();
    expect(validateSessionFlags({ resume: true })).toBeUndefined();
    expect(validateSessionFlags({ continue: true })).toBeUndefined();
    expect(validateSessionFlags({ fork: "fork" })).toBeUndefined();
  });

  it("rejects conflicting flags", () => {
    expect(() => validateSessionFlags({ session: "s", resume: true })).toThrow("--session");
    expect(() => validateSessionFlags({ session: "s", resume: true })).toThrow("--resume");
    expect(() => validateSessionFlags({ session: "s", continue: true })).toThrow("--session");
    expect(() => validateSessionFlags({ session: "s", continue: true })).toThrow("--continue");
    expect(() => validateSessionFlags({ resume: true, continue: true })).toThrow("--resume");
    expect(() => validateSessionFlags({ resume: true, continue: true })).toThrow("--continue");
    expect(() => validateSessionFlags({ session: "s", fork: "f" })).toThrow("--fork");
    expect(() => validateSessionFlags({ resume: true, fork: "f" })).toThrow("--fork");
    expect(() => validateSessionFlags({ continue: true, fork: "f" })).toThrow("--fork");
  });
});

describe("resolveSessionArgument", () => {
  it("returns local for absolute path", async () => {
    const result = await resolveSessionArgument("/abs/path/session.jsonl", "/cwd");
    expect(result.type).toBe("local");
    expect(result.path).toBe("/abs/path/session.jsonl");
    expect(result.sessionId).toBe("session");
  });

  it("returns local for relative path with slash", async () => {
    const result = await resolveSessionArgument("logs/sess", "/cwd");
    expect(result.type).toBe("local");
    expect(result.path).toBe("/cwd/logs/sess");
    expect(result.sessionId).toBe("sess");
  });

  it("returns local for path ending with .jsonl", async () => {
    const result = await resolveSessionArgument("my.session.jsonl", "/cwd");
    expect(result.type).toBe("local");
    expect(result.path).toBe("/cwd/my.session.jsonl");
    expect(result.sessionId).toBe("my.session");
  });
});
