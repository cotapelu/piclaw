import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { takeOverStdout, restoreStdout, clearBuffer } from "../utils/output-guard";

describe("OutputGuard", () => {
  let writeSpy: any;

  beforeEach(() => {
    // Clean any previous hijack
    try { restoreStdout(); } catch {}
    // Spy on process.stdout.write before hijack
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    // Cleanup
    try { restoreStdout(); } catch {}
    if (writeSpy && writeSpy.mockRestore) {
      writeSpy.mockRestore();
    }
  });

  describe("takeOverStdout", () => {
    it("should replace process.stdout.write with hijacked version", () => {
      takeOverStdout();

      // Call write on stdout (now hijacked)
      const result = (process.stdout as any).write("hello");
      expect(result).toBe(true);

      // Original write should NOT have been called
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it("should not double-hijack on multiple calls", () => {
      takeOverStdout();
      takeOverStdout(); // second call should be safe

      // The hijacked write should still work
      const result = (process.stdout as any).write("test");
      expect(result).toBe(true);
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe("restoreStdout", () => {
    it("should flush buffered data to original write", () => {
      takeOverStdout();

      // Write while hijacked (goes to buffer)
      (process.stdout as any).write("buffered1");
      (process.stdout as any).write("buffered2");

      // Restore
      restoreStdout();

      // Original write should have been called with buffered chunks
      expect(writeSpy).toHaveBeenCalledWith("buffered1");
      expect(writeSpy).toHaveBeenCalledWith("buffered2");
    });

    it("should clear buffer after restore", () => {
      takeOverStdout();
      (process.stdout as any).write("data");

      // Spy on original after hijack (still same spy)
      const callCount = writeSpy.mock.calls.length;

      restoreStdout();

      // Should have flushed 'data' exactly once
      expect(writeSpy).toHaveBeenCalledWith("data");
      // No extra calls
      expect(writeSpy.mock.calls.length).toBe(callCount + 1);
    });

    it("should handle no-op if not hijacked", () => {
      // Should not throw
      expect(() => restoreStdout()).not.toThrow();
    });
  });

  describe("clearBuffer", () => {
    it("should clear buffer without affecting hijack", () => {
      takeOverStdout();
      (process.stdout as any).write("a");
      (process.stdout as any).write("b");

      clearBuffer();

      const initialCallCount = writeSpy.mock.calls.length;
      restoreStdout();

      // After clearBuffer, restore should not flush previous data
      expect(writeSpy.mock.calls.length).toBe(initialCallCount);
    });
  });
});
