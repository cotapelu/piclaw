#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import autoContinueExtension from '../extensions/hooks/auto-continue.js';

describe('auto-continue', () => {
  let mockPi: any;
  let mockCtx: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPi = { on: vi.fn(), registerCommand: vi.fn(), sendMessage: vi.fn() };
    mockCtx = { hasUI: true, isIdle: vi.fn().mockReturnValue(false), ui: { notify: vi.fn() } };
  });

  afterEach(() => { vi.useRealTimers(); });

  it('registers command and events', () => {
    autoContinueExtension(mockPi);
    expect(mockPi.registerCommand).toHaveBeenCalledWith('gnpi', expect.any(Object));
    expect(mockPi.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
  });

  it('handler toggles and notifies', () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    handler('on', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('BẬT'), 'info');
  });

  it('sends reminder after timer', async () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    handler('on', mockCtx);
    const onAgentEnd = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    await onAgentEnd?.(undefined, mockCtx);
    await vi.runAllTimersAsync();
    expect(mockPi.sendMessage).toHaveBeenCalledWith(
      { customType: 'auto-continue', content: expect.any(String), display: false },
      { triggerTurn: true, deliverAs: 'followUp' }
    );
  });
});
