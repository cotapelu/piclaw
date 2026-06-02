import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PiclawPackageManager } from '../piclaw-package-manager.js';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('PiclawPackageManager Error Handling', () => {
  let tempHome: string;
  let cwd: string;
  let agentDir: string;

  beforeEach(() => {
    const originalHome = homedir();
    tempHome = join(originalHome, '.piclaw-test-errors');
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    mkdirSync(tempHome, { recursive: true });
    vi.stubEnv('HOME', tempHome);

    cwd = join(tempHome, 'test-project');
    mkdirSync(cwd, { recursive: true });
    agentDir = join(homedir(), '.piclaw', 'agent');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  describe('getLatestNpmVersion errors', () => {
    it('should reject when runCommandCapture throws', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      vi.spyOn(pm as any, 'runCommandCapture').mockRejectedValue(new Error('network fail'));
      await expect(pm.getLatestNpmVersion('pkg')).rejects.toThrow('network fail');
    });

    it('should reject on invalid JSON output', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      vi.spyOn(pm as any, 'runCommandCapture').mockResolvedValue({ code: 0, stdout: 'invalid-json', stderr: '' });
      await expect(pm.getLatestNpmVersion('pkg')).rejects.toThrow(); // SyntaxError expected
    });
  });

  describe('validateParsed', () => {
    it('should reject empty npm name', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      expect(() => (pm as any).validateParsed({ type: 'npm', name: '' })).toThrow('Invalid npm source: missing package name');
    });

    it('should reject git source without slash', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      expect(() => (pm as any).validateParsed({ type: 'git', host: 'github.com', path: 'repo' })).toThrow('Invalid git source: path must be in the form host/path (e.g., github.com/user/repo)');
    });
  });

  describe('settings operations', () => {
    it('removeSourceFromSettings should return false if source not found', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const result = (pm as any).removeSourceFromSettings('npm:unknown', false);
      expect(result).toBe(false);
    });

    it('addSourceToSettings should add entry', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      (pm as any).addSourceToSettings({ source: 'npm:test' }, { local: false });
      const pkgs = pm.listConfiguredPackages();
      expect(pkgs.some(p => p.source === 'npm:test')).toBe(true);
    });

    it('addSourceToSettings with filter should mark filtered', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      (pm as any).addSourceToSettings({ source: 'npm:test', filter: { extensions: ['**/*.ts'] } }, { local: false });
      const pkgs = pm.listConfiguredPackages();
      expect(pkgs.find(p => p.source === 'npm:test')?.filtered).toBe(true);
    });
  });

  describe('resolveExtensionSources with missing package', () => {
    it('should return empty arrays for non-existent source', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const result = await pm.resolveExtensionSources(['npm:nonexistent'], { includeDependencies: false });
      expect(result.extensions).toHaveLength(0);
      expect(result.skills).toHaveLength(0);
      expect(result.prompts).toHaveLength(0);
      expect(result.themes).toHaveLength(0);
    });
  });

  describe('getConfiguredEntries with malformed settings', () => {
    it('should skip entries that are not string or object', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      // Manually corrupt global settings
      const globalPath = (pm as any).getGlobalSettingsPath();
      const projectPath = (pm as any).getProjectSettingsPath();
      // Write invalid entry types (number, null)
      const invalidSettings = { packages: [123, null, 'npm:good'] as any };
      mkdirSync(join(globalPath, '..'), { recursive: true });
      writeFileSync(globalPath, JSON.stringify(invalidSettings));
      const entries = (pm as any).getConfiguredEntries();
      expect(entries.find(e => e.source === 'npm:good')).toBeDefined();
    });
  });
});
