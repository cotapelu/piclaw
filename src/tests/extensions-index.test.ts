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
  registerUniversalTool: vi.fn(),
}));

vi.mock('../extensions/auto-memory.js', () => ({
  default: vi.fn(),
}));

vi.mock('../extensions/hooks/auto-continue.js', () => ({
  default: vi.fn(),
}));

vi.mock('../extensions/tools/subtool-loader', () => ({
  createSubLoaderToolDefinition: vi.fn().mockReturnValue({ name: 'mock-tool' }),
  registerSubToolLoaderExtension: vi.fn(),
}));

// Now import the module after mocks are set up
import extensionIndex from '../extensions/index.js';
import { registerKiloProvider } from '../extensions/providers/kilo-provider.js';
import { registerTodosTool, registerMemoryTool, registerUniversalTool } from '../extensions/tools/index.js';
import { registerSubToolLoaderExtension } from '../extensions/tools/subtool-loader';
import autoContinueExtension from '../extensions/hooks/auto-continue.js';

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
    registerMessageRenderer: vi.fn(),
    on: vi.fn(),
    registerFlag: vi.fn(),
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

  it('should register universal tool', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    expect(registerUniversalTool).toHaveBeenCalledWith(mockApi);
  });

  it('should register subtool loader extension', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    expect(registerSubToolLoaderExtension).toHaveBeenCalledWith(mockApi);
  });

  it('should call all registrations in correct order (not guaranteed but all called)', () => {
    const mockApi = createMockApi();
    extensionIndex(mockApi);
    // All mocks should be called exactly once
    expect(registerKiloProvider).toHaveBeenCalledTimes(1);
    expect(registerTodosTool).toHaveBeenCalledTimes(1);
    expect(registerMemoryTool).toHaveBeenCalledTimes(1);
    expect(registerUniversalTool).toHaveBeenCalledTimes(1);
    expect(registerSubToolLoaderExtension).toHaveBeenCalledTimes(1);
  });
});
