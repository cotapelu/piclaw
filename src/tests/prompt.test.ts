import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock node:readline before importing the module under test
vi.mock("node:readline", () => ({
  createInterface: vi.fn(),
}));

import { createInterface } from "node:readline";
import { promptConfirm, promptWithDefault, promptSelect } from "../utils/prompt";

describe("Prompt Utilities", () => {
  let mockInterface: any;

  beforeEach(() => {
    mockInterface = {
      question: vi.fn(),
      close: vi.fn(),
    };
    (createInterface as any).mockReturnValue(mockInterface);
  });

  describe("promptConfirm", () => {
    it("resolves true for 'y'", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("y"));
      const result = await promptConfirm("Proceed?");
      expect(result).toBe(true);
    });

    it("resolves true for 'yes'", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("yes"));
      const result = await promptConfirm("Proceed?");
      expect(result).toBe(true);
    });

    it("resolves false for 'n'", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("n"));
      const result = await promptConfirm("Proceed?");
      expect(result).toBe(false);
    });

    it("resolves false for empty", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb(""));
      const result = await promptConfirm("Proceed?");
      expect(result).toBe(false);
    });

    it("case insensitive", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("Y"));
      const result = await promptConfirm("Proceed?");
      expect(result).toBe(true);
    });
  });

  describe("promptWithDefault", () => {
    it("returns answer", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("custom"));
      const result = await promptWithDefault("Value:", "default");
      expect(result).toBe("custom");
    });

    it("returns default when empty", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb(""));
      const result = await promptWithDefault("Value:", "default");
      expect(result).toBe("default");
    });

    it("trims whitespace", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("  spaced  "));
      const result = await promptWithDefault("Value:", "def");
      expect(result).toBe("spaced");
    });
  });

  describe("promptSelect", () => {
    it("returns selected option", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("2"));
      const result = await promptSelect(["opt1", "opt2", "opt3"], "Choose");
      expect(result).toBe("opt2");
    });

    it("returns undefined on empty", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb(""));
      const result = await promptSelect(["a", "b"]);
      expect(result).toBeUndefined();
    });

    it("returns undefined on invalid index", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("5"));
      const result = await promptSelect(["a", "b"]);
      expect(result).toBeUndefined();
    });

    it("handles 1-based indexing", async () => {
      mockInterface.question.mockImplementation((_q: string, cb: (a: string) => void) => cb("1"));
      const result = await promptSelect(["first", "second"]);
      expect(result).toBe("first");
    });
  });
});
