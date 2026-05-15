#!/usr/bin/env node

/**
 * Unit tests for main entry point
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules to avoid actually launching the app
vi.mock('../helpers.js', () => ({
  validateApiKeys: vi.fn(),
  ensurePiclawExtensionRegistered: vi.fn(() => Promise.resolve()),
}));

vi.mock('../config/config-manager.js', () => {
  const mockLoadConfig = vi.fn((overrides = {}) => ({
    model: overrides.model,
    thinking: overrides.thinking ?? 'medium',
    tools: overrides.tools ?? ['read', 'bash', 'edit', 'write', 'subtool_loader', 'todos', 'memory', 'echo', 'system-info'],
    sessionDir: overrides.sessionDir,
    verbose: overrides.verbose ?? false,
    contextLogFile: overrides.contextLogFile,
  }));
  return {
    loadConfig: mockLoadConfig,
    getAgentDir: vi.fn(() => '/home/test/.piclaw/agent'),
  };
});

vi.mock('../piclaw-core.js', () => ({
  bootPiclaw: vi.fn(() => Promise.resolve({
    session: { id: 'test-session' } as any,
    dispose: vi.fn(() => Promise.resolve()),
    cwd: '/tmp',
  })),
}));

vi.mock('../interactive-runner.js', () => ({
  runInteractive: vi.fn(() => Promise.resolve()),
}));

import { main } from '../main';
import { loadConfig } from '../config/config-manager.js';
import { bootPiclaw } from '../piclaw-core.js';
import { runInteractive } from '../interactive-runner.js';
import { validateApiKeys, ensurePiclawExtensionRegistered } from '../helpers.js';

describe('main()', () => {
  let origArgv: string[];

  beforeEach(() => {
    origArgv = process.argv;
    vi.clearAllMocks();
    // Mock process.exit to prevent actual exit (cast to any to accept any code)
    vi.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit called with ${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.argv = origArgv;
  });

  it('should load config with empty overrides by default', async () => {
    await main([]);
    expect(loadConfig).toHaveBeenCalledWith({});
  });

  it('should validate API keys', async () => {
    await main([]);
    expect(validateApiKeys).toHaveBeenCalled();
  });

  it('should ensure piclaw extension registered', async () => {
    await main([]);
    expect(ensurePiclawExtensionRegistered).toHaveBeenCalled();
  });

  it('should boot piclaw runtime', async () => {
    await main([]);
    expect(bootPiclaw).toHaveBeenCalled();
  });

  it('should run interactive runner', async () => {
    await main([]);
    expect(runInteractive).toHaveBeenCalled();
  });

  it('should pass parsed CLI args to bootPiclaw', async () => {
    await main([
      '--cwd', '/project',
      '--sessionDir', '/custom/sessions',
      '--tools', 'read,bash',
      '--model', 'openai:gpt-4o',
      '--thinking', 'high',
    ]);

    const actualArg = (bootPiclaw as any).mock.calls[0][0];
    // Check expected properties
    expect(actualArg.cwd).toBe('/project');
    expect(actualArg.agentDir).toBeTypeOf('string');
    expect(actualArg.sessionDir).toBe('/custom/sessions');
    expect(actualArg.tools).toEqual(['read', 'bash']);
    expect(actualArg.model).toBe('openai:gpt-4o');
    expect(actualArg.thinking).toBe('high');
    expect(actualArg.verbose).toBe(false);
    expect(actualArg.contextLogFile).toBeUndefined();
  });

  it('should handle errors gracefully and exit with code 1', async () => {
    const error = new Error('Bootstrap failed');
    (bootPiclaw as any).mockRejectedValueOnce(error);

    await expect(main([])).rejects.toThrow('process.exit called with 1');
  });
});

// Direct unit test for parseOptions (real function)
import { parseOptions } from '../cli/args.js';
describe('parseOptions', () => {
  it('should handle --help and exit', () => {
    expect(() => parseOptions(['--help'])).toThrow('process.exit');
  });
});
