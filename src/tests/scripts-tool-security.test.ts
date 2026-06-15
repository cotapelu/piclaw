#!/usr/bin/env node

/**
 * Scripts Tool Security Tests
 *
 * Validates script name sanitization and command escaping.
 */

import { describe, it, expect } from "vitest";
import { escapeShellArg, isValidScriptName } from "../extensions/tools/scripts-tool";

describe("Scripts Tool Security: escapeShellArg", () => {
  it("should escape single quotes", () => {
    expect(escapeShellArg("script'name")).toBe("'script'\\''name'");
  });

  it("should handle empty string", () => {
    expect(escapeShellArg("")).toBe("''");
  });

  it("should not break normal names", () => {
    expect(escapeShellArg("build")).toBe("'build'");
  });
});

describe("Scripts Tool Security: isValidScriptName", () => {
  it("should accept alphanumeric, spaces, hyphens, underscores", () => {
    const valid = ["build", "test:unit", "dev server", "my-script", "my_script", "a123", "start --verbose"];
    for (const name of valid) {
      expect(isValidScriptName(name)).toBe(true);
    }
  });

  it("should reject injection attempts with shell metacharacters", () => {
    const invalid = [
      "test; rm -rf /",
      "test && echo pwned",
      "test$(id)",
      "test`id`",
      "test|cat /etc/passwd",
      "test\ninjection",
      "test'$(echo)'",
      "test\"injection\"",
      "test\\`",
      "test;",
      "test&",
      "test(",
      "test)",
    ];
    for (const name of invalid) {
      expect(isValidScriptName(name)).toBe(false);
    }
  });

  it("should reject path traversal patterns", () => {
    expect(isValidScriptName("../etc/passwd")).toBe(false);
    expect(isValidScriptName("/absolute/path")).toBe(false);
    expect(isValidScriptName("..\\..\\windows")).toBe(false);
  });
});
