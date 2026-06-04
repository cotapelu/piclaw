import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process before importing the manager
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

import { spawn as mockSpawn, spawnSync as mockSpawnSync } from 'child_process';
import { PiclawPackageManager } from '../piclaw-package-manager.js';
import { mkdirSync, existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from "node:path";
import os from 'os';

describe('PiclawPackageManager Edge Cases', () => {
  let pm: PiclawPackageManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join('/tmp', 'piclaw-test-' + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    pm = new PiclawPackageManager({ cwd: tmpDir, agentDir: tmpDir });
    pm.setProgressCallback((event) => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('validateParsed', () => {
    it('should throw for npm source with empty name', () => {
      const parsed = { type: 'npm', name: '', pinned: false } as any;
      expect(() => pm.validateParsed(parsed)).toThrow('Invalid npm source: missing package name');
    });

    it('should throw for git source with path lacking slash', () => {
      // Simulate parsing git:github.com/repo but if path were just 'repo' (missing user)
      const parsed = { type: 'git', host: 'github.com', path: 'repo', ref: undefined } as any;
      expect(() => pm.validateParsed(parsed)).toThrow('path must be in the form host/path');
    });

    it('should throw for git source with missing host', () => {
      const parsed = { type: 'git', host: '', path: 'something', ref: undefined } as any;
      expect(() => pm.validateParsed(parsed)).toThrow('missing host or path');
    });
  });

  describe('installNpm', () => {
    it('should reject when runNpmCommand fails', async () => {
      const pmAny = pm as any;
      const spy = vi.spyOn(pmAny, 'runNpmCommand').mockRejectedValue(new Error('npm error'));
      await expect(pmAny.installNpm({ type: 'npm', name: 'test', pinned: false }, 'project')).rejects.toThrow('npm error');
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('getLatestNpmVersion', () => {
    it('should reject when runCommandCapture fails', async () => {
      const pmAny = pm as any;
      vi.spyOn(pmAny, 'runCommandCapture').mockRejectedValue(new Error('cmd failed'));
      await expect(pmAny.getLatestNpmVersion('test')).rejects.toThrow('cmd failed');
    });

    it('should return version string from npm view output', async () => {
      const pmAny = pm as any;
      // npm view returns version as JSON string literal, e.g., "1.2.3"
      vi.spyOn(pmAny, 'runCommandCapture').mockResolvedValue('"1.2.3"');
      const version = await pmAny.getLatestNpmVersion('test');
      expect(version).toBe('1.2.3');
    });
  });

  describe('runCommandCapture', () => {
    it('should reject when spawn throws', async () => {
      const pmAny = pm as any;
      mockSpawn.mockImplementation(() => { throw new Error('spawn error'); });
      await expect(pmAny.runCommandCapture('test', ['cmd'], {})).rejects.toThrow('spawn error');
    });

    it('should reject when child exits with non-zero code', async () => {
      const pmAny = pm as any;
      mockSpawn.mockReturnValue({
        on: vi.fn((event, cb) => { if (event === 'close') cb(1); }),
        stdout: { on: vi.fn() },
      } as any);
      await expect(pmAny.runCommandCapture('test', ['cmd'], {})).rejects.toThrow('exited with code 1');
    });

    it('should return stdout string on success', async () => {
      const pmAny = pm as any;
      mockSpawn.mockReturnValue({
        stdout: { on: vi.fn((event, cb) => cb('output')) },
        on: vi.fn((event, cb) => { if (event === 'close') cb(0); }),
      } as any);
      const result = await pmAny.runCommandCapture('test', ['cmd'], {});
      expect(result).toBe('output');
    });
  });

  describe('other methods', () => {
    it('should compute npm install path for project', () => {
      const pmAny = pm as any;
      const source = { type: 'npm', name: 'testpkg', pinned: false };
      const path = pmAny.getNpmInstallPath(source, 'project');
      expect(path).toContain('.piclaw');
      expect(path).toContain('npm');
      expect(path).toContain('testpkg');
    });

    it('should compute git install path correctly', () => {
      const pmAny = pm as any;
      const source = { type: 'git', host: 'example.com', path: 'user/repo', ref: undefined };
      const path = pmAny.getGitInstallPath(source, 'project');
      expect(path).toContain('.piclaw');
      expect(path).toContain('git');
      expect(path).toContain('example.com');
      expect(path).toContain('user');
      expect(path).toContain('repo');
    });

    it('should ensure npm project directory and package.json', () => {
      const pmAny = pm as any;
      const root = join(tmpDir, '.piclaw', 'npm');
      pmAny.ensureNpmProject(root);
      expect(existsSync(join(root, 'package.json'))).toBe(true);
    });

    it('should get global npm root via spawnSync', () => {
      const pmAny = pm as any;
      mockSpawnSync.mockReturnValue({ status: 0, stdout: '/global/path', stderr: '' } as any);
      const root = pmAny.getGlobalNpmRoot();
      expect(root).toBe('/global/path');
    });
  });
  // Additional coverage tests

  it('should parse npm sources correctly', () => {
    const pmAny = pm as any;
    let parsed = pmAny.parseSource('npm:lodash');
    expect(parsed).toEqual({ type: 'npm', name: 'lodash', pinned: false });
    parsed = pmAny.parseSource('npm:@babel/core@7.0.0');
    expect(parsed).toEqual({ type: 'npm', name: '@babel/core', pinned: true });
    parsed = pmAny.parseSource('npm:my-pkg@latest');
    expect(parsed).toEqual({ type: 'npm', name: 'my-pkg', pinned: true });
  });

  it('should parse git sources correctly', () => {
    const pmAny = pm as any;
    let parsed = pmAny.parseSource('git:github.com/user/repo');
    expect(parsed).toEqual({ type: 'git', host: 'github.com', path: 'user/repo', ref: undefined });
    parsed = pmAny.parseSource('git:https://github.com/user/repo');
    expect(parsed).toEqual({ type: 'git', host: 'github.com', path: 'user/repo', ref: undefined });
    parsed = pmAny.parseSource('git:git@github.com:user/repo');
    expect(parsed).toEqual({ type: 'git', host: 'github.com', path: 'user/repo', ref: undefined });
    // with ref
    parsed = pmAny.parseSource('git:https://github.com/user/repo.git#v1.0');
    expect(parsed).toEqual({ type: 'git', host: 'github.com', path: 'user/repo.git', ref: 'v1.0' });
  });

  it('should parse local sources', () => {
    const pmAny = pm as any;
    const parsed = pmAny.parseSource('local:./some/path');
    expect(parsed).toEqual({ type: 'local', path: 'local:./some/path' });
  });

  it('should get project npm root', () => {
    const pmAny = pm as any;
    const root = pmAny.getProjectNpmRoot();
    expect(root).toBe(join(tmpDir, '.piclaw', 'npm'));
  });

  it('should get global npm root fallback when npm root -g fails', () => {
    const pmAny = pm as any;
    mockSpawnSync.mockReturnValue({ status: 1, stdout: '', stderr: '' } as any);
    const root = pmAny.getGlobalNpmRoot();
    const expected = join(os.homedir(), '.npm', 'global', 'node_modules');
    expect(root).toBe(expected);
  });

  it('should install npm package globally', async () => {
    const pmAny = pm as any;
    const runSpy = vi.spyOn(pmAny, 'runNpmCommand').mockResolvedValue(undefined);
    await pmAny.installNpm({ type: 'npm', name: 'testpkg', pinned: false }, 'user');
    expect(runSpy).toHaveBeenCalledWith(['install', '-g', 'testpkg']);
  });

  it('should install npm package to project', async () => {
    const pmAny = pm as any;
    const runSpy = vi.spyOn(pmAny, 'runNpmCommand').mockResolvedValue(undefined);
    const ensureSpy = vi.spyOn(pmAny, 'ensureNpmProject');
    await pmAny.installNpm({ type: 'npm', name: 'testpkg', pinned: false }, 'project');
    // ensureNpmProject should be called with the project root
    expect(ensureSpy).toHaveBeenCalledWith(join(tmpDir, '.piclaw', 'npm'));
    expect(runSpy).toHaveBeenCalledWith(['install', 'testpkg', '--prefix', expect.any(String), '--no-audit', '--no-fund']);
  });

  it('should uninstall npm package globally', async () => {
    const pmAny = pm as any;
    const runSpy = vi.spyOn(pmAny, 'runNpmCommand').mockResolvedValue(undefined);
    await pmAny.uninstallNpm({ type: 'npm', name: 'testpkg', pinned: false }, 'user');
    expect(runSpy).toHaveBeenCalledWith(['uninstall', '-g', 'testpkg']);
  });

  it('should uninstall npm package from project', async () => {
    const pmAny = pm as any;
    const runSpy = vi.spyOn(pmAny, 'runNpmCommand').mockResolvedValue(undefined);
    await pmAny.uninstallNpm({ type: 'npm', name: 'testpkg', pinned: false }, 'project');
    expect(runSpy).toHaveBeenCalledWith(['uninstall', 'testpkg', '--prefix', join(tmpDir, '.piclaw', 'npm')]);
  });

  // Route git install to installGit
  it('should route git install to installGit', async () => {
    const pmAny = pm as any;
    const installGitSpy = vi.spyOn(pmAny, 'installGit').mockResolvedValue(undefined);
    await pm.install('git:https://github.com/user/repo.git');
    expect(installGitSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'git', host: 'github.com', path: 'user/repo.git' }), 'user');
  });

  // Route git uninstall to uninstallGit
  it('should route git uninstall to uninstallGit', async () => {
    const pmAny = pm as any;
    const uninstallGitSpy = vi.spyOn(pmAny, 'uninstallGit').mockResolvedValue(undefined);
    await pm.remove('git:https://github.com/user/repo.git');
    expect(uninstallGitSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'git', host: 'github.com', path: 'user/repo.git' }), 'user');
  });

  describe('PiclawPackageManager Additional Coverage', () => {
    let pm: PiclawPackageManager;
    let tmpDir: string;
    let cwd: string;
    let agentDir: string;

    beforeEach(() => {
      tmpDir = join('/tmp', 'piclaw-add-' + Date.now());
      cwd = join(tmpDir, 'cwd');
      agentDir = join(tmpDir, 'agent');
      mkdirSync(cwd, { recursive: true });
      mkdirSync(agentDir, { recursive: true });
      pm = new PiclawPackageManager({ cwd, agentDir });
      pm.setProgressCallback((event) => {});
      vi.clearAllMocks();
    });

    afterEach(() => {
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return false when adding duplicate source', () => {
      const added1 = pm.addSourceToSettings('npm:lodash', { local: false });
      expect(added1).toBe(true);
      const added2 = pm.addSourceToSettings('npm:lodash', { local: false });
      expect(added2).toBe(false);
    });

    it('should return false when removing non-existent source', () => {
      const removed = pm.removeSourceFromSettings('npm:nonexistent', { local: false });
      expect(removed).toBe(false);
    });

    it('should load settings with invalid JSON and return empty packages', () => {
      const anyPm = pm as any;
      const settingsPath = join(cwd, '.piclaw', 'settings.json'); // using project settings
      mkdirSync(dirname(settingsPath), { recursive: true });
      writeFileSync(settingsPath, '{ invalid json }', 'utf-8');
      const settings = anyPm.loadSettings(settingsPath);
      expect(settings.packages).toEqual([]);
    });

    it('should call installNpm when installing npm source', async () => {
      const anyPm = pm as any;
      const installNpmSpy = vi.spyOn(anyPm, 'installNpm').mockResolvedValue(undefined);
      await pm.install('npm:test-pkg', { local: false });
      expect(installNpmSpy).toHaveBeenCalledWith({ type: 'npm', name: 'test-pkg', pinned: false }, 'user');
    });

    it('should call installGit when installing git source', async () => {
      const anyPm = pm as any;
      const installGitSpy = vi.spyOn(anyPm, 'installGit').mockResolvedValue(undefined);
      await pm.install('git:github.com/user/repo');
      expect(installGitSpy).toHaveBeenCalledWith({ type: 'git', host: 'github.com', path: 'user/repo', ref: undefined }, 'user');
    });

    it('should throw when local install path does not exist', async () => {
      await expect(pm.install('nonexistent-local-path')).rejects.toThrow('Path does not exist');
    });

    it('should not call installNpm when dryRun', async () => {
      const anyPm = pm as any;
      const installNpmSpy = vi.spyOn(anyPm, 'installNpm');
      await pm.install('npm:test', { local: false, dryRun: true });
      expect(installNpmSpy).not.toHaveBeenCalled();
    });

    it('should call uninstallNpm when removing npm source', async () => {
      const anyPm = pm as any;
      const uninstallSpy = vi.spyOn(anyPm, 'uninstallNpm').mockResolvedValue(undefined);
      await pm.remove('npm:test-pkg', { local: false });
      expect(uninstallSpy).toHaveBeenCalledWith({ type: 'npm', name: 'test-pkg', pinned: false }, 'user');
    });

    it('should call uninstallGit when removing git source', async () => {
      const anyPm = pm as any;
      const uninstallSpy = vi.spyOn(anyPm, 'uninstallGit').mockResolvedValue(undefined);
      await pm.remove('git:github.com/user/repo');
      expect(uninstallSpy).toHaveBeenCalledWith({ type: 'git', host: 'github.com', path: 'user/repo', ref: undefined }, 'user');
    });

    it('installAndPersist should install and add to settings', async () => {
      const anyPm = pm as any;
      const installSpy = vi.spyOn(pm, 'install').mockResolvedValue(undefined);
      const addSpy = vi.spyOn(pm, 'addSourceToSettings').mockReturnValue(true);
      await pm.installAndPersist('npm:test', { local: false });
      expect(installSpy).toHaveBeenCalledWith('npm:test', { local: false, dryRun: undefined, filter: undefined });
      expect(addSpy).toHaveBeenCalledWith({ source: 'npm:test', filter: undefined }, { local: false });
    });

    it('removeAndPersist should remove and delete from settings', async () => {
      const anyPm = pm as any;
      const removeSpy = vi.spyOn(pm, 'remove').mockResolvedValue(undefined);
      const removeSettingsSpy = vi.spyOn(pm, 'removeSourceFromSettings').mockReturnValue(true);
      await pm.removeAndPersist('npm:test', { local: false });
      expect(removeSpy).toHaveBeenCalledWith('npm:test', { local: false, dryRun: undefined });
      expect(removeSettingsSpy).toHaveBeenCalledWith('npm:test', { local: false });
    });

    it('getConfiguredEntries should include entries from both global and project settings', () => {
      // Add to global (agentDir)
      pm.addSourceToSettings('npm:global-pkg', { local: false });
      // Add to project (cwd)
      pm.addSourceToSettings({ source: 'git:gh/u/repo', filter: {} }, { local: true });
      const entries = pm.getConfiguredEntries();
      expect(entries.some(e => e.source === 'npm:global-pkg' && e.scope === 'user')).toBe(true);
      expect(entries.some(e => e.source === 'git:gh/u/repo' && e.scope === 'project')).toBe(true);
    });

    it('should handle local install when path exists', async () => {
      const anyPm = pm as any;
      const localFile = join(cwd, 'file.txt');
      writeFileSync(localFile, 'content');
      const installNpmSpy = vi.spyOn(anyPm, 'installNpm');
      const installGitSpy = vi.spyOn(anyPm, 'installGit');
      await pm.install(localFile);
      expect(installNpmSpy).not.toHaveBeenCalled();
      expect(installGitSpy).not.toHaveBeenCalled();
    });

    it('should update npm package', async () => {
      const anyPm = pm as any;
      pm.addSourceToSettings('npm:testpkg', { local: false });
      const updateNpmSpy = vi.spyOn(anyPm, 'updateNpm').mockResolvedValue(undefined);
      await pm.update('npm:testpkg');
      expect(updateNpmSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'npm', name: 'testpkg', pinned: false }), 'user');
    });

    it('should update git package', async () => {
      const anyPm = pm as any;
      pm.addSourceToSettings('git:github.com/user/repo', { local: false });
      const updateGitSpy = vi.spyOn(anyPm, 'updateGit').mockResolvedValue(undefined);
      await pm.update('git:github.com/user/repo');
      expect(updateGitSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'git', host: 'github.com', path: 'user/repo', ref: undefined }), 'user');
    });

    it('should not call updateNpm when dryRun', async () => {
      const anyPm = pm as any;
      pm.addSourceToSettings('npm:testpkg', { local: false });
      const updateNpmSpy = vi.spyOn(anyPm, 'updateNpm');
      await pm.update('npm:testpkg', { dryRun: true });
      expect(updateNpmSpy).not.toHaveBeenCalled();
    });
  });

});
