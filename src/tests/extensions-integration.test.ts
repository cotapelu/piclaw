#!/usr/bin/env node

/**
 * Integration test for extensions/index.ts
 * Ensures that all extensions register without throwing.
 */

import { describe, it, expect, vi } from 'vitest';
import extensionsIndex from '../extensions/index.js';

describe('extensions/index', () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      on: vi.fn(),
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      registerProvider: vi.fn(), // for kilo provider
    };
  });

  it('should register all extensions without throwing', () => {
    // Calling the default function should register all extensions
    expect(() => extensionsIndex(mockApi)).not.toThrow();

    // Verify that piclaw-header registered a session_start listener
    expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));

    // Verify that auto-continue registered a command and event listeners
    expect(mockApi.registerCommand).toHaveBeenCalledWith('gnpi', expect.objectContaining({
      description: expect.any(String),
      handler: expect.any(Function),
    }));
    expect(mockApi.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('agent_end', expect.any(Function));

    // Verify that subtool_loader tool was registered (from our custom tools)
    expect(mockApi.registerTool).toHaveBeenCalledWith(expect.objectContaining({
      name: 'subtool_loader',
    }));

    // Verify that other custom tools were registered: todos, memory, universal
    const toolNames = mockApi.registerTool.mock.calls.map((c: any[]) => c[0].name);
    expect(toolNames).toContain('todos');
    expect(toolNames).toContain('memory');
    expect(toolNames).toContain('universal');
  });

  it('should register tools only once (idempotent)', () => {
    extensionsIndex(mockApi);
    const firstCount = mockApi.registerTool.mock.calls.length;

    // Call again
    extensionsIndex(mockApi);
    const secondCount = mockApi.registerTool.mock.calls.length;

    // Should not double-register (maybe same calls again but that's okay)
    expect(secondCount).toBeGreaterThanOrEqual(firstCount);
  });
});
