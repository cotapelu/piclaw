#!/usr/bin/env node

/**
 * Unit tests for CLI argument parser (src/cli/args.ts)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseOptions } from '../cli/args.js';

describe('parseOptions', () => {
  let originalExit: typeof process.exit;

  beforeEach(() => {
    originalExit = process.exit;
    // Spy on process.exit to prevent actual exit during help test
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic parsing', () => {
    it('should parse --cwd', () => {
      const { opts, cliOverrides } = parseOptions(['--cwd', '/my/project']);
      expect(opts.cwd).toBe('/my/project'); // cwd is runtime only, not in cliOverrides
    });

    it('should parse --tools as comma-separated array', () => {
      const { opts, cliOverrides } = parseOptions(['--tools', 'read,bash,edit']);
      expect(opts.tools).toEqual(['read', 'bash', 'edit']);
      expect(cliOverrides.tools).toEqual(['read', 'bash', 'edit']);
    });

    it('should parse --sessionDir', () => {
      const { opts, cliOverrides } = parseOptions(['--sessionDir', '/custom/sessions']);
      expect(opts.sessionDir).toBe('/custom/sessions');
      expect(cliOverrides.sessionDir).toBe('/custom/sessions');
    });

    it('should parse --model', () => {
      const { opts, cliOverrides } = parseOptions(['--model', 'anthropic:claude-opus-4-5']);
      expect(opts.model).toBe('anthropic:claude-opus-4-5');
      expect(cliOverrides.model).toBe('anthropic:claude-opus-4-5');
    });

    it('should parse --thinking with valid levels', () => {
      const levels: Array<"off" | "minimal" | "low" | "medium" | "high" | "xhigh"> = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
      for (const level of levels) {
        const { opts, cliOverrides } = parseOptions(['--thinking', level]);
        expect(opts.thinking).toBe(level);
        expect(cliOverrides.thinking).toBe(level);
      }
    });

    it('should parse --thinking with any string (validation deferred)', () => {
      const { opts, cliOverrides } = parseOptions(['--thinking', 'ultra']);
      expect(opts.thinking).toBe('ultra'); // raw value, config manager will fallback
      expect(cliOverrides.thinking).toBe('ultra');
    });

    it('should parse --verbose flag', () => {
      const { opts, cliOverrides } = parseOptions(['--verbose']);
      expect(opts.verbose).toBe(true);
      expect(cliOverrides.verbose).toBe(true);
    });
  });

  describe('combined options', () => {
    it('should parse multiple options together', () => {
      const { opts, cliOverrides } = parseOptions([
        '--cwd', '/project',
        '--model', 'openai:gpt-4',
        '--thinking', 'high',
        '--verbose'
      ]);

      expect(opts.cwd).toBe('/project');
      expect(opts.model).toBe('openai:gpt-4');
      expect(opts.thinking).toBe('high');
      expect(opts.verbose).toBe(true);

      expect(cliOverrides.model).toBe('openai:gpt-4');
      expect(cliOverrides.thinking).toBe('high');
      expect(cliOverrides.verbose).toBe(true);
    });

    it('should handle options with spaces in args', () => {
      const { opts } = parseOptions(['--cwd', 'path with spaces']);
      expect(opts.cwd).toBe('path with spaces');
    });
  });

  describe('help flag', () => {
    it('should print help and exit when -h', () => {
      expect(() => parseOptions(['-h'])).toThrow('process.exit(0)');
    });

    it('should print help and exit when --help', () => {
      expect(() => parseOptions(['--help'])).toThrow('process.exit(0)');
    });

    it('should print help before exit', () => {
      // Capture console.log to verify help text
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      expect(() => parseOptions(['--help'])).toThrow('process.exit(0)');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Piclaw CLI'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('--cwd'));
      logSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should ignore flag without value', () => {
      const { opts } = parseOptions(['--tools']);
      expect(opts.tools).toBeUndefined();
    });

    it('should ignore unknown flags', () => {
      const { opts } = parseOptions(['--unknown', 'value']);
      expect((opts as any).unknown).toBeUndefined();
    });

    it('should handle empty args', () => {
      const { opts, cliOverrides } = parseOptions([]);
      expect(opts).toEqual({});
      expect(cliOverrides).toEqual({});
    });

    it('should treat flag at end without value as boolean? No, requires value', () => {
      const { opts } = parseOptions(['--verbose', '--cwd']);
      expect(opts.verbose).toBe(true);
      expect(opts.cwd).toBeUndefined(); // --cwd without value ignored
    });

    it('should allow negative numbers as values?', () => {
      // Not applicable for current flags
      const { opts } = parseOptions(['--model', '--test']);
      expect(opts.model).toBe('--test');
    });

    it('should only take first occurrence of a flag (last wins if multiple)', () => {
      const { opts } = parseOptions(['--cwd', '/first', '--cwd', '/second']);
      expect(opts.cwd).toBe('/second'); // last one wins
    });
  });

  describe('session flags', () => {
    it('should set opts.resume true when --resume', () => {
      const { opts } = parseOptions(['--resume']);
      expect(opts.resume).toBe(true);
    });

    it('should set opts.continue true when --continue', () => {
      const { opts } = parseOptions(['--continue']);
      expect(opts.continue).toBe(true);
    });

    it('should set opts.fork when --fork has value', () => {
      const { opts } = parseOptions(['--fork', 'session-id']);
      expect(opts.fork).toBe('session-id');
    });

    it('should not set opts.fork when --fork has no value', () => {
      const { opts } = parseOptions(['--fork']);
      expect(opts.fork).toBeUndefined();
    });
  });

  describe('mode validation', () => {
    it('should log warning for invalid mode value', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      parseOptions(['--mode', 'invalid']);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid mode: invalid'));
      warnSpy.mockRestore();
    });
  });

  describe('unknown flags', () => {
    it('should log warning for unknown flag', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      parseOptions(['--unknownflag']);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown flag: --unknownflag'));
      warnSpy.mockRestore();
    });
  });
});
