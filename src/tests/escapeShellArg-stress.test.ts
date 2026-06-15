#!/usr/bin/env node

import { describe, it } from 'vitest';
import { escapeShellArg } from '../extensions/tools/test-tool.js';

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\'"$&|;<>()[]{}!`';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

describe('escapeShellArg Stress Test', () => {
  it('should handle 1000 random strings without failing invariants', () => {
    for (let i = 0; i < 1000; i++) {
      const s = randomString(20);
      const r = escapeShellArg(s);

      // Invariant 1: result starts and ends with single quotes (except empty string uses '')
      if (s.length === 0) {
        expect(r).toBe("''");
        continue;
      }
      expect(r.startsWith("'")).toBe(true);
      expect(r.endsWith("'")).toBe(true);

      // Invariant 2: count of escaped single quotes inside matches original count
      const originalQuotes = (s.match(/'/g) || []).length;
      const inner = r.slice(1, -1);
      const escapedQuotes = (inner.match(/\\'/g) || []).length;
      expect(escapedQuotes).toBe(originalQuotes);
    }
  });
});
