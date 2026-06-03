#!/usr/bin/env node

/**
 * Unit tests for main entry point
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules to avoid actually launching the app
vi.mock('../utils/helpers.js', () => ({
  validateApiKeys: vi.fn(),
  ensurePiclawExtensionRegistered: vi.fn(() => Promise.resolve()),
}));

vi.mock('../config/config-manager.js', () => {
  const mockLoadConfig = vi.fn((overrides = {}) => ({
    model: overrides.model,
    thinking: overrides.thinking ?? 'medium',
    tools: overrides.tools ?? ['read', 'bash', 'edit', 'write', 'todos', 'memory', 'echo', 'system-info', 'http'],
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
    session: {
      id: 'test-session',
      sessionManager: {
        getSessionId: () => 'test-session',
        getSessionFile: () => '/tmp/test-session.jsonl',
      },
    } as any,
    dispose: vi.fn(() => Promise.resolve()),
    cwd: '/tmp',
  })),
}));

vi.mock('../interactive-runner.js', () => ({
  runInteractive: vi.fn(() => Promise.resolve()),
}));

vi.mock('../utils/output-guard.js', () => ({
  takeOverStdout: vi.fn(),
  restoreStdout: vi.fn(),
}));

vi.mock('@earendil-works/pi-coding-agent', () => ({
  runPrintMode: vi.fn().mockResolvedValue(0),
  runRpcMode: vi.fn().mockResolvedValue(undefined),
  SessionManager: {},
}));

vi.mock('../package-commands.js', async () => {
  const actual = await vi.importActual('../package-commands.js');
  return {
    ...actual,
    handleInstallCommand: vi.fn().mockResolvedValue(undefined),
    handleRemoveCommand: vi.fn().mockResolvedValue(undefined),
    handleListCommand: vi.fn().mockResolvedValue(undefined),
    handleUpdateCommand: vi.fn().mockResolvedValue(undefined),
    handleInfoCommand: vi.fn().mockResolvedValue(undefined),
    handleHealthCommand: vi.fn().mockResolvedValue(undefined),
    handlePinCommand: vi.fn().mockResolvedValue(undefined),
    handleExportCommand: vi.fn().mockResolvedValue(undefined),
    handleImportCommand: vi.fn().mockResolvedValue(undefined),
  };
});

import { main } from '../main';
import { loadConfig } from '../config/config-manager.js';
import { bootPiclaw } from '../piclaw-core.js';
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInteractive } from '../interactive-runner.js';
import { validateApiKeys, ensurePiclawExtensionRegistered } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { runPrintMode as mockedRunPrintMode, runRpcMode as mockedRunRpcMode } from '@earendil-works/pi-coding-agent';
import { takeOverStdout, restoreStdout } from '../utils/output-guard.js';
import * as pkgCommands from '../package-commands.js';

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

  it('should expand @plan file into messages', async () => {
    const tmpDir = mkdtempSync('/tmp/piclaw-plan-test-');
    const planFile = join(tmpDir, 'plan.txt');
    writeFileSync(planFile, 'Task1\nTask2\n');

    await main([`@plan${planFile}`]);
    const bootArgs = (bootPiclaw as any).mock.calls[0][0];
    expect(bootArgs.files).toEqual([]);
    expect((bootArgs.messages as string[])).toContain('Task1');
    expect((bootArgs.messages as string[])).toContain('Task2');
  });

  it('should handle errors gracefully and exit with code 1', async () => {
    const error = new Error('Bootstrap failed');
    (bootPiclaw as any).mockRejectedValueOnce(error);

    await expect(main([])).rejects.toThrow('process.exit called with 1');
  });

  // Additional error branch tests for coverage
  it('handles ENOENT error', async () => {
    (bootPiclaw as any).mockRejectedValueOnce(new Error('ENOENT: /missing'));
    await expect(main([])).rejects.toThrow('process.exit');
  });

  it('handles EACCES error', async () => {
    (bootPiclaw as any).mockRejectedValueOnce(new Error('EACCES permission denied'));
    await expect(main([])).rejects.toThrow('process.exit');
  });

  it('handles API key error', async () => {
    (bootPiclaw as any).mockRejectedValueOnce(new Error('Invalid API key'));
    await expect(main([])).rejects.toThrow('process.exit');
  });

  it('handles network error', async () => {
    (bootPiclaw as any).mockRejectedValueOnce(new Error('ECONNREFUSED connection refused'));
    await expect(main([])).rejects.toThrow('process.exit');
  });

  it('handles timeout error', async () => {
    (bootPiclaw as any).mockRejectedValueOnce(new Error('request timeout'));
    await expect(main([])).rejects.toThrow('process.exit');
  });

  it('logs full error when verbose is true', async () => {
    // Override config to enable verbose
    loadConfig.mockImplementation((overrides = {}) => ({
      model: overrides.model,
      thinking: overrides.thinking ?? 'medium',
      tools: overrides.tools ?? ['read', 'bash', 'edit', 'write', 'todos', 'memory', 'echo', 'system-info', 'http'],
      sessionDir: overrides.sessionDir,
      verbose: true,
      contextLogFile: overrides.contextLogFile,
    }));
    (bootPiclaw as any).mockRejectedValueOnce(new Error('test error'));
    await expect(main([])).rejects.toThrow('process.exit');
  });

  it('should print stats when --stats flag provided', async () => {
    const mockStats = {
      tokens: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, total: 150 },
      cost: 0.00123,
    };
    const mockSession = {
      getSessionStats: vi.fn().mockReturnValue(mockStats),
      sessionManager: {
        getSessionId: () => 'test-session',
        getSessionFile: () => '/tmp/test-session.jsonl',
      },
    };
    (bootPiclaw as any).mockResolvedValue({
      session: mockSession,
      services: {
        settingsManager: {
          getImageAutoResize: vi.fn().mockReturnValue(true),
        },
      },
      dispose: vi.fn(() => Promise.resolve()),
      cwd: '/tmp',
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

    try {
      await main(['--mode', 'print', '--stats']);
      expect(mockedRunPrintMode).toHaveBeenCalled();
      expect(mockSession.getSessionStats).toHaveBeenCalled();
      const calls = errorSpy.mock.calls.map(c => c[0]);
      const statsLine = calls.find((m: string) => typeof m === 'string' && m.includes('[Stats]'));
      expect(statsLine).toBeDefined();
      if (typeof statsLine === 'string') {
        expect(statsLine).toContain('Tokens: 150');
        expect(statsLine).toContain('Cost: $0.0012');
      }
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});

// Direct unit test for parseOptions (real function)
import { parseOptions } from '../cli/args.js';
describe('parseOptions', () => {
  it('should handle --help and exit', () => {
    expect(() => parseOptions(['--help'])).toThrow('process.exit');
  });
});

describe('main() additional scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set process.exitCode when print mode returns non-zero', async () => {
    const mockSession = {
      getSessionStats: vi.fn().mockReturnValue({ tokens: { total: 0, input: 0, output: 0 }, cost: 0 }),
      sessionManager: {
        getSessionId: () => 'test-session',
        getSessionFile: () => '/tmp/test-session.jsonl',
      },
    };
    (bootPiclaw as any).mockResolvedValue({
      session: mockSession,
      services: { settingsManager: { getImageAutoResize: vi.fn().mockReturnValue(true) } },
      dispose: vi.fn(() => Promise.resolve()),
      cwd: '/tmp',
    });
    mockedRunPrintMode.mockResolvedValue(1); // non-zero exit

    const originalExitCode = process.exitCode;
    await main(['--mode', 'print']);
    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode; // reset
  });

  it('should handle stats retrieval error gracefully', async () => {
    const mockSession = {
      getSessionStats: vi.fn().mockImplementation(() => { throw new Error('stats error'); }),
      sessionManager: {
        getSessionId: () => 'test-session',
        getSessionFile: () => '/tmp/test-session.jsonl',
      },
    };
    (bootPiclaw as any).mockResolvedValue({
      session: mockSession,
      services: { settingsManager: { getImageAutoResize: vi.fn().mockReturnValue(true) } },
      dispose: vi.fn(() => Promise.resolve()),
      cwd: '/tmp',
    });
    const debugSpy = vi.spyOn(logger, 'debug');
    await main(['--mode', 'print', '--stats']);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to retrieve session stats'));
  });

  it('should handle rate limit error (429) specifically', async () => {
    const error = new Error('429 Too Many Requests');
    (bootPiclaw as any).mockRejectedValueOnce(error);
    const errorSpy = vi.spyOn(console, 'error');
    await expect(main([])).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit exceeded'));
  });

  it('should return early if a package command is provided', async () => {
    const spy = vi.spyOn(pkgCommands, 'handlePackageCommand').mockResolvedValueOnce(true);
    await main(['install', 'testpkg']);
    expect(bootPiclaw).not.toHaveBeenCalled();
  });

  it('should pass session flag to bootPiclaw', async () => {
    try {
      await main(['--session', 'custom-session-123']);
    } catch (e) {
      console.log('Caught error in session test:', e);
      throw e;
    }
    const bootArgs = (bootPiclaw as any).mock.calls[0][0];
    expect(bootArgs.session).toBe('custom-session-123');
  });

  it('should pass resume flag to bootPiclaw', async () => {
    await main(['--resume']);
    const bootArgs = (bootPiclaw as any).mock.calls[0][0];
    expect(bootArgs.resume).toBe(true);
  });

  it('should pass continue flag to bootPiclaw', async () => {
    await main(['--continue']);
    const bootArgs = (bootPiclaw as any).mock.calls[0][0];
    expect(bootArgs.continue).toBe(true);
  });

  it('should pass fork flag to bootPiclaw', async () => {
    await main(['--fork', 'fork-id-123']);
    const bootArgs = (bootPiclaw as any).mock.calls[0][0];
    expect(bootArgs.fork).toBe('fork-id-123');
  });

  it('should run in rpc mode', async () => {
    await main(['--mode', 'rpc']);
    expect(mockedRunRpcMode).toHaveBeenCalled();
    expect(takeOverStdout).toHaveBeenCalled();
    expect(restoreStdout).toHaveBeenCalled();
  });

  it('should run in json mode', async () => {
    await main(['--mode', 'json']);
    expect(mockedRunPrintMode).toHaveBeenCalled();
    const callArgs = (mockedRunPrintMode as any).mock.calls[0][1];
    expect(callArgs.mode).toBe('json');
    expect(takeOverStdout).toHaveBeenCalled();
    expect(restoreStdout).toHaveBeenCalled();
  });
});
