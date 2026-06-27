#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeLs, lsSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeFind, findSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeGrep, grepSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeRead, readSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { join } from 'node:path';

const mockExecResult = (stdout = '', stderr = '', code = 0) => ({ stdout, stderr, code });

function createMockCtx() {
  return { exec: vi.fn() };
}

describe('computer-use sub-tools', () => {
  describe('lsSchema', () => {
    it('should be an object', () => expect(lsSchema.type).toBe('object'));
  });
  describe('findSchema', () => {
    it('should be an object', () => expect(findSchema.type).toBe('object'));
  });
  describe('grepSchema', () => {
    it('should be an object', () => expect(grepSchema.type).toBe('object'));
  });
  describe('readSchema', () => {
    it('should be an object', () => expect(readSchema.type).toBe('object'));
  });

  describe('executeLs', () => {
    let ctx: any;
    beforeEach(() => { ctx = createMockCtx(); });

    it('should call ls with -l', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeLs({}, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('ls', ['-l'], expect.anything());
    });

    it('should add -la for all', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeLs({ all: true }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('ls', ['-la'], expect.anything());
    });

    it('should add -lR for recursive', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeLs({ recursive: true }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('ls', ['-lR'], expect.anything());
    });
  });

  describe('executeFind', () => {
    let ctx: any;
    beforeEach(() => { ctx = createMockCtx(); });

    it('should build find command', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeFind({ pattern: '*.ts' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('find', ['/cwd', '-name', '*.ts'], expect.anything());
    });

    it('should add maxDepth', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeFind({ pattern: '*.js', maxDepth: 3 }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('find', expect.arrayContaining(['-maxdepth', '3', '-name', '*.js']), expect.anything());
    });
  });

  describe('executeGrep', () => {
    let ctx: any;
    beforeEach(() => { ctx = createMockCtx(); });

    it('should call grep with -r', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeGrep({ pattern: 'test' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('grep', ['-r', 'test'], expect.anything());
    });

    it('should add -i flag', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeGrep({ pattern: 'test', ignoreCase: true }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('grep', expect.arrayContaining(['-i', '-r', 'test']), expect.anything());
    });

    it('should add include/exclude', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeGrep({ pattern: 'test', include: '*.ts', exclude: 'node_modules' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('grep', expect.arrayContaining(['--include', '*.ts', '--exclude', 'node_modules']), expect.anything());
    });
  });

  describe('executeRead', () => {
    let tempDir: string;
    let dummyCtx: any;

    beforeAll(async () => {
      const { mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      tempDir = await mkdtemp(join(tmpdir(), 'piclaw-test-'));
      dummyCtx = {};
    });

    afterAll(async () => {
      const { rm } = await import('node:fs/promises');
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should read entire file', async () => {
      const { writeFile } = await import('node:fs/promises');
      const filePath = join(tempDir, 'file.txt');
      const content = 'Hello, world!';
      await writeFile(filePath, content, 'utf-8');
      const result = await executeRead({ path: 'file.txt' }, tempDir, undefined, dummyCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe(content);
      expect(result.details).toEqual({ exitCode: 0, killed: false, path: 'file.txt', offset: undefined, limit: undefined });
    });

    it('should apply offset (tail)', async () => {
      const { writeFile } = await import('node:fs/promises');
      const lines = ['line1', 'line2', 'line3', 'line4', 'line5'];
      await writeFile(join(tempDir, 'file.txt'), lines.join('\n'), 'utf-8');
      const result = await executeRead({ path: 'file.txt', offset: 3 }, tempDir, undefined, dummyCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe(lines.slice(2).join('\n'));
    });

    it('should apply limit (head)', async () => {
      const { writeFile } = await import('node:fs/promises');
      const lines = ['a', 'b', 'c', 'd'];
      await writeFile(join(tempDir, 'file.txt'), lines.join('\n'), 'utf-8');
      const result = await executeRead({ path: 'file.txt', limit: 2 }, tempDir, undefined, dummyCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('a\nb');
    });

    it('should combine offset and limit', async () => {
      const { writeFile } = await import('node:fs/promises');
      const lines = ['1','2','3','4','5'];
      await writeFile(join(tempDir, 'file.txt'), lines.join('\n'), 'utf-8');
      const result = await executeRead({ path: 'file.txt', offset: 2, limit: 2 }, tempDir, undefined, dummyCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('2\n3');
    });

    it('should return error on path traversal', async () => {
      const result = await executeRead({ path: '../../../etc/passwd' }, tempDir, undefined, dummyCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Path traversal detected');
    });

    it('should return error on absolute path outside cwd', async () => {
      const result = await executeRead({ path: '/etc/passwd' }, tempDir, undefined, dummyCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Path traversal detected');
    });

    it('should read file with single quote in name', async () => {
      const { writeFile } = await import('node:fs/promises');
      const fileName = "file'name.txt";
      await writeFile(join(tempDir, fileName), 'content with quote', 'utf-8');
      const result = await executeRead({ path: fileName }, tempDir, undefined, dummyCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('content with quote');
    });

    it('should return error when file missing', async () => {
      const result = await executeRead({ path: 'missing.txt' }, tempDir, undefined, dummyCtx);
      expect(result.isError).toBe(true);
      const text = result.content[0].text;
      expect(text).toMatch(/no such file|ENOENT/i);
    });
  });
});
