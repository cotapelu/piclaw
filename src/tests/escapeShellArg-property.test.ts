#!/usr/bin/env node

import { describe, it } from 'vitest';
import { escapeShellArg } from '../extensions/tools/subtool-loader.js';
import { fc } from 'fast-check';

describe('Property-based tests for escapeShellArg', () => {
  it('wraps any string in single quotes, and empty string in double quotes', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = escapeShellArg(s);
        const expectedStart = s.length === 0 ? "''" : "'";
        const expectedEnd = s.length === 0 ? "''" : "'";
        return result.startsWith(expectedStart) && result.endsWith(expectedEnd);
      })
    );
  });

  it('escapes each single quote by closing, backslash-escaping, and reopening', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = escapeShellArg(s);
        const inner = result.slice(1, -1);
        const originalCount = (s.match(/'/g) || []).length;
        const escapedCount = (inner.match(/\\'/g) || []).length;
        return escapedCount === originalCount;
      })
    );
  });
});
