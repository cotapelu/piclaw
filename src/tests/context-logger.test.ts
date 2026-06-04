import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs before importing module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeContextLog, formatContext, createContextLoggingStreamFn } from '../utils/context-logger.js';
import { logger } from '../utils/logger.js';
import type { Message, TextContent, ThinkingContent, ImageContent, ToolCall } from '@earendil-works/pi-ai';

describe('ContextLogger utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSync.mockReturnValue(false);
  });

  describe('formatContext', () => {
    it('should format system prompt and messages', () => {
      const context = {
        systemPrompt: 'You are a helpful assistant.',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      };
      const output = formatContext(context);
      expect(output).toContain('SYSTEM PROMPT');
      expect(output).toContain('You are a helpful assistant.');
      expect(output).toContain('USER');
      expect(output).toContain('Hello');
      expect(output).toContain('ASSISTANT');
      expect(output).toContain('Hi!');
    });

    it('should include tools when provided', () => {
      const context = {
        systemPrompt: '',
        messages: [],
        tools: [
          { name: 'test', description: 'Test tool', parameters: { type: 'object' } },
        ],
      };
      const output = formatContext(context);
      expect(output).toContain('AVAILABLE TOOLS');
      expect(output).toContain('test');
      expect(output).toContain('Test tool');
    });

    it('should respect maxMessages option', () => {
      const context = {
        systemPrompt: '',
        messages: [
          { role: 'user', content: '1' },
          { role: 'assistant', content: '2' },
          { role: 'user', content: '3' },
        ],
      };
      const output = formatContext(context, { maxMessages: 2 });
      expect(output).toContain('1');
      expect(output).toContain('2');
      // Ensure third message is not included by checking absence of its header
      expect(output).not.toContain('--- Message 2');
      // Also ensure the content '3' appears only if it's in message 1? But avoid timestamp digits. Check block count.
      const messageCount = (output.match(/^--- Message \d+/gm) || []).length;
      expect(messageCount).toBe(2);
    });
  });

  describe('writeContextLog', () => {
    it('should write log to file when logFile provided', () => {
      const context = {
        systemPrompt: 'Sys',
        messages: [{ role: 'user', content: 'Msg' }],
      };

      writeContextLog(context, { logFile: '/tmp/test.log', append: false });

      expect(writeFileSync).toHaveBeenCalled();
      expect(writeFileSync.mock.calls[0][0]).toBe('/tmp/test.log');
      expect(writeFileSync.mock.calls[0][1]).toContain('Sys');
    });

    it('should not write if logFile is undefined', () => {
      const context = { systemPrompt: 'S', messages: [] };
      writeContextLog(context); // no logFile
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('should create directory if not exists', () => {
      existsSync.mockReturnValue(false);
      const context = { systemPrompt: 'S', messages: [] };
      writeContextLog(context, { logFile: '/new/dir/test.log' });
      expect(mkdirSync).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });

    it('should handle errors gracefully and log via logger.error', () => {
      const loggerErrorSpy = vi.spyOn(logger, 'error');
      writeFileSync.mockImplementation(() => {
        throw new Error('disk full');
      });

      const context = { systemPrompt: 'S', messages: [] };
      writeContextLog(context, { logFile: '/tmp/error.log' });

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ContextLogger: Failed to write log file'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('createContextLoggingStreamFn', () => {
    it('should write log and call original function', async () => {
      const mockOriginal = vi.fn().mockResolvedValue('result');
      // Ensure fs write is mocked (already mocked)
      const context = { systemPrompt: 'S', messages: [] };
      const wrapped = createContextLoggingStreamFn(mockOriginal, '/tmp/stream.log');

      const result = await wrapped('model', context, {});

      expect(writeFileSync).toHaveBeenCalled(); // log written
      expect(mockOriginal).toHaveBeenCalledWith('model', context, {});
      expect(result).toBe('result');
    });
  });

  describe('formatContext with rich content', () => {
    it('should format messages with array content including text', () => {
      const context = {
        systemPrompt: '',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Array text message' }],
          },
        ],
      };
      const output = formatContext(context);
      expect(output).toContain('Array text message');
    });

    it('should format thinking content truncated', () => {
      const context = {
        systemPrompt: '',
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'thinking', thinking: 'I am thinking deeply about this problem' }],
            timestamp: Date.now(),
          },
        ],
      };
      const output = formatContext(context);
      expect(output).toContain('[THINKING: I am thinking deeply about this problem');
    });

    it('should format image content with mime and data length', () => {
      const data = 'a'.repeat(500);
      const context = {
        systemPrompt: '',
        messages: [
          {
            role: 'user',
            content: [{ type: 'image', mimeType: 'image/jpeg', data }],
          },
        ],
      };
      const output = formatContext(context);
      expect(output).toContain('[IMAGE: image/jpeg (500 chars)]');
    });

    it('should format toolCall content', () => {
      const context = {
        systemPrompt: '',
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'toolCall', name: 'read_file', arguments: { path: '/tmp/test.txt' } }],
          },
        ],
      };
      const output = formatContext(context);
      expect(output).toContain('[TOOL_CALL: read_file({"path":"/tmp/test.txt"})]');
    });

    it('should handle role tool (TOOL_RESULT)', () => {
      const context = {
        systemPrompt: '',
        messages: [
          {
            role: 'tool',
            content: 'Tool result string',
          },
        ],
      };
      const output = formatContext(context);
      expect(output).toContain('TOOL_RESULT');
    });

    it('should include timestamp when present', () => {
      const now = Date.now();
      const context = {
        systemPrompt: '',
        messages: [{ role: 'user', content: 'Hi', timestamp: now }],
      };
      const output = formatContext(context);
      expect(output).toContain(new Date(now).toISOString());
    });

    it('should omit timestamp when absent', () => {
      const context = {
        systemPrompt: '',
        messages: [{ role: 'user', content: 'Hi' }],
      };
      const output = formatContext(context);
      // Format: --- Message 0 (USER, ) ---
      expect(output).toMatch(/--- Message 0 \(USER, \) ---/);
    });
  });

  describe('formatContext options', () => {
    it('should omit tools when includeTools is false', () => {
      const context = {
        systemPrompt: '',
        messages: [],
        tools: [{ name: 'test', description: 'Test tool' }],
      };
      const output = formatContext(context, { includeTools: false });
      expect(output).not.toContain('AVAILABLE TOOLS');
    });

    it('should handle empty messages array', () => {
      const context = { systemPrompt: 'S', messages: [] };
      const output = formatContext(context);
      expect(output).toContain('0 messages');
    });

    it('should not show SYSTEM PROMPT section when empty', () => {
      const context = { systemPrompt: '', messages: [] };
      const output = formatContext(context);
      expect(output).not.toContain('SYSTEM PROMPT');
    });

    it('should respect maxMessages truncation', () => {
      const context = {
        systemPrompt: '',
        messages: [
          { role: 'user', content: '1' },
          { role: 'assistant', content: '2' },
          { role: 'user', content: '3' },
        ],
      };
      const output = formatContext(context, { maxMessages: 2 });
      const match = output.match(/^--- Message \d+/gm) || [];
      expect(match.length).toBe(2);
    });
  });

  describe('writeContextLog append mode', () => {
    it('should use appendFileSync when append is true', () => {
      const context = { systemPrompt: 'S', messages: [] };
      writeContextLog(context, { logFile: '/tmp/append.log', append: true });
      expect(appendFileSync).toHaveBeenCalledWith('/tmp/append.log', expect.any(String));
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('should handle errors in appendFileSync gracefully', () => {
      const loggerErrorSpy = vi.spyOn(logger, 'error');
      appendFileSync.mockImplementation(() => {
        throw new Error('disk full on append');
      });
      const context = { systemPrompt: 'S', messages: [] };
      writeContextLog(context, { logFile: '/tmp/append.log', append: true });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ContextLogger: Failed to write log file'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('createContextLoggingStreamFn error propagation', () => {
    it('should propagate errors from original function', async () => {
      const mockError = new Error('original failed');
      const mockOriginal = vi.fn().mockRejectedValue(mockError);
      const context = { systemPrompt: 'S', messages: [] };
      const wrapped = createContextLoggingStreamFn(mockOriginal, '/tmp/stream.log');
      await expect(wrapped('model', context, {})).rejects.toThrow('original failed');
      // Ensure log was still written before original threw
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

});
