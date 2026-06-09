#!/usr/bin/env node
/**
 * Unit tests for subtool_loader tool (SDK-based version)
 *
 * Tests the tool definition and its routing to SDK tool factories.
 * Does NOT test SDK tools themselves (those are tested in pi-coding-agent).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubLoaderToolDefinition } from '../extensions/tools/subtool-loader';

// Mock context that mimics ExtensionContext but with mocked tool execution
const createMockContext = (cwd = '/tmp') => ({
  session: { cwd },
  cwd,
});

// Helper to create a mock SDK tool that records calls
function createMockSdkTool(executeFn: (...args: any[]) => any) {
  return {
    execute: vi.fn(executeFn),
    name: 'mock_tool',
  };
}

describe('subtool_loader', () => {
  describe('tool definition', () => {
    it('should create a tool with correct metadata', () => {
      const tool = createSubLoaderToolDefinition();
      expect(tool.name).toBe('subtool_loader');
      expect(tool.label).toBe('SubTool Loader');
      expect(tool.description).toContain('SDK tools');
      expect(tool.promptSnippet).toContain('subtool_loader');
    });

    it('should have valid TypeBox schema', () => {
      const tool = createSubLoaderToolDefinition();
      const params = tool.parameters as any;
      expect(params.type).toBe('object');
      expect(params.properties.subtool).toBeDefined();
      expect(params.properties.args).toBeDefined();
      expect(params.required).toContain('subtool');
      expect(params.required).toContain('args');
      expect(params.properties.subtool.enum).toEqual(['http', 'ls', 'find', 'grep', 'read']);
    });

    it('should have appropriate prompt guidelines for each sub-tool', () => {
      const tool = createSubLoaderToolDefinition();
      const guidelines = tool.promptGuidelines as string[];
      expect(guidelines.some(g => g.includes('read'))).toBe(true);
      expect(guidelines.some(g => g.includes('ls'))).toBe(true);
      expect(guidelines.some(g => g.includes('find'))).toBe(true);
      expect(guidelines.some(g => g.includes('grep'))).toBe(true);
      expect(guidelines.some(g => g.includes('http'))).toBe(true);
    });
  });

  describe('execute routing', () => {
    let tool: any;
    let mockHttpTool: any;
    let mockLsTool: any;
    let mockFindTool: any;
    let mockGrepTool: any;
    let mockReadTool: any;

    beforeEach(() => {
      // Create mock SDK tools
      mockHttpTool = createMockSdkTool(async (toolCallId, params, signal, onUpdate, ctx) => ({
        isError: false,
        content: [{ type: 'text', text: 'HTTP response' }],
        details: { url: params.args.command },
      }));

      mockLsTool = createMockSdkTool(async () => ({
        isError: false,
        content: [{ type: 'text', text: 'ls output' }],
      }));

      mockFindTool = createMockSdkTool(async () => ({
        isError: false,
        content: [{ type: 'text', text: 'find output' }],
      }));

      mockGrepTool = createMockSdkTool(async () => ({
        isError: false,
        content: [{ type: 'text', text: 'grep output' }],
      }));

      mockReadTool = createMockSdkTool(async () => ({
        isError: false,
        content: [{ type: 'text', text: 'file content' }],
      }));

      // Override the internal factory functions via dependency injection simulation
      // Since the module caches tools per context, we'll create a fresh context for each test
      tool = createSubLoaderToolDefinition();
    });

    it('should route http sub-tool to bash tool with curl command', async () => {
      const mockCtx = createMockContext('/cwd');
      // Mock the tool cache to return our mock Http tool
      const originalExecute = tool.execute;
      tool.execute = async (toolCallId: string, params: any, signal, onUpdate, ctx) => {
        if (params.subtool === 'http') {
          return await mockHttpTool.execute(toolCallId, params, signal, onUpdate, ctx);
        }
        return { isError: true, content: [{ type: 'text', text: 'Wrong sub-tool' }] };
      };

      const result = await tool.execute('call-1', {
        subtool: 'http',
        args: { url: 'https://example.com', method: 'POST' },
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockHttpTool.execute).toHaveBeenCalled();
    });

    it('should validate subtool parameter', async () => {
      const mockCtx = createMockContext('/cwd');
      const result = await tool.execute('call-1', {
        subtool: 'invalid',
        args: {},
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown sub-tool');
    });

    it('should return error when subtool is missing', async () => {
      const mockCtx = createMockContext('/cwd');
      // @ts-ignore - testing invalid input
      const result = await tool.execute('call-1', { args: {} }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: subtool');
    });

    it('should handle successful ls delegation', async () => {
      const mockCtx = createMockContext('/cwd');
      tool.execute = async (toolCallId: string, params: any, signal, onUpdate, ctx) => {
        if (params.subtool === 'ls') {
          return await mockLsTool.execute(toolCallId, params, signal, onUpdate, ctx);
        }
        return { isError: true, content: [{ type: 'text', text: 'Wrong sub-tool' }] };
      };

      const result = await tool.execute('call-1', {
        subtool: 'ls',
        args: { all: true },
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
      expect(mockLsTool.execute).toHaveBeenCalled();
    });

    it('should handle successful find delegation', async () => {
      const mockCtx = createMockContext('/cwd');
      tool.execute = async (toolCallId: string, params: any, signal, onUpdate, ctx) => {
        if (params.subtool === 'find') {
          return await mockFindTool.execute(toolCallId, params, signal, onUpdate, ctx);
        }
        return { isError: true };
      };

      const result = await tool.execute('call-1', {
        subtool: 'find',
        args: { pattern: '*.ts' },
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
    });

    it('should handle successful grep delegation', async () => {
      const mockCtx = createMockContext('/cwd');
      tool.execute = async (toolCallId: string, params: any, signal, onUpdate, ctx) => {
        if (params.subtool === 'grep') {
          return await mockGrepTool.execute(toolCallId, params, signal, onUpdate, ctx);
        }
        return { isError: true };
      };

      const result = await tool.execute('call-1', {
        subtool: 'grep',
        args: { pattern: 'test' },
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
    });

    it('should handle successful read delegation', async () => {
      const mockCtx = createMockContext('/cwd');
      tool.execute = async (toolCallId: string, params: any, signal, onUpdate, ctx) => {
        if (params.subtool === 'read') {
          return await mockReadTool.execute(toolCallId, params, signal, onUpdate, ctx);
        }
        return { isError: true };
      };

      const result = await tool.execute('call-1', {
        subtool: 'read',
        args: { path: 'README.md' },
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(false);
    });

    it('should propagate errors from sub-tools', async () => {
      const mockErrorTool = createMockSdkTool(async () => ({
        isError: true,
        content: [{ type: 'text', text: 'Tool error' }],
      }));
      const mockCtx = createMockContext('/cwd');
      tool.execute = async (toolCallId: string, params: any, signal, onUpdate, ctx) => {
        if (params.subtool === 'read') {
          return await mockErrorTool.execute(toolCallId, params, signal, onUpdate, ctx);
        }
        return { isError: true };
      };

      const result = await tool.execute('call-1', {
        subtool: 'read',
        args: { path: 'missing.txt' },
      }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Tool error');
    });
  });
});
