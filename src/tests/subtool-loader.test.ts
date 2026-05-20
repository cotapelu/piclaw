#!/usr/bin/env node

/**
 * Unit tests for subtool_loader tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubLoaderToolDefinition } from '../extensions/tools/subtool-loader';

// Mock context
const createMockContext = (cwd = '/tmp') => ({
  session: { cwd },
  exec: vi.fn(),
});

describe('subtool_loader', () => {
  describe('tool definition', () => {
    it('should create a tool with correct metadata', () => {
      const tool = createSubLoaderToolDefinition() as any;
      expect(tool.name).toBe('subtool_loader');
      expect(tool.label).toBe('SubTool Loader');
      expect(tool.description).toContain('convenience sub-tools');
    });

    it('should have valid schema', () => {
      const tool = createSubLoaderToolDefinition() as any;
      const params = tool.parameters as any;
      expect(params.type).toBe('object');
      expect(params.properties.subtool).toBeDefined();
      expect(params.properties.args).toBeDefined();
      expect(params.required).toContain('subtool');
      expect(params.required).toContain('args');
      expect(params.properties.subtool.enum).toEqual(['http', 'ls', 'find', 'grep', 'read']);
    });
  });

  describe('execute delegation', () => {
    let mockCtx: any;

    beforeEach(() => {
      mockCtx = createMockContext('/cwd');
      mockCtx.exec = vi.fn().mockResolvedValue({ stdout: 'ok', code: 0 });
    });

    it('should delegate http calls to http sub-tool', async () => {
      const tool = createSubLoaderToolDefinition() as any;
      const result = await tool.execute(
        { subtool: 'http', args: { url: 'https://example.com', method: 'GET' } },
        mockCtx
      );

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith('curl', expect.anything(), expect.anything());
    });

    it('should delegate ls calls to ls sub-tool', async () => {
      const tool = createSubLoaderToolDefinition() as any;
      const result = await tool.execute(
        { subtool: 'ls', args: { all: true } },
        mockCtx
      );

      expect(result.isError).toBe(false);
      expect(mockCtx.exec).toHaveBeenCalledWith('ls', expect.arrayContaining(['-la']), expect.anything());
    });

    it('should delegate find calls to find sub-tool', async () => {
      const tool = createSubLoaderToolDefinition() as any;
      await tool.execute(
        { subtool: 'find', args: { pattern: '*.ts' } },
        mockCtx
      );

      expect(mockCtx.exec).toHaveBeenCalledWith('find', expect.arrayContaining(['-name', '*.ts']), expect.anything());
    });

    it('should delegate grep calls to grep sub-tool', async () => {
      const tool = createSubLoaderToolDefinition() as any;
      await tool.execute(
        { subtool: 'grep', args: { pattern: 'test' } },
        mockCtx
      );

      expect(mockCtx.exec).toHaveBeenCalledWith('grep', expect.arrayContaining(['-r', 'test']), expect.anything());
    });

    it('should delegate read calls to read sub-tool', async () => {
      const tool = createSubLoaderToolDefinition() as any;
      await tool.execute(
        { subtool: 'read', args: { path: 'file.txt' } },
        mockCtx
      );

      expect(mockCtx.exec).toHaveBeenCalledWith('bash', expect.arrayContaining(['-c', expect.stringMatching(/cat 'file.txt'/)]), expect.anything());
    });

    it('should return error for unknown sub-tool', async () => {
      const tool = createSubLoaderToolDefinition() as any;
      const result = await tool.execute(
        { subtool: 'unknown', args: {} },
        mockCtx
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown sub-tool');
    });
  });
});
