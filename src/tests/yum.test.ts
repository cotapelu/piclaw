#!/usr/bin/env node

/**
 * Unit tests for yum.ts sub-tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeYum, yumSchema } from '../extensions/tools/sub-tools/yum';

describe('yum tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = {
      cwd: '/tmp',
      exec: vi.fn(),
    };
  });

  describe('schema', () => {
    it('yumSchema should be defined', () => {
      expect(yumSchema).toBeDefined();
      expect(yumSchema.type).toBe('object');
    });
  });

  describe('executeYum', () => {
    it('should execute yum -y install', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'installed', stderr: '' });

      const result = await executeYum({ command: 'install', packages: ['nginx'] }, '/tmp', undefined, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith('yum', ['-y', 'install', 'nginx'], { cwd: '/tmp', signal: undefined, timeout: 30000 });
      expect(result.isError).toBe(false);
      expect(result.details?.command).toBe('install');
    });

    it('should execute yum remove', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'removed', stderr: '' });

      const result = await executeYum({ command: 'remove', packages: ['vim'] }, '/tmp', undefined, mockCtx);

      expect(mockCtx.exec).toHaveBeenCalledWith('yum', ['-y', 'remove', 'vim'], { cwd: '/tmp', signal: undefined, timeout: 30000 });
      expect(result.isError).toBe(false);
    });

    it('should execute yum list', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'Listing...', stderr: '' });

      await executeYum({ command: 'list', packages: ['nginx'] }, '/tmp', undefined, mockCtx);

      const tool = mockCtx.exec.mock.calls[0][0];
      const args = mockCtx.exec.mock.calls[0][1];
      expect(tool).toBe('yum');
      expect(args).toEqual(['list', 'nginx']);
    });

    it('should execute yum search', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'results', stderr: '' });

      await executeYum({ command: 'search', packages: ['apache'] }, '/tmp', undefined, mockCtx);

      const tool = mockCtx.exec.mock.calls[0][0];
      const args = mockCtx.exec.mock.calls[0][1];
      expect(tool).toBe('yum');
      expect(args).toEqual(['search', 'apache']);
    });

    it('should execute yum info', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'info', stderr: '' });

      await executeYum({ command: 'info', packages: ['curl'] }, '/tmp', undefined, mockCtx);

      const tool = mockCtx.exec.mock.calls[0][0];
      const args = mockCtx.exec.mock.calls[0][1];
      expect(tool).toBe('yum');
      expect(args).toEqual(['info', 'curl']);
    });

    it('should execute yum check-update', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: 'updates', stderr: '' });

      await executeYum({ command: 'check-update' }, '/tmp', undefined, mockCtx);

      const tool = mockCtx.exec.mock.calls[0][0];
      const args = mockCtx.exec.mock.calls[0][1];
      expect(tool).toBe('yum');
      expect(args).toEqual(['check-update']);
    });

    it('should handle error exit code', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'error' });

      const result = await executeYum({ command: 'install', packages: ['foo'] }, '/tmp', undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('error');
    });

    it('should handle exceptions', async () => {
      mockCtx.exec = vi.fn().mockRejectedValue(new Error('exec failed'));

      const result = await executeYum({ command: 'install', packages: ['foo'] }, '/tmp', undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('yum error');
    });

    it('should pass timeout from args', async () => {
      mockCtx.exec = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });

      await executeYum({ command: 'install', packages: ['nginx'], timeout: 60 }, '/tmp', undefined, mockCtx);

      const lastCallOpts = mockCtx.exec.mock.calls[mockCtx.exec.mock.calls.length - 1][2];
      expect(lastCallOpts.timeout).toBe(60);
    });
  });
});
