import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger } from "../utils/logger.js";

describe("Logger", () => {
  let originalLogLevel: string | undefined;
  let originalLogFormat: string | undefined;

  beforeEach(() => {
    // Store original values
    originalLogLevel = process.env.PICLAW_LOG_LEVEL;
    originalLogFormat = process.env.PICLAW_LOG_FORMAT;

    // Set defaults
    process.env.PICLAW_LOG_LEVEL = "info";
    process.env.PICLAW_LOG_FORMAT = "pretty";

    // Spy on console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clear call history first
    vi.clearAllMocks();

    // Restore console mocks to originals
    vi.restoreAllMocks();

    // Restore original env
    if (originalLogLevel !== undefined) {
      process.env.PICLAW_LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.PICLAW_LOG_LEVEL;
    }
    if (originalLogFormat !== undefined) {
      process.env.PICLAW_LOG_FORMAT = originalLogFormat;
    } else {
      delete process.env.PICLAW_LOG_FORMAT;
    }
  });

  describe("Log Levels", () => {
    it("should log info messages when level is info", () => {
      logger.info("Test info");
      expect(console.log).toHaveBeenCalledTimes(1);
      const callArg = console.log.mock.calls[0][0];
      expect(typeof callArg).toBe("string");
      expect(callArg).toContain("Test info");
    });

    it("should not log debug messages when level is info", () => {
      logger.debug("Test debug");
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should log warn messages when level is info", () => {
      logger.warn("Test warn");
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn.mock.calls[0][0]).toContain("Test warn");
    });

    it("should log error messages when level is info", () => {
      logger.error("Test error");
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error.mock.calls[0][0]).toContain("Test error");
    });

    it("should log debug messages when level is debug", () => {
      process.env.PICLAW_LOG_LEVEL = "debug";
      logger.debug("Test debug");
      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log.mock.calls[0][0]).toContain("Test debug");
    });
  });

  describe("JSON Format", () => {
    beforeEach(() => {
      process.env.PICLAW_LOG_FORMAT = "json";
    });

    it("should format log as JSON with required fields", () => {
      logger.info("JSON test");
      expect(console.log).toHaveBeenCalledTimes(1);
      const callArg = console.log.mock.calls[0][0];
      const parsed = JSON.parse(callArg);
      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("level", "info");
      expect(parsed).toHaveProperty("message", "JSON test");
      // meta should be undefined when not provided
      expect(parsed.meta).toBeUndefined();
    });

    it("should include meta in JSON output when provided", () => {
      logger.warn("JSON with meta", { code: 123, detail: "test" });
      expect(console.warn).toHaveBeenCalledTimes(1);
      const callArg = console.warn.mock.calls[0][0];
      const parsed = JSON.parse(callArg);
      expect(parsed.level).toBe("warn");
      expect(parsed.message).toBe("JSON with meta");
      expect(parsed.meta).toEqual({ code: 123, detail: "test" });
    });

    it("should not include meta field if empty", () => {
      logger.error("JSON no meta");
      expect(console.error).toHaveBeenCalledTimes(1);
      const callArg = console.error.mock.calls[0][0];
      const parsed = JSON.parse(callArg);
      expect(parsed.meta).toBeUndefined();
    });
  });

  describe("Pretty Format", () => {
    it("should prefix error with [ERROR]", () => {
      logger.error("Pretty error");
      expect(console.error).toHaveBeenCalledTimes(1);
      const callArg = console.error.mock.calls[0][0];
      const clean = callArg.replace(/\u001b\[[0-9;]*m/g, "");
      expect(clean).toContain("[ERROR] Pretty error");
    });

    it("should prefix warn with [WARN]", () => {
      logger.warn("Pretty warn");
      expect(console.warn).toHaveBeenCalledTimes(1);
      const callArg = console.warn.mock.calls[0][0];
      const clean = callArg.replace(/\u001b\[[0-9;]*m/g, "");
      expect(clean).toContain("[WARN] Pretty warn");
    });

    it("should not prefix info", () => {
      logger.info("Pretty info");
      expect(console.log).toHaveBeenCalledTimes(1);
      const callArg = console.log.mock.calls[0][0];
      const clean = callArg.replace(/\u001b\[[0-9;]*m/g, "");
      expect(clean).toContain("Pretty info");
      expect(clean).not.toContain("[INFO]");
    });
  });

  describe("Alias", () => {
    it("logger.log should behave like logger.info", () => {
      logger.log("Alias test");
      expect(console.log).toHaveBeenCalledTimes(1);
      const callArg = console.log.mock.calls[0][0];
      // In pretty format, it should contain the message
      expect(callArg).toContain("Alias test");
    });
  });
});
