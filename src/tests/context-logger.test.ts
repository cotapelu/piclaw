#!/usr/bin/env node

import { describe, it, expect, vi } from 'vitest';
import { formatContext, createContextLoggingStreamFn } from '../utils/context-logger.js';

describe('context-logger', () => {
  it('formatContext includes system prompt and tools', () => {
    const msg: any = { role: 'user', content: [{ type: 'text', text: 'hi' }], timestamp: Date.now() };
    const result = formatContext({
      systemPrompt: 'sys',
      messages: [msg],
      tools: [{ name: 'tool', description: 'desc' }],
    });
    expect(result).toContain('SYSTEM PROMPT');
    expect(result).toContain('AVAILABLE TOOLS');
  });

  it('respects maxMessages', () => {
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      role: 'user' as const,
      content: [{ type: 'text' as const, text: `m${i}` }],
      timestamp: Date.now(),
    }));
    const result = formatContext({ systemPrompt: '', messages: msgs as any }, { maxMessages: 2 });
    expect(result).toContain('m0');
    expect(result).not.toContain('m2');
  });

  it('createContextLoggingStreamFn returns original result', async () => {
    const mockOriginal = vi.fn().mockResolvedValue({ result: 'ok' });
    const wrapped = createContextLoggingStreamFn(mockOriginal, '/tmp/log');
    const result = await wrapped('model', { systemPrompt: '', messages: [] }, {});
    expect(result).toEqual({ result: 'ok' });
  });
});
