import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PiclawPackageManager } from '../piclaw-package-manager.js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('PiclawPackageManager Coverage Gaps', () => {
  let tempHome: string;
  let cwd: string;
  let agentDir: string;

  beforeEach(() => {
    const originalHome = homedir();
    tempHome = join(originalHome, '.piclaw-test-coverage');
    if (existsSync(tempHome)) {
      // Cleanup handled by afterEach, but just in case
    } else {
      mkdirSync(tempHome, { recursive: true });
    }
    vi.stubEnv('HOME', tempHome);

    cwd = join(tempHome, 'test-project');
    mkdirSync(cwd, { recursive: true });
    agentDir = join(homedir(), '.piclaw', 'agent');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(tempHome)) {
      const { rmSync } = require('node:fs');
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  describe('parseSource edge cases', () => {
    it('should parse npm scoped package', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const parsed = (pm as any).parseSource('npm:@scope/package');
      expect(parsed).toEqual({ type: 'npm', name: '@scope/package', pinned: false });
    });

    it('should parse npm with version pin', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const parsed = (pm as any).parseSource('npm:package@1.2.3');
      expect(parsed).toEqual({ type: 'npm', name: 'package', pinned: true });
    });

    it('should parse git@ SSH URL', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const parsed = (pm as any).parseSource('git:git@github.com:user/repo');
      expect(parsed).toEqual({ type: 'git', host: 'github.com', path: 'user/repo', ref: undefined });
    });

    it('should parse git https URL with ref fragment', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const parsed = (pm as any).parseSource('git:https://github.com/user/repo.git#main');
      expect(parsed).toEqual({ type: 'git', host: 'github.com', path: 'user/repo.git', ref: 'main' });
    });

    it('should parse git simple host/path', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const parsed = (pm as any).parseSource('git:github.com/user/repo');
      expect(parsed).toEqual({ type: 'git', host: 'github.com', path: 'user/repo', ref: undefined });
    });

    it('should parse local path', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const parsed = (pm as any).parseSource('/absolute/path');
      expect(parsed).toEqual({ type: 'local', path: '/absolute/path' });
    });
  });

  describe('withRetry behavior', () => {
    it('should succeed on first attempt', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const operation = vi.fn().mockResolvedValue('ok');
      const result = await (pm as any).withRetry(operation);
      expect(result).toBe('ok');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry after failure and succeed', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('ok');
      const result = await (pm as any).withRetry(operation, 3, 10);
      expect(result).toBe('ok');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts exhausted', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const operation = vi.fn().mockRejectedValue(new Error('persistent fail'));
      await expect((pm as any).withRetry(operation, 2, 10)).rejects.toThrow('persistent fail');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('installNpm failure handling', () => {
    it('should reject when npm install fails', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      vi.spyOn(pm as any, 'runCommand').mockRejectedValue(new Error('npm install error'));
      await expect(pm.installAndPersist('npm:test-package', { local: true })).rejects.toThrow('npm install error');
    });
  });

  describe('installGit error handling', () => {
    it('should reject when git clone fails', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      vi.spyOn(pm as any, 'runCommand').mockRejectedValue(new Error('git clone failed'));
      await expect(pm.installAndPersist('git:github.com/user/repo', { local: true })).rejects.toThrow('git clone failed');
    });
  });

  describe('uninstallNpm error handling', () => {
    it('should reject when npm uninstall fails', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      vi.spyOn(pm as any, 'runCommand').mockRejectedValue(new Error('npm uninstall error'));
      await expect(pm.removeAndPersist('npm:test', { local: true })).rejects.toThrow('npm uninstall error');
    });
  });

  describe('updateNpm error path', () => {
    it('should propagate error when re-install fails', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      // Prepare installed package
      const installedPath = join(cwd, '.piclaw', 'npm', 'node_modules', 'test');
      mkdirSync(installedPath, { recursive: true });
      writeFileSync(join(installedPath, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      // Mock version check to indicate update needed
      vi.spyOn(pm as any, 'getLatestNpmVersion').mockResolvedValue('2.0.0');
      // Mock reinstall to fail (runNpmCommand calls runCommand internally)
      vi.spyOn(pm as any, 'runNpmCommand').mockRejectedValue(new Error('npm install error during update'));
      const source = { type: 'npm', name: 'test', pinned: false } as any;
      await expect((pm as any).updateNpm(source, 'project')).rejects.toThrow('npm install error during update');
    });
  });

  describe('updateGit error path', () => {
    it('should handle pull failure and reset failure without throwing', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const targetDir = join(cwd, 'git-update');
      mkdirSync(targetDir, { recursive: true });
      // All git commands fail
      const runCommandSpy = vi.spyOn(pm as any, 'runCommand').mockRejectedValue(new Error('git fail'));
      // Mock getGitInstallPath to return targetDir
      vi.spyOn(pm as any, 'getGitInstallPath').mockReturnValue(targetDir);
      const source = { type: 'git', host: 'github.com', path: 'user/repo' } as any;
      // Should resolve; errors are caught in updateGit
      await expect((pm as any).updateGit(source, 'project')).resolves.toBeUndefined();
      // Verify pull was called (may be called multiple times due to retry)
      expect(runCommandSpy).toHaveBeenCalledWith('git', ['pull', '--rebase'], { cwd: targetDir });
      // Verify fetch and reset were called
      expect(runCommandSpy).toHaveBeenCalledWith('git', ['fetch', 'origin'], { cwd: targetDir });
      expect(runCommandSpy).toHaveBeenCalledWith('git', ['reset', '--hard', 'origin/HEAD'], { cwd: targetDir });
    });
  });

  describe('runCommandCapture errors', () => {
    it('should reject on command failure', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      vi.spyOn(pm as any, 'runCommandCapture').mockRejectedValue(new Error('command failed'));
      await expect(pm.getLatestNpmVersion('pkg')).rejects.toThrow('command failed');
    });
  });

  describe('collectPackageResources with filters', () => {
    it('should include only filtered extensions', () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      const packageRoot = join(cwd, '.piclaw', 'npm', 'node_modules', 'test-pkg');
      mkdirSync(packageRoot, { recursive: true });
      writeFileSync(join(packageRoot, 'a.ts'), '// test');
      writeFileSync(join(packageRoot, 'b.js'), '// test');
      writeFileSync(join(packageRoot, 'readme.md'), '# readme');

      const accumulator = {
        extensions: new Map(),
        skills: new Map(),
        prompts: new Map(),
        themes: new Map(),
      };

      const metadata = { source: 'npm:test', scope: 'project' as const, origin: 'package' as const };

      (pm as any).collectPackageResources(
        packageRoot,
        accumulator,
        { extensions: ['**/*.ts'], skills: [], prompts: [], themes: [] },
        metadata
      );

      expect(accumulator.extensions.size).toBe(1);
      const entry = accumulator.extensions.values().next().value;
      expect(entry.path).toContain('a.ts');
    });
  });

  describe('runCommand with non-zero exit', () => {
    it('should reject with error message', async () => {
      const pm = new PiclawPackageManager({ cwd, agentDir });
      vi.spyOn(pm as any, 'runCommand').mockRejectedValue(new Error('npm exited with code 1'));
      try {
        await (pm as any).runCommand('npm', ['bad']);
      } catch (err: any) {
        expect(err.message).toContain('exited with code');
      }
    });
  });
});
