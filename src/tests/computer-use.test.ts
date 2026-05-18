#!/usr/bin/env node

/**
 * Unit tests for computer-use sub-tools (ls, find, grep, read)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeLs, lsSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeFind, findSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeGrep, grepSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeRead, readSchema } from '../extensions/tools/sub-tools/computer-use.js';

// Mock exec result
const mockExecResult = (stdout: string = '', stderr: string = '', code: number = 0, killed: boolean = false) => ({
  stdout,
  stderr,
  code,
  killed,
});

// Mock context with mocked exec
function createMockContext() {
  const exec = vi.fn();
  return { exec };
}

describe('ls sub-tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext();
  });

  it('should have correct schema', () => {
    expect(lsSchema.type).toBe('object');
    expect(lsSchema.properties.path).toBeDefined();
    expect(lsSchema.properties.recursive).toBeDefined();
    expect(lsSchema.properties.all).toBeDefined();
  });

  it('should list current directory by default', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('file1.txt\nfile2.ts\n'));

    const result = await executeLs({}, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(false);
    expect(mockCtx.exec).toHaveBeenCalledWith('ls', ['-l'], expect.objectContaining({ cwd: '/cwd' }));
  });

  it('should list specified path', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeLs({ path: '/custom' }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('ls', ['-l', '/custom'], expect.objectContaining({ cwd: '/custom' }));
  });

  it('should list recursively with -lR', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeLs({ recursive: true }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('ls', ['-lR'], expect.objectContaining({}));
  });

  it('should list all hidden files with -la', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeLs({ all: true }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('ls', ['-la'], expect.objectContaining({}));
  });

  it('should handle ls errors', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('', 'ls: cannot access /missing: No such file or directory', 2));

    const result = await executeLs({ path: '/missing' }, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(true);
    expect(result.details?.exitCode).not.toBe(0);
  });
});

describe('find sub-tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext();
  });

  it('should have correct schema', () => {
    expect(findSchema.type).toBe('object');
    expect(findSchema.properties.path).toBeDefined();
    expect(findSchema.properties.pattern).toBeDefined();
    expect(findSchema.properties.maxDepth).toBeDefined();
  });

  it('should find files by pattern', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('./src/index.ts\n./test/test.ts\n'));

    const result = await executeFind({ pattern: '*.ts' }, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(false);
    expect(mockCtx.exec).toHaveBeenCalledWith('find', ['/cwd', '-name', '*.ts'], expect.objectContaining({ cwd: '/cwd' }));
  });

  it('should respect maxDepth', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeFind({ pattern: '*.js', maxDepth: 2 }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('find', expect.arrayContaining(['-maxdepth', '2', '-name', '*.js']), expect.anything());
  });

  it('should handle custom path', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeFind({ pattern: '*.json' }, '/cwd', undefined, mockCtx, '/custom/path' as any);

    // Actually path is in args, not cwd param
    await executeFind({ pattern: '*.json', path: '/custom/path' }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('find', ['/custom/path', '-name', '*.json'], expect.objectContaining({ cwd: '/cwd' }));
  });

  it('should handle find errors', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('', 'find: unknown predicate `-maxdeptha`', 1));

    const result = await executeFind({ pattern: '*.ts', maxDepth: 10 as any }, '/cwd', undefined, mockCtx); // misuse depth to trigger error maybe

    expect(result.isError).toBe(true);
    expect(result.details?.exitCode).not.toBe(0);
  });
});

describe('grep sub-tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext();
  });

  it('should have correct schema', () => {
    expect(grepSchema.type).toBe('object');
    expect(grepSchema.properties.pattern).toBeDefined();
    expect(grepSchema.properties.path).toBeDefined();
    expect(grepSchema.properties.include).toBeDefined();
    expect(grepSchema.properties.exclude).toBeDefined();
    expect(grepSchema.properties.ignoreCase).toBeDefined();
  });

  it('should search recursively for pattern', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('file1: match\nfile2: match'));

    const result = await executeGrep({ pattern: 'match' }, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(false);
    expect(mockCtx.exec).toHaveBeenCalledWith('grep', ['-r', 'match'], expect.objectContaining({ cwd: '/cwd' }));
  });

  it('should add -i flag for case insensitive', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeGrep({ pattern: 'test', ignoreCase: true }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('grep', expect.arrayContaining(['-i', '-r', 'test']), expect.anything());
  });

  it('should add include/exclude patterns', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeGrep({
      pattern: 'TODO',
      include: '*.ts',
      exclude: 'node_modules'
    }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('grep', expect.arrayContaining(['-r', 'TODO', '--include', '*.ts', '--exclude', 'node_modules']), expect.anything());
  });

  it('should handle grep errors', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('', 'grep: invalid option -- X', 2));

    const result = await executeGrep({ pattern: 'test' }, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(true);
    expect(result.details?.exitCode).not.toBe(0);
  });
});

describe('read sub-tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext();
  });

  it('should have correct schema', () => {
    expect(readSchema.type).toBe('object');
    expect(readSchema.properties.path).toBeDefined();
    expect(readSchema.properties.offset).toBeDefined();
    expect(readSchema.properties.limit).toBeDefined();
  });

  it('should read entire file', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('line1\nline2\nline3'));

    const result = await executeRead({ path: 'file.txt' }, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(false);
    expect(mockCtx.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt'"], expect.objectContaining({ cwd: '/cwd' }));
  });

  it('should apply offset and limit', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('line2\nline3'));

    await executeRead({ path: 'file.txt', offset: 1, limit: 2 }, '/cwd', undefined, mockCtx);

    const [cmd] = mockCtx.exec.mock.calls[0];
    expect(cmd).toBe('bash');
    const bashArgs = mockCtx.exec.mock.calls[0][1];
    expect(bashArgs[0]).toBe('-c');
    expect(bashArgs[1]).toContain("cat 'file.txt' | tail -n +1 | head -n 2");
  });

  it('should handle read errors', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('', "cat: file.txt: No such file or directory", 1));

    const result = await executeRead({ path: 'missing.txt' }, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(true);
    expect(result.details?.exitCode).not.toBe(0);
  });
});
