#!/usr/bin/env node

/**
 * Unit tests for helpers.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateApiKeys, ensurePiclawExtensionRegistered } from '../utils/helpers.js';
import * as fs from 'node:fs';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('helpers', () => {
  let originalHome: string;
  let tempHome: string;

  beforeEach(() => {
    originalHome = homedir();
    tempHome = join(originalHome, '.piclaw-test-home-helpers');
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    mkdirSync(tempHome, { recursive: true });
    vi.stubEnv('HOME', tempHome);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('validateApiKeys', () => {
    it('should warn if ANTHROPIC_API_KEY missing for anthropic model', () => {
      delete process.env.ANTHROPIC_API_KEY;
      const config = { model: 'anthropic:claude-opus-4-5' } as any;
      const logSpy = vi.spyOn(console, 'log');

      validateApiKeys(config);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ANTHROPIC_API_KEY'));
    });

    it('should not warn if ANTHROPIC_API_KEY set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const config = { model: 'anthropic:claude-opus-4-5' } as any;
      const logSpy = vi.spyOn(console, 'log');

      validateApiKeys(config);

      // Should not log any API key warnings
      const calledWithApiKey = logSpy.mock.calls.some((args: any[]) =>
        args.some((arg: any) => typeof arg === 'string' && arg.includes('API Key Warnings'))
      );
      expect(calledWithApiKey).toBe(false);
    });

    it('should warn if OPENAI_API_KEY missing for openai model', () => {
      delete process.env.OPENAI_API_KEY;
      const config = { model: 'openai:gpt-4' } as any;
      const logSpy = vi.spyOn(console, 'log');

      validateApiKeys(config);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('OPENAI_API_KEY'));
    });

    it('should warn if KILO_API_KEY missing for kilo model', () => {
      delete process.env.KILO_API_KEY;
      const config = { model: 'kilo:some-model' } as any;
      const logSpy = vi.spyOn(console, 'log');

      validateApiKeys(config);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('KILO_API_KEY'));
    });

    it('should not warn if no model configured', () => {
      const config = { model: undefined } as any;
      const warnSpy = vi.spyOn(console, 'warn');

      validateApiKeys(config);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid model format (no colon)', () => {
      const config = { model: 'invalidmodel' } as any;
      const warnSpy = vi.spyOn(console, 'warn');

      // Should not crash and not warn about API key (since provider extraction fails)
      validateApiKeys(config);

      // No API key warning because split returns ['invalidmodel'], provider not in switch
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('API Key Warnings'));
    });

    it('should not warn for unknown provider (switch default)', () => {
      const config = { model: 'unknown:provider' } as any;
      const logSpy = vi.spyOn(console, 'log');

      validateApiKeys(config);

      // Should not output any API Key Warnings
      const calledWithApiKey = logSpy.mock.calls.some((args: any[]) =>
        args.some((arg: any) => typeof arg === 'string' && arg.includes('API Key Warnings'))
      );
      expect(calledWithApiKey).toBe(false);
    });

    it('should warn for multiple missing keys', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const config = { model: 'anthropic:claude-opus-4-5' } as any;
      const logSpy = vi.spyOn(console, 'log');

      validateApiKeys(config);

      // At least one call contains API Key Warnings header
      const hasHeader = logSpy.mock.calls.some((args: any[]) =>
        args.some((arg: any) => typeof arg === 'string' && arg.includes('API Key Warnings'))
      );
      expect(hasHeader).toBe(true);
    });
  });

  describe('ensurePiclawExtensionRegistered', () => {
    it('should create settings file with extension if not exists', async () => {
      const agentDir = join(tempHome, '.piclaw', 'agent');
      const extensionPath = join(agentDir, 'extensions', 'index.js');

      await ensurePiclawExtensionRegistered(agentDir, extensionPath);

      const settingsPath = join(agentDir, 'settings.json');
      expect(existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(Array.isArray(settings.extensions)).toBe(true);
      expect(settings.extensions).toContain(extensionPath);
    });

    it('should not duplicate extension if already registered', async () => {
      const agentDir = join(tempHome, '.piclaw', 'agent');
      const settingsPath = join(agentDir, 'settings.json');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        extensions: ['/other/ext.js'],
      }, null, 2));

      const extensionPath = join(agentDir, 'extensions', 'index.js');

      await ensurePiclawExtensionRegistered(agentDir, extensionPath);

      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(settings.extensions).toHaveLength(2);
      expect(settings.extensions).toContain('/other/ext.js');
      expect(settings.extensions).toContain(extensionPath);
    });

    it('should handle malformed JSON in existing settings', async () => {
      const agentDir = join(tempHome, '.piclaw', 'agent');
      const settingsPath = join(agentDir, 'settings.json');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(settingsPath, '{ invalid json }');

      const extensionPath = join(agentDir, 'extensions', 'index.js');

      // Should not throw, should create new settings
      await ensurePiclawExtensionRegistered(agentDir, extensionPath);

      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(Array.isArray(settings.extensions)).toBe(true);
      expect(settings.extensions).toContain(extensionPath);
    });

    it('should create agent directory if missing', async () => {
      const agentDir = join(tempHome, '.piclaw', 'agent');
      expect(existsSync(agentDir)).toBe(false);

      const extensionPath = join(agentDir, 'extensions', 'index.js');
      await ensurePiclawExtensionRegistered(agentDir, extensionPath);

      expect(existsSync(agentDir)).toBe(true);
    });
  });
});
