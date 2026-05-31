import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PiclawPackageManager } from '../piclaw-package-manager.js';
import * as pkgCommands from '../package-commands.js';

describe('handleUpdateCommand progress callback', () => {
  let cwd: string;
  let agentDir: string;

  beforeEach(() => {
    const originalHome = homedir();
    const tempHome = join(originalHome, '.piclaw-test-update-progress');
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    mkdirSync(tempHome, { recursive: true });
    vi.stubEnv('HOME', tempHome);

    cwd = join(tempHome, 'test-project');
    mkdirSync(cwd, { recursive: true });
    agentDir = join(homedir(), '.piclaw', 'agent');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    const tempHome = join(homedir(), '.piclaw-test-update-progress');
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('should log progress events for update', async () => {
    let capturedCb: any;
    const setProgressSpy = vi.spyOn(PiclawPackageManager.prototype, 'setProgressCallback').mockImplementation((cb: any) => {
      capturedCb = cb;
    });
    const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockImplementation(async () => {
      if (capturedCb) {
        capturedCb({ type: 'start', action: 'update', source: 'npm:test' });
        capturedCb({ type: 'complete', action: 'update', source: 'npm:test' });
      }
    });
    try {
      await pkgCommands.handleUpdateCommand(['update', 'npm:test']);
    } catch (e) {}
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⏳ update: npm:test'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ update complete: npm:test'));
  });

  it('should log progress error event for update', async () => {
    let capturedCb: any;
    const setProgressSpy = vi.spyOn(PiclawPackageManager.prototype, 'setProgressCallback').mockImplementation((cb: any) => {
      capturedCb = cb;
    });
    const updateSpy = vi.spyOn(PiclawPackageManager.prototype, 'update').mockImplementation(async () => {
      if (capturedCb) {
        capturedCb({ type: 'error', action: 'update', source: 'npm:test', message: 'update failed' });
      }
    });
    try {
      await pkgCommands.handleUpdateCommand(['update', 'npm:test']);
    } catch (e) {}
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('❌ update failed: npm:test - update failed'));
  });
});
