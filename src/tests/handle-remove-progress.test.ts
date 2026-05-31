import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PiclawPackageManager } from '../piclaw-package-manager.js';
import * as pkgCommands from '../package-commands.js';

describe('handleRemoveCommand progress callback', () => {
  let cwd: string;
  let agentDir: string;

  beforeEach(() => {
    const originalHome = homedir();
    const tempHome = join(originalHome, '.piclaw-test-remove-progress');
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
    const tempHome = join(homedir(), '.piclaw-test-remove-progress');
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('should log progress events for remove', async () => {
    let capturedCb: any;
    const setProgressSpy = vi.spyOn(PiclawPackageManager.prototype, 'setProgressCallback').mockImplementation((cb: any) => {
      capturedCb = cb;
    });
    const removeSpy = vi.spyOn(PiclawPackageManager.prototype, 'removeAndPersist').mockImplementation(async () => {
      if (capturedCb) {
        capturedCb({ type: 'start', action: 'remove', source: 'npm:test' });
        capturedCb({ type: 'complete', action: 'remove', source: 'npm:test' });
      }
    });
    try {
      await pkgCommands.handleRemoveCommand(['remove', 'npm:test']);
    } catch (e) {}
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⏳ remove: npm:test'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ remove complete: npm:test'));
  });

  it('should log progress error event for remove', async () => {
    let capturedCb: any;
    const setProgressSpy = vi.spyOn(PiclawPackageManager.prototype, 'setProgressCallback').mockImplementation((cb: any) => {
      capturedCb = cb;
    });
    const removeSpy = vi.spyOn(PiclawPackageManager.prototype, 'removeAndPersist').mockImplementation(async () => {
      if (capturedCb) {
        capturedCb({ type: 'error', action: 'remove', source: 'npm:test', message: 'failed to remove' });
      }
    });
    try {
      await pkgCommands.handleRemoveCommand(['remove', 'npm:test']);
    } catch (e) {}
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('❌ remove failed: npm:test - failed to remove'));
  });
});
