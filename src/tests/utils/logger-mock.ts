#!/usr/bin/env node
/**
 * Logger Mock for Testing
 *
 * Provides a mock logger that captures log calls for assertions.
 * Can be used with `vi.mock` to replace the real logger in modules under test.
 */

import type { ExtensionLogger } from "../../extensions/utils/logger.js";

export interface LogCall {
  level: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  args: any[];
}

class LoggerMock implements ExtensionLogger {
  calls: LogCall[] = [];
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  _record(level: LogCall['level'], args: any[]): void {
    if (this.enabled) {
      this.calls.push({ level, args });
    }
  }

  log(...args: any[]): void { this._record('log', args); }
  error(...args: any[]): void { this._record('error', args); }
  warn(...args: any[]): void { this._record('warn', args); }
  info(...args: any[]): void { this._record('info', args); }
  debug(...args: any[]): void { this._record('debug', args); }
  trace(...args: any[]): void { this._record('trace', args); }

  clear(): void {
    this.calls = [];
  }

  getCalls(level?: LogCall['level']): LogCall[] {
    if (!level) return this.calls;
    return this.calls.filter(c => c.level === level);
  }

  assertCalledWith(level: LogCall['level'], expectedArgs: any[], message?: string): void {
    const matches = this.calls.filter(c => c.level === level && this.argsMatch(c.args, expectedArgs));
    expect(matches.length).toBeGreaterThan(0);
    if (matches.length === 0) {
      throw new Error(message || `Expected logger to be called with ${JSON.stringify(expectedArgs)} at level ${level}`);
    }
  }

  assertNotCalledWith(level: LogCall['level'], unexpectedArgs: any[]): void {
    const matches = this.calls.filter(c => c.level === level && this.argsMatch(c.args, unexpectedArgs));
    expect(matches.length).toBe(0);
  }

  private argsMatch(actual: any[], expected: any[]): boolean {
    if (expected.length !== actual.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] instanceof Error) {
        if (!(actual[i] instanceof Error) || actual[i].message !== expected[i].message) return false;
      } else if (actual[i] !== expected[i]) {
        return false;
      }
    }
    return true;
  }
}

export function createMockLogger(): LoggerMock {
  return new LoggerMock();
}

export function createSilentLogger(): LoggerMock {
  return new LoggerMock(false);
}

/**
 * Helper to mock the logger module for ViTESt.
 *
 * Usage in a test file:
 *   import { mockLogger, setupLoggerMock } from './utils/logger-mock.js';
 *   setupLoggerMock(); // internally does vi.mock(...) and returns mock
 *
 * OR manually:
 *   import { mockExtensionLogger } from './utils/logger-mock.js';
 *   vi.mock('../../extensions/utils/logger.js', () => ({ createLogger: () => mockExtensionLogger, logger: mockExtensionLogger }));
 */
export function createExtensionLoggerMock() {
  const mock = createMockLogger();
  return {
    mock,
    createLogger: (tag?: string) => mock,
    logger: mock,
  };
}
