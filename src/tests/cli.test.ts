#!/usr/bin/env node

/**
 * Unit tests for cli.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock main before importing cli
vi.mock('./main.js', () => ({
  main: vi.fn().mockResolvedValue(undefined),
}));

// Now import cli - this will execute top-level code
import '../cli.ts';

describe('cli.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set process title', () => {
    expect(process.title).toBe('piclaw');
  });

  it('should set PI_CODING_AGENT env var', () => {
    expect(process.env.PI_CODING_AGENT).toBe('true');
  });

  it('should register unhandledRejection handler', () => {
    // The handlers are set on process; we can't easily test without triggering
    // But we can check they are functions
    expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0);
    expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0);
  });

  it('should call main with args', async () => {
    const { main } = await import('./main.js');
    expect(main).toHaveBeenCalledWith(expect.any(Array));
  });
});
