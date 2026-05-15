#!/usr/bin/env node

/**
 * Unit tests for apt.ts sub-tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApt, aptSchema } from '../extensions/tools/sub-tools/apt';

describe('apt tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = {
      cwd: '/tmp',
      exec: vi.fn(),
    };
  });

  describe('schema', () => {
    it('aptSchema should be defined', () => {
      expect(aptSchema).toBeDefined();
      expect(aptSchema.type).toBe('object');
    });
  });

  describe('executeApt', () => {
    it('should execute apt-get install with packages', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'installed', stderr: '' });

      const result = await executeApt({ command: 'install', packages: ['nginx'] }, '/tmp', undefined, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith('apt-get', ['-y', 'install', 'nginx'], { cwd: '/tmp', signal: undefined, timeout: 60000 });
      expect(result.isError).toBe(false);
      expect(result.details?.command).toBe('install');
    });

    it('should execute apt-get remove', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'removed', stderr: '' });

      const result = await executeApt({ command: 'remove', packages: ['vim'] }, '/tmp', undefined, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith('apt-get', ['-y', 'remove', 'vim'], { cwd: '/tmp', signal: undefined, timeout: 60000 });
      expect(result.isError).toBe(false);
    });

    it('should execute apt list when command is list', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'Listing...', stderr: '' });

      await executeApt({ command: 'list', packages: ['nginx'] }, '/tmp', undefined, mockCtx);

      const call = mockCtx.exec.mock.calls[0];
      const tool = call[0];
      const args = call[1];
      expect(tool).toBe('apt');
      expect(args).toEqual(['nginx', '--installed']);
    });

    it('should execute apt-cache search', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'results', stderr: '' });

      await executeApt({ command: 'search', packages: ['apache'] }, '/tmp', undefined, mockCtx);

      const call = mockCtx.exec.mock.calls[0];
      expect(call[0]).toBe('apt-cache');
      expect(call[1]).toEqual(['search', 'apache']);
    });

    it('should execute apt-cache show', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'info', stderr: '' });

      await executeApt({ command: 'show', packages: ['curl'] }, '/tmp', undefined, mockCtx);

      const call = mockCtx.exec.mock.calls[0];
      expect(call[0]).toBe('apt-cache');
      expect(call[1]).toEqual(['show', 'curl']);
    });

    it('should execute apt-get update then install when update flag set', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'ok', stderr: '' });

      await executeApt({ command: 'install', packages: ['nginx'], update: true }, '/tmp', undefined, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledTimes(2);
      expect(mockCtx.exec.mock.calls[0][0]).toBe('apt-get');
      expect(mockCtx.exec.mock.calls[0][1]).toEqual(['update']);
      expect(mockCtx.exec.mock.calls[1][0]).toBe('apt-get');
      expect(mockCtx.exec.mock.calls[1][1]).toEqual(['-y', 'install', 'nginx']);
    });

    it('should handle error exit code', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'error' });

      const result = await executeApt({ command: 'install', packages: ['foo'] }, '/tmp', undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('error');
    });

    it('should handle exceptions', async () => {
      mockCtx.exec = vi.fn().mockRejectedValue(new Error('exec failed'));

      const result = await executeApt({ command: 'install', packages: ['foo'] }, '/tmp', undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('apt error');
    });

    it('should pass timeout from args', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });

      await executeApt({ command: 'install', packages: ['nginx'], timeout: 60 }, '/tmp', undefined, mockCtx);

      const lastCallOpts = mockCtx.exec.mock.calls[mockCtx.exec.mock.calls.length - 1][2];
      expect(lastCallOpts.timeout).toBe(60);
    });
  });
});
