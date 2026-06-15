#!/usr/bin/env node

import { describe, it, expect, vi } from 'vitest';
import { escapeShellArg } from '../extensions/tools/test-tool.js';

describe('Test Tool Security', () => {
  describe('escapeShellArg', () => {
    it('should escape single quotes by closing and reopening quotes', () => {
      expect(escapeShellArg("foo'bar")).toBe("'foo'\\''bar'");
    });

    it('should wrap entire argument in single quotes', () => {
      expect(escapeShellArg('hello world')).toBe("'hello world'");
    });

    it('should safely escape command substitution and other shell metacharacters', () => {
      expect(escapeShellArg('$(rm -rf /)')).toBe("'$(rm -rf /)'");
    });

    it('should escape semicolons and ampersands', () => {
      expect(escapeShellArg('foo; rm -rf /')).toBe("'foo; rm -rf /'");
    });

    it('should escape pipe and redirection operators', () => {
      expect(escapeShellArg('cat file | grep test > out')).toBe("'cat file | grep test > out'");
    });

    it('should handle empty string', () => {
      expect(escapeShellArg('')).toBe("''");
    });

    it('should wrap alphanumeric strings in quotes', () => {
      expect(escapeShellArg('test123')).toBe("'test123'");
    });

    it('should correctly escape a complex string with nested quotes', () => {
      // Input contains double quotes and single quotes
      const input = `echo "hello"'world'`;
      const result = escapeShellArg(input);
      // Expected: surrounding quotes + internal single quotes escaped as '\\''
      // The exact result is: 'echo "hello'\''world'\'''
      expect(result).toBe("'echo \"hello\"'\\''world'\\'''");
    });
  });

  describe('execute command building', () => {
    it('should construct safe npm test command with escaped file paths', () => {
      const files = [
        "normal-file.test.ts",
        "weird file'name.ts",
        "../../etc/passwd",
        "file$(whoami).ts",
      ];
      const escaped = files.map(escapeShellArg);
      const fileStr = escaped.join(' ');
      const cmd = `npm test -- ${fileStr}`;

      // Verify each file appears properly quoted
      expect(cmd).toContain("'normal-file.test.ts'");
      expect(cmd).toContain("'weird file'\\''name.ts'");
      expect(cmd).toContain("'../../etc/passwd'");
      expect(cmd).toContain("'file$(whoami).ts'");
    });
  });
});
