#!/usr/bin/env node

/**
 * Unit tests for read.ts sub-tool using real file system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeRead, readSchema } from '../extensions/tools/sub-tools/computer-use';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('read tool', () => {
  let tempDir: string;

  beforeEach(() => {
    const originalHome = homedir();
    tempDir = join(originalHome, '.piclaw-test-read');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('readSchema should be defined', () => {
    expect(readSchema).toBeDefined();
    expect(readSchema.type).toBe('object');
  });

  it('should read entire file', async () => {
    const filePath = join(tempDir, 'test.txt');
    writeFileSync(filePath, 'line1\nline2\nline3', 'utf-8');

    const result = await executeRead({ path: filePath }, tempDir, undefined, {});

    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain('line1');
    expect(text).toContain('line2');
    expect(text).toContain('line3');
    const details = result.details as any;
    expect(details.totalLines).toBe(3);
    expect(details.returnedLines).toBe(3);
    // No limit means not truncated (undefined)
    expect(details.truncated).toBeFalsy();
  });

  it('should respect offset and limit', async () => {
    const filePath = join(tempDir, 'test.txt');
    writeFileSync(filePath, 'a\nb\nc\nd\ne', 'utf-8');

    const result = await executeRead({ path: filePath, offset: 2, limit: 2 }, tempDir, undefined, {});

    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain('b');
    expect(text).toContain('c');
    // offset 2 should skip first line
    const lines = text.split('\n');
    expect(lines[0]).toBe('b');
    expect(lines[1]).toBe('c');
    const details = result.details as any;
    expect(details.returnedLines).toBe(2);
    expect(details.totalLines).toBe(5);
    // Since limit < total, result is truncated
    expect(details.truncated).toBe(true);
  });

  it('should truncate when limit less than total lines', async () => {
    const filePath = join(tempDir, 'test.txt');
    writeFileSync(filePath, 'x\ny\nz', 'utf-8');

    const result = await executeRead({ path: filePath, limit: 2 }, tempDir, undefined, {});

    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain('[Truncated: 2/3 lines]');
    const details = result.details as any;
    expect(details.truncated).toBe(true);
  });

  it('should handle file not found', async () => {
    const filePath = join(tempDir, 'nonexistent.txt');

    const result = await executeRead({ path: filePath }, tempDir, undefined, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });

  it('should treat offset <=1 as 0', async () => {
    const filePath = join(tempDir, 'test.txt');
    writeFileSync(filePath, 'first\nsecond', 'utf-8');

    const result = await executeRead({ path: filePath, offset: 1 }, tempDir, undefined, {});

    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain('first');
  });
});
