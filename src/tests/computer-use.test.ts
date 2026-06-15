#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeLs, lsSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeFind, findSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeGrep, grepSchema } from '../extensions/tools/sub-tools/computer-use.js';
import { executeRead, readSchema } from '../extensions/tools/sub-tools/computer-use.js';

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
    let ctx: any;
    beforeEach(() => { ctx = createMockCtx(); });

    it('should call cat', async () => {
      ctx.exec.mockResolvedValue(mockExecResult('content'));
      await executeRead({ path: 'file.txt' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt'"], expect.anything());
    });

    it('should pipe to tail for offset', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeRead({ path: 'file.txt', offset: 5 }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', expect.arrayContaining(['-c', expect.stringMatching(/tail -n \+5/)]), expect.anything());
    });

    it('should pipe to head for limit', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeRead({ path: 'file.txt', limit: 10 }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', expect.arrayContaining(['-c', expect.stringMatching(/head -n 10/)]), expect.anything());
    });

    it('should return error result on path traversal outside cwd', async () => {
      const result = await executeRead({ path: '../../../etc/passwd' }, '/cwd', undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Path traversal detected');
      expect(ctx.exec).not.toHaveBeenCalled();
    });

    it('should return error result on absolute path outside cwd', async () => {
      const result = await executeRead({ path: '/etc/passwd' }, '/cwd', undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Path traversal detected');
      expect(ctx.exec).not.toHaveBeenCalled();
    });

    it('should escape single quotes in path', async () => {
      ctx.exec.mockResolvedValue(mockExecResult('content'));
      await executeRead({ path: "file'name.txt" }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file'\\''name.txt'"], expect.anything());
    });

    it('should combine offset and limit correctly', async () => {
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeRead({ path: 'file.txt', offset: 10, limit: 5 }, '/cwd', undefined, ctx);
      const cmd = expect.arrayContaining(['-c', expect.stringMatching(/cat 'file.txt' \| tail -n \+10 \| head -n 5/)]);
      expect(ctx.exec).toHaveBeenCalledWith('bash', cmd, expect.anything());
    });

    it('should pass signal to exec', async () => {
      const signal = new AbortController().signal;
      ctx.exec.mockResolvedValue(mockExecResult(''));
      await executeRead({ path: 'file.txt' }, '/cwd', signal, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', expect.anything(), expect.objectContaining({ signal }));
    });

    it('should return error result when exec fails', async () => {
      ctx.exec.mockResolvedValue({ stdout: '', stderr: 'No such file', code: 1 });
      const result = await executeRead({ path: 'missing.txt' }, '/cwd', undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No such file');
    });
  });
});
