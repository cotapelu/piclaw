#!/usr/bin/env node

/**
 * Unit tests for universal-tool.ts
 * Tests both echo and system_info actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerUniversalTool } from '../extensions/tools/universal-tool.js';

describe('universal tool', () => {
  let capturedTool: any;
  const mockApi = {
    registerTool: vi.fn((tool: any) => { capturedTool = tool; }),
    on: vi.fn(),
    registerCommand: vi.fn(),
    registerMessageRenderer: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(),
    sendMessage: vi.fn(),
    requestRender: vi.fn(),
  } as any;

  beforeEach(() => {
    capturedTool = undefined;
    mockApi.registerTool.mockClear();
  });

  it('should register the tool', () => {
    registerUniversalTool(mockApi);
    expect(mockApi.registerTool).toHaveBeenCalledTimes(1);
    expect(capturedTool).toBeDefined();
    expect(capturedTool.name).toBe('universal');
  });

  it('should have proper metadata', () => {
    registerUniversalTool(mockApi);
    expect(capturedTool.label).toBe('Universal Tool');
    expect(capturedTool.description).toContain('Multi-purpose');
    expect(capturedTool.parameters.type).toBe('object');
  });

  it('should have action parameter with echo and system_info enum', () => {
    registerUniversalTool(mockApi);
    const params = capturedTool.parameters.properties;
    expect(params.action).toBeDefined();
    expect(params.action.type).toBe('string');
    expect(params.action.enum).toContain('echo');
    expect(params.action.enum).toContain('system_info');
    expect(params.action.required).toBeUndefined(); // top-level required
    expect(capturedTool.parameters.required).toContain('action');
  });

  describe('echo action', () => {
    it('should execute echo action and return message', async () => {
      registerUniversalTool(mockApi);
      const testMessage = 'Hello World';
      const result = await capturedTool.execute('test', { action: 'echo', message: testMessage }, undefined, undefined, { cwd: process.cwd() });

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('details');
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(`Echo: ${testMessage}`);
      expect(result.details).toBe(testMessage);
    });

    it('should throw if message missing for echo', async () => {
      registerUniversalTool(mockApi);
      await expect(capturedTool.execute('test', { action: 'echo' }, undefined, undefined, {})).rejects.toThrow('message');
    });
  });

  describe('system_info action', () => {
    it('should execute system_info action and return real system info', async () => {
      registerUniversalTool(mockApi);
      const result = await capturedTool.execute('test', { action: 'system_info' }, undefined, undefined, { cwd: process.cwd() });

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('details');
      expect(result.content[0].type).toBe('text');

      const info = JSON.parse(result.content[0].text);
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('arch');
      expect(info).toHaveProperty('osRelease');
      expect(info).toHaveProperty('nodeVersion');
      expect(info).toHaveProperty('uptime');
      expect(info).toHaveProperty('totalMemoryMB');
      expect(info).toHaveProperty('freeMemoryMB');
      expect(info).toHaveProperty('cpuCores');
      expect(info).toHaveProperty('cpuModel');

      // Type checks
      expect(typeof info.platform).toBe('string');
      expect(typeof info.arch).toBe('string');
      expect(typeof info.nodeVersion).toBe('string');
      expect(typeof info.uptime).toBe('number');
      expect(info.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof info.totalMemoryMB).toBe('number');
      expect(info.totalMemoryMB).toBeGreaterThan(0);
      expect(typeof info.cpuCores).toBe('number');
      expect(info.cpuCores).toBeGreaterThan(0);
    });

    it('should include details in result', async () => {
      registerUniversalTool(mockApi);
      const result = await capturedTool.execute('test', { action: 'system_info' }, undefined, undefined, { cwd: process.cwd() });

      expect(result.details).toBeDefined();
      const info = JSON.parse(result.content[0].text);
      expect(result.details.platform).toBe(info.platform);
      expect(result.details.cpuModel).toBe(info.cpuModel);
    });
  });

  describe('error handling', () => {
    it('should throw if action is missing', async () => {
      registerUniversalTool(mockApi);
      await expect(capturedTool.execute('test', {}, undefined, undefined, {})).rejects.toThrow('Missing required parameter: action');
    });

    it('should throw if action is unknown', async () => {
      registerUniversalTool(mockApi);
      await expect(capturedTool.execute('test', { action: 'unknown' }, undefined, undefined, {})).rejects.toThrow('Unknown action: unknown');
    });
  });
});
