#!/usr/bin/env node
/**
 * Unit tests for core logger (src/utils/logger.ts) - coverage gaps
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs/promises to avoid file system access in initLogger
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// Now import the logger module
import {
  setLogLevel,
  getLogLevel,
  setQuietMode,
  logger as coreLogger,
  initLogger,
  formatLog,
  createLogger,
} from '../utils/logger';
import * as fs from 'node:fs/promises';

describe('Core Logger (coverage gaps)', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    // Reset state
    setLogLevel('info' as any);
    setQuietMode(false);
    // Mock implementation of readFile for each test; default to rejection (no config)
    (fs.readFile as any).mockReset().mockRejectedValue(new Error('EACCES'));
    // Setup console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setQuietMode(false);
    setLogLevel('info' as any);
  });

  describe('setLogLevel / getLogLevel', () => {
    it('should default to info', () => {
      expect(getLogLevel()).toBe('info');
    });

    it('should set level correctly', () => {
      setLogLevel('debug');
      expect(getLogLevel()).toBe('debug');
      setLogLevel('trace');
      expect(getLogLevel()).toBe('trace');
      setLogLevel('error');
      expect(getLogLevel()).toBe('error');
    });
  });

  describe('setQuietMode', () => {
    it('should suppress logs when quiet', () => {
      setQuietMode(true);
      coreLogger.info('quiet test');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should allow logs when not quiet', () => {
      setQuietMode(true);
      setQuietMode(false);
      coreLogger.info('not quiet');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('level filtering', () => {
    it('trace only appears at trace level', () => {
      setLogLevel('trace');
      coreLogger.trace('trace-msg');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\[TRACE\].*trace-msg/));
      consoleLogSpy.mockClear();

      setLogLevel('debug');
      coreLogger.trace('no-trace');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('debug appears at trace and debug', () => {
      setLogLevel('trace');
      coreLogger.debug('debug-trace');
      expect(consoleLogSpy).toHaveBeenCalled();

      setLogLevel('debug');
      coreLogger.debug('debug-debug');
      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockClear();

      setLogLevel('info');
      coreLogger.debug('debug-info');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('info appears at trace, debug, info', () => {
      setLogLevel('info');
      coreLogger.info('info-info');
      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockClear();

      setLogLevel('warn');
      coreLogger.info('info-warn');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('warn appears up to warn level', () => {
      setLogLevel('warn');
      coreLogger.warn('warn-warn');
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockClear();

      setLogLevel('error');
      coreLogger.warn('warn-error');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('error appears at all levels', () => {
      for (const level of ['trace', 'debug', 'info', 'warn', 'error'] as const) {
        setLogLevel(level);
        coreLogger.error('error-any');
        expect(consoleErrorSpy).toHaveBeenCalled();
        vi.clearAllMocks();
      }
    });

    it('log alias behaves like info', () => {
      setLogLevel('info');
      coreLogger.log('log-msg');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\[LOG\].*log-msg/));
      consoleLogSpy.mockClear();

      setLogLevel('warn');
      coreLogger.log('log-warn');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('quiet mode overrides level', () => {
    it('suppresses all logs when quiet regardless of level', () => {
      setQuietMode(true);
      setLogLevel('trace');
      coreLogger.trace('trace');
      coreLogger.debug('debug');
      coreLogger.info('info');
      coreLogger.warn('warn');
      coreLogger.error('error');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('structured logging', () => {
    it('outputs JSON with timestamp and level', () => {
      setLogLevel('info');
      coreLogger.structured('info', { event: 'test', val: 42 });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"test"'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"val":42'));
    });

    it('uses console.error for error level', () => {
      setLogLevel('error');
      coreLogger.structured('error', { msg: 'err' });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('respects level thresholds', () => {
      setLogLevel('warn');
      coreLogger.structured('debug', {}); // below threshold
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('respects quiet mode', () => {
      setQuietMode(true);
      coreLogger.structured('error', {});
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // formatLog is internal; covered indirectly through logger method calls.

  describe('initLogger', () => {
    beforeEach(() => {
      vi.stubEnv('PICLAW_LOG_LEVEL', undefined);
    });

    it('uses default when nothing provided', async () => {
      await initLogger();
      expect(getLogLevel()).toBe('info');
    });

    it('uses env.logLevel parameter if valid', async () => {
      await initLogger({ logLevel: 'debug' });
      expect(getLogLevel()).toBe('debug');
    });

    it('ignores invalid env.logLevel', async () => {
      await initLogger({ logLevel: 'invalid' as any });
      expect(getLogLevel()).toBe('info');
    });

    it('uses process.env.PICLAW_LOG_LEVEL if set and valid', async () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'error');
      await initLogger();
      expect(getLogLevel()).toBe('error');
    });

    it('ignores invalid process.env.PICLAW_LOG_LEVEL', async () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'invalid' as any);
      await initLogger();
      expect(getLogLevel()).toBe('info');
    });

    it('parameter overrides environment variable', async () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'error');
      await initLogger({ logLevel: 'debug' });
      expect(getLogLevel()).toBe('debug');
    });

    it('reads config file when present', async () => {
      const fakeConfig = JSON.stringify({ logLevel: 'trace' });
      (fs.readFile as any).mockResolvedValue(fakeConfig as any);
      await initLogger();
      expect(getLogLevel()).toBe('trace');
    });

    it('handles config file parse error', async () => {
      (fs.readFile as any).mockResolvedValue('invalid json{');
      await initLogger();
      expect(getLogLevel()).toBe('info'); // fallback
    });

    it('handles config file read error', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('EACCES'));
      await initLogger();
      expect(getLogLevel()).toBe('info');
    });
  });

  describe('createLogger', () => {
    it('creates logger with all methods', () => {
      const l = createLogger();
      expect(typeof l.trace).toBe('function');
      expect(typeof l.debug).toBe('function');
      expect(typeof l.info).toBe('function');
      expect(typeof l.warn).toBe('function');
      expect(typeof l.error).toBe('function');
      expect(typeof l.log).toBe('function');
      expect(typeof l.structured).toBe('function');
    });

    it('prefixes messages when tag provided', () => {
      const l = createLogger('MyTag');
      l.info('hello');
      // formatLog adds level and timestamp; prefix is included in message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\[MyTag\] hello/));
    });

    it('does not prefix when no tag', () => {
      const l = createLogger();
      l.info('solo');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\[INFO\].*solo/));
    });

    it('respects level filtering like core logger', () => {
      setLogLevel('warn');
      const l = createLogger('TAG');
      l.info('info-msg');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      l.warn('warn-msg');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('respects quiet mode', () => {
      setQuietMode(true);
      const l = createLogger();
      l.error('should be silent');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
