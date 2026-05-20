#!/usr/bin/env node

import { describe, it, expect, vi } from 'vitest';
import extensionsIndex from '../extensions/index.js';

describe('extensions/index', () => {
  let mockApi: any;
  beforeEach(() => {
    mockApi = { on: vi.fn(), registerCommand: vi.fn(), registerTool: vi.fn(), registerProvider: vi.fn() };
  });

  it('should register all extensions without throwing', () => {
    expect(() => extensionsIndex(mockApi)).not.toThrow();
    expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(mockApi.registerCommand).toHaveBeenCalledWith('gnpi', expect.any(Object));
    expect(mockApi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'subtool_loader' }));
  });
});
