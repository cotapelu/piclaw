#!/usr/bin/env node
/**
 * Additional coverage tests for subtool_loader
 * Focus: error paths, caching, HTTP validation, and exception handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubLoaderToolDefinition } from '../extensions/tools/subtool-loader';

// Mock the SDK factories to capture calls and allow configuration
vi.mock("@earendil-works/pi-coding-agent", async () => {
  const actual = await vi.importActual("@earendil-works/pi-coding-agent");
  const mockToolInstance = { execute: vi.fn() };
  const factories = {
    createReadToolDefinition: vi.fn(() => mockToolInstance),
    createLsToolDefinition: vi.fn(() => mockToolInstance),
    createFindToolDefinition: vi.fn(() => mockToolInstance),
    createGrepToolDefinition: vi.fn(() => mockToolInstance),
    createBashToolDefinition: vi.fn(() => mockToolInstance),
  };
  return { ...actual, ...factories };
});

// Import mocked factories after vi.mock
import {
  createReadToolDefinition,
  createLsToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createBashToolDefinition,
} from "@earendil-works/pi-coding-agent";

const createMockContext = (cwd = '/tmp') => ({
  session: { cwd },
  cwd,
});

describe('subtool_loader coverage gaps', () => {
  let tool: ReturnType<typeof createSubLoaderToolDefinition>;
  let mockExecute: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    // Default mockExecute resolves to success
    mockExecute = vi.fn().mockResolvedValue({
      isError: false,
      content: [{ type: 'text', text: 'ok' }],
      details: {},
    });
    // Set each factory's tool execute to this mock
    ;(createReadToolDefinition as any).mockReturnValue({ execute: mockExecute });
    ;(createLsToolDefinition as any).mockReturnValue({ execute: mockExecute });
    ;(createFindToolDefinition as any).mockReturnValue({ execute: mockExecute });
    ;(createGrepToolDefinition as any).mockReturnValue({ execute: mockExecute });
    ;(createBashToolDefinition as any).mockReturnValue({ execute: mockExecute });

    tool = createSubLoaderToolDefinition();
  });

  describe('missing subtool param', () => {
    it('should return error when subtool is missing', async () => {
      const ctx = createMockContext();
      // @ts-ignore - deliberately missing subtool
      const result: any = await tool.execute('call-1', { args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: subtool');
    });
  });

  describe('invalid subtool', () => {
    it('should return error for unknown subtool', async () => {
      const ctx = createMockContext();
      const result: any = await tool.execute('call-1', {
        subtool: 'invalid',
        args: {},
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown sub-tool');
      expect(result.content[0].text).toContain('invalid');
    });
  });

  describe('caching', () => {
    it('should reuse same tool instance for same subtool and context', async () => {
      const ctx = createMockContext('/workspace');
      const result1 = await tool.execute('call-1', { subtool: 'ls', args: {} }, undefined, undefined, ctx);
      const result2 = await tool.execute('call-2', { subtool: 'ls', args: {} }, undefined, undefined, ctx);
      // Both calls should have used the same tool instance (factory called once)
      expect(createLsToolDefinition).toHaveBeenCalledTimes(1);
      // The mockExecute may be called twice (once per call)
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('should use separate tool instances for runtimes with different cwd', async () => {
      const ctx1 = createMockContext('/workspace1');
      const ctx2 = createMockContext('/workspace2');
      await tool.execute('call-1', { subtool: 'ls', args: {} }, undefined, undefined, ctx1);
      await tool.execute('call-2', { subtool: 'ls', args: {} }, undefined, undefined, ctx2);
      expect(createLsToolDefinition).toHaveBeenCalledTimes(2);
    });
  });

  describe('HTTP sub-tool', () => {
    it('should return error if url is missing', async () => {
      const ctx = createMockContext();
      const result: any = await tool.execute('call-1', {
        subtool: 'http',
        args: { method: 'GET' as any },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: url');
    });

    it('should return error if url is invalid', async () => {
      const ctx = createMockContext();
      const result: any = await tool.execute('call-1', {
        subtool: 'http',
        args: { url: 'not-a-url' },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid URL');
    });

    it('should construct curl command with method, headers, body', async () => {
      const ctx = createMockContext();
      mockExecute.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: 'response' }],
        details: {},
      });

      const result = await tool.execute('call-1', {
        subtool: 'http',
        args: {
          url: 'https://api.example.com/data',
          method: 'POST',
          headers: { 'X-Custom': 'value' },
          body: 'payload',
        },
      }, undefined, undefined, ctx);

      expect(result.isError).toBe(false);
      // Verify that the bash tool was called with a properly constructed curl command
      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          command: expect.stringMatching(/^curl /)
        }),
        undefined,
        undefined,
        ctx
      );
      const callArgs = mockExecute.mock.calls[0][1] as any;
      // The command is a string; verify the args inside (quoted separately)
      expect(callArgs.command).toContain('"-X"');
      expect(callArgs.command).toContain('"POST"');
      expect(callArgs.command).toContain('"-H"');
      expect(callArgs.command).toContain('"X-Custom: value"');
      expect(callArgs.command).toContain('"-d"');
      expect(callArgs.command).toContain('"payload"');
      expect(callArgs.command).toContain('"https://api.example.com/data"');
    });

    it('should include details with url, method, headers', async () => {
      const ctx = createMockContext();
      mockExecute.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: 'ok' }],
        details: { status: 200 },
      });

      const result: any = await tool.execute('call-1', {
        subtool: 'http',
        args: { url: 'https://example.com', method: 'GET', headers: { Accept: 'json' } },
      }, undefined, undefined, ctx);

      expect(result.details.url).toBe('https://example.com');
      expect(result.details.method).toBe('GET');
      expect(result.details.headers).toEqual({ Accept: 'json' });
    });

    it('should handle http errors from bash tool', async () => {
      const ctx = createMockContext();
      mockExecute.mockResolvedValue({
        isError: true,
        content: [{ type: 'text', text: 'curl error' }],
        details: { code: 22 },
      });
      const result: any = await tool.execute('call-1', {
        subtool: 'http',
        args: { url: 'https://example.com' },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('curl error');
    });
  });

  describe('other sub-tools (ls, find, grep, read)', () => {
    it('should pass args directly to ls tool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', {
        subtool: 'ls',
        args: { path: '/some/path', all: true },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(createLsToolDefinition).toHaveBeenCalledWith('/tmp', expect.anything());
      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(String),
        { path: '/some/path', all: true },
        undefined,
        undefined,
        ctx
      );
    });

    it('should pass args directly to find tool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', {
        subtool: 'find',
        args: { pattern: '*.ts', path: '/src' },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(createFindToolDefinition).toHaveBeenCalledWith('/tmp', expect.anything());
    });

    it('should pass args directly to grep tool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', {
        subtool: 'grep',
        args: { pattern: 'test', path: '/src', limit: 10 },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(createGrepToolDefinition).toHaveBeenCalledWith('/tmp', expect.anything());
    });

    it('should pass args directly to read tool', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', {
        subtool: 'read',
        args: { path: 'README.md', maxLines: 100 },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(createReadToolDefinition).toHaveBeenCalledWith('/tmp', expect.anything());
    });
  });

  describe('error propagation', () => {
    it('should propagate isError:true from sub-tool', async () => {
      const ctx = createMockContext();
      mockExecute.mockResolvedValue({
        isError: true,
        content: [{ type: 'text', text: 'Sub-tool failed' }],
        details: { reason: 'boom' },
      });
      const result: any = await tool.execute('call-1', {
        subtool: 'read',
        args: { path: 'missing.txt' },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Sub-tool failed');
      expect(result.details.reason).toBe('boom');
    });

    it('should catch exceptions thrown by tool.execute', async () => {
      const ctx = createMockContext();
      mockExecute.mockRejectedValue(new Error('Unexpected failure'));
      const result: any = await tool.execute('call-1', {
        subtool: 'read',
        args: { path: 'file' },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error: Unexpected failure');
      expect(result.details?.error).toBe('Unexpected failure');
    });
  });

  describe('HTTP special cases', () => {
    it('should default method to GET when not provided', async () => {
      const ctx = createMockContext();
      mockExecute.mockResolvedValue({ isError: false, content: [{ type: 'text', text: 'ok' }], details: {} });

      await tool.execute('call-1', {
        subtool: 'http',
        args: { url: 'https://example.com' },
      }, undefined, undefined, ctx);

      const command = mockExecute.mock.calls[0][1].command as string;
      expect(command).not.toContain('-X');
      // Should have -sS --fail and url
      expect(command).toContain('-sS');
      expect(command).toContain('--fail');
      expect(command).toContain('https://example.com');
    });

    it('should not add -d flag when body missing', async () => {
      const ctx = createMockContext();
      await tool.execute('call-1', {
        subtool: 'http',
        args: { url: 'https://example.com' },
      }, undefined, undefined, ctx);
      const command = mockExecute.mock.calls[0][1].command as string;
      expect(command).not.toContain('-d');
    });
  });
});
