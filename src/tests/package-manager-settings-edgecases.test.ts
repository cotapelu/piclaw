import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PiclawPackageManager } from '../piclaw-package-manager.js';
import { mkdirSync, existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PiclawPackageManager Settings Edge Cases', () => {
  let pm: PiclawPackageManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join('/tmp', 'piclaw-settings-test-' + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    pm = new PiclawPackageManager({ cwd: tmpDir, agentDir: tmpDir });
    pm.setProgressCallback((event) => {});
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('addSourceToSettings initializes packages array if missing', () => {
    // Prepare global settings file with empty object (no packages property)
    const settingsPath = join(tmpDir, 'settings.json');
    writeFileSync(settingsPath, '{}');

    const added = pm.addSourceToSettings('npm:test-pkg'); // default uses global settings
    expect(added).toBe(true);

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(Array.isArray(settings.packages)).toBe(true);
    expect(settings.packages).toContain('npm:test-pkg');
  });

  it('removeSourceFromSettings returns false if packages missing', () => {
    const settingsPath = join(tmpDir, 'settings.json');
    writeFileSync(settingsPath, '{}');

    const removed = pm.removeSourceFromSettings('npm:any'); // defaults to global
    expect(removed).toBe(false);
  });
});
