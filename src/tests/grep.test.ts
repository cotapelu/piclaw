#!/usr/bin/env node

/**
 * Unit tests for grep.ts sub-tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGrep, grepSchema } from '../extensions/tools/sub-tools/computer-use';

describe('grep tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = {
      cwd: '/tmp',
      exec: vi.fn(),
    };
  });

  it('grepSchema should be defined', () => {
    expect(grepSchema).toBeDefined();
    expect(grepSchema.type).toBe('object');
  });

  it('should execute grep without ignoreCase', async () => {
    mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'line1\nline2', stderr: '' });

    const result = await executeGrep({ pattern: 'test', path: '/tmp' }, '/tmp', undefined, mockCtx);

    const args = mockCtx.exec.mock.calls[0][1];
    expect(args[0]).toBe('-r');
    expect(args[1]).toBe('test');
    expect(args[2]).toBe('/tmp');
    expect(result.isError).toBe(false);
  });

  it('should add -i flag when ignoreCase true', async () => {
    mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'matches', stderr: '' });

    await executeGrep({ pattern: 'test', path: '/tmp', ignoreCase: true }, '/tmp', undefined, mockCtx);

    const args = mockCtx.exec.mock.calls[0][1];
    expect(args[1]).toBe('-i'); // -i comes after -r
    expect(args[2]).toBe('test');
  });

  it('should handle no matches (exit code 1)', async () => {
    mockCtx.exec = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: '' });

    const result = await executeGrep({ pattern: 'nonexistent' }, '/tmp', undefined, mockCtx);

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('(no matches)');
  });

  it('should handle grep error (exit code > 1)', async () => {
    mockCtx.exec = vi.fn().mockResolvedValue({ code: 2, stdout: '', stderr: 'grep error' });

    const result = await executeGrep({ pattern: 'test' }, '/tmp', undefined, mockCtx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('grep error');
  });

  it('should truncate results when exceeding limit', async () => {
    const manyLines = Array.from({ length: 150 }, (_, i) => `match${i}: test`).join('\n');
    mockCtx.exec = vi.fn().mockResolvedValue({ code: 1, stdout: manyLines, stderr: '' });

    const result = await executeGrep({ pattern: 'test', limit: 50 }, '/tmp', undefined, mockCtx);

    expect(result.isError).toBe(false);
    const details = result.details as any;
    expect(details.truncated).toBe(true);
    expect(details.returned).toBe(50);
    expect(result.content[0].text).toContain('[Truncated: 50/150]');
  });
});
