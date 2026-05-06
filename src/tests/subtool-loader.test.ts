#!/usr/bin/env node

/**
 * Unit tests for subtool_loader tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubLoaderToolDefinition } from '../tools/subtool-loader.js';

// Mock context
const createMockContext = (cwd: string = "/tmp") => ({
  cwd,
  exec: vi.fn(), // not used by create*ToolDefinition but kept for compatibility
});

describe('subtool_loader', () => {
  let mockCtx: any;
  const cwd = "/test/cwd";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext(cwd);
  });

  describe('tool definition', () => {
    it('should create a tool with name "subtool_loader"', () => {
      const tool = createSubLoaderToolDefinition(cwd);
      expect(tool.name).toBe('subtool_loader');
      expect(tool.label).toBe('SubTool Loader');
      expect(tool.description).toContain('Unified tool for system operations');
    });

    it('should have valid schema with available subtools', () => {
      const tool = createSubLoaderToolDefinition(cwd);
      const parameters = tool.parameters as any;
      expect(parameters).toBeDefined();

      // Schema uses Type.String() instead of union of literals for optimization
      // (avoids ~4000 line JSON Schema, reduces to ~15 lines)
      expect(parameters.type).toBe('object');
      expect(parameters.properties.subtool.type).toBe('string');
      // args uses Type.Any() which doesn't have a 'type' property in JSON Schema
      // just verify it exists
      expect(parameters.properties.args).toBeDefined();
    });

    it('should have renderCall and renderResult defined', () => {
      const tool = createSubLoaderToolDefinition(cwd);
      expect(tool.renderCall).toBeDefined();
      expect(tool.renderResult).toBeDefined();
    });
  });

  describe('execute get_schema', () => {
    it('should return schema for bash', async () => {
      const tool = createSubLoaderToolDefinition(cwd);
      const result = await tool.execute('test-schema', {
        subtool: 'get_schema',
        args: { name: 'bash' }
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
      const text = result.content[0].text;
      expect(text).toContain('Schema for sub-tool "bash"');
      expect(text).toContain('command');
    });

    it('should return schema for ls', async () => {
      const tool = createSubLoaderToolDefinition(cwd);
      const result = await tool.execute('test-schema', {
        subtool: 'get_schema',
        args: { name: 'ls' }
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Schema for sub-tool "ls"');
      expect(result.content[0].text).toContain('path');
    });

    it('should return schema for read', async () => {
      const tool = createSubLoaderToolDefinition(cwd);
      const result = await tool.execute('test-schema', {
        subtool: 'get_schema',
        args: { name: 'read' }
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Schema for sub-tool "read"');
      expect(result.content[0].text).toContain('path');
    });

    it('should return error for unknown sub-tool', async () => {
      const tool = createSubLoaderToolDefinition(cwd);
      const result = await tool.execute('test-unknown', {
        subtool: 'get_schema',
        args: { name: 'unknown' }
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown sub-tool');
    });

    it('should return error when name is missing', async () => {
      const tool = createSubLoaderToolDefinition(cwd);
      const result = await tool.execute('test-missing', {
        subtool: 'get_schema',
        args: {}
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing');
    });
  });

  describe('execute other subtools (basic delegation)', () => {
    it('should be able to call bash (does not throw)', async () => {
      const tool = createSubLoaderToolDefinition(cwd);
      // This will actually run a bash command, but that's ok in test environment
      // We're just checking that the delegation works without errors in signature
      // Note: This test runs a real bash command, so we keep it simple
      const result = await tool.execute('test-bash', {
        subtool: 'bash',
        args: { command: 'echo test' }
      }, undefined, undefined, mockCtx);

      // The real bash tool will execute; we check it returns something valid
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('isError');
    });

    it('should be able to call ls', async () => {
      const tool = createSubLoaderToolDefinition(cwd);
      const result = await tool.execute('test-ls', {
        subtool: 'ls',
        args: { path: cwd }
      }, undefined, undefined, mockCtx);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('isError');
    });

    it('should be able to call find', async () => {
      const tool = createSubLoaderToolDefinition(cwd);
      const result = await tool.execute('test-find', {
        subtool: 'find',
        args: { pattern: '*.ts' }
      }, undefined, undefined, mockCtx);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('isError');
    });
  });
});
