#!/usr/bin/env node

/**
 * Unit tests for extensions/index.ts
 * Ensures all custom tools and providers are registered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../extensions/providers/kilo-provider.js', () => ({
  registerKiloProvider: vi.fn(),
}));

vi.mock('../extensions/tools/index.js', () => ({
  registerTodosTool: vi.fn(),
  registerMemoryTool: vi.fn(),
  registerEchoTool: vi.fn(),
  registerSystemInfoTool: vi.fn(),
}));

vi.mock('../extensions/auto-memory.js', () => ({
  default: vi.fn(),
}));

vi.mock('../extensions/auto-continue-extension.js', () => ({
  default: vi.fn(),
}));

vi.mock('../tools/subtool-loader.js', () => ({
  createSubLoaderToolDefinition: vi.fn().mockReturnValue({ name: 'mock-tool' }),
}));

// Now import the module after mocks are set up
import extensionIndex from '../extensions/index.js';
import { registerKiloProvider } from '../extensions/providers/kilo-provider.js';
import { registerTodosTool, registerMemoryTool, registerEchoTool, registerSystemInfoTool } from '../extensions/tools/index.js';
import autoContinueExtension from '../extensions/auto-continue-extension.js';

describe('extensions/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function that accepts api', () => {
    expect(typeof extensionIndex).toBe('function');
  });

  const createMockApi = () => ({
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerProvider: vi.fn(),
    on: vi.fn(),
    getFlag: vi.fn(),
  }) as any;

  it('should register kilo provider', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    expect(registerKiloProvider).toHaveBeenCalledWith(mockApi);
  });

  it('should register todos tool', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    expect(registerTodosTool).toHaveBeenCalledWith(mockApi);
  });

  it('should register memory tool', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    expect(registerMemoryTool).toHaveBeenCalledWith(mockApi);
  });

  it('should register echo tool', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    expect(registerEchoTool).toHaveBeenCalledWith(mockApi);
  });

  it('should register system info tool', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    expect(registerSystemInfoTool).toHaveBeenCalledWith(mockApi);
  });

  it('should call all registrations in correct order (not guaranteed but all called)', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    // All mocks should be called exactly once
    expect(registerKiloProvider).toHaveBeenCalledTimes(1);
    expect(registerTodosTool).toHaveBeenCalledTimes(1);
    expect(registerMemoryTool).toHaveBeenCalledTimes(1);
    expect(registerEchoTool).toHaveBeenCalledTimes(1);
    expect(registerSystemInfoTool).toHaveBeenCalledTimes(1);
  });
});
