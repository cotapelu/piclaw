/**
 * Unit tests for ConflictResolutionManager and CollaborativeWorkspace
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictResolutionManager } from '../../team/conflict-resolution';
import { CollaborativeWorkspace } from '../../team/conflict-resolution';

describe('ConflictResolutionManager', () => {
  let manager: ConflictResolutionManager;

  beforeEach(() => {
    manager = new ConflictResolutionManager();
  });

  describe('registerArtifact', () => {
    it('should register new artifact with initial value', () => {
      const artifact = manager.registerArtifact('config', { foo: 'bar' }, 'agent-1');

      expect(artifact.key).toBe('config');
      expect(artifact.value).toEqual({ foo: 'bar' });
      expect(artifact.lock).toBeNull();
      expect(artifact.versions.length).toBe(1);
      expect(artifact.versions[0].version).toBe(1);
      expect(artifact.versions[0].modifiedBy).toBe('agent-1');
    });

    it('should return existing artifact if already registered', () => {
      const artifact1 = manager.registerArtifact('config', { foo: 'bar' }, 'agent-1');
      const artifact2 = manager.registerArtifact('config', { baz: 'qux' }, 'agent-2');

      expect(artifact1).toBe(artifact2);
      expect(artifact2.value).toEqual({ foo: 'bar' }); // Original value preserved
    });
  });

  describe('tryLock', () => {
    beforeEach(() => {
      manager.registerArtifact('lockable', 'value', 'agent-1');
    });

    it('should acquire lock if available', () => {
      const result = manager.tryLock('lockable', 'agent-2');

      expect(result.locked).toBe(true);
      expect(result.lockToken).toBeDefined();
      expect(result.owner).toBe('agent-2');
    });

    it('should reject if already locked by another agent', () => {
      manager.tryLock('lockable', 'agent-2');
      const result = manager.tryLock('lockable', 'agent-3');

      expect(result.locked).toBe(false);
      expect(result.owner).toBe('agent-2');
    });

    it('should allow same agent to re-lock', () => {
      manager.tryLock('lockable', 'agent-2');
      const result = manager.tryLock('lockable', 'agent-2');

      expect(result.locked).toBe(true);
    });

    it('should auto-release expired locks', () => {
      // First lock with short TTL (1ms)
      manager = new ConflictResolutionManager({}, {}, 1);
      const result1 = manager.tryLock('lockable', 'agent-2');
      expect(result1.locked).toBe(true);

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result2 = manager.tryLock('lockable', 'agent-3');
          expect(result2.locked).toBe(true);
          expect(result2.owner).toBe('agent-3');
          resolve();
        }, 5);
      });
    });
  });

  describe('releaseLock', () => {
    it('should release lock held by agent', () => {
      manager.registerArtifact('key', 'value', 'agent-1');
      manager.tryLock('key', 'agent-2');
      expect(manager.read('key')?.locked).toBe(true);

      const released = manager.releaseLock('key', 'agent-2');
      expect(released).toBe(true);
      expect(manager.read('key')?.locked).toBe(false);
    });

    it('should fail if agent does not hold lock', () => {
      manager.registerArtifact('key', 'value', 'agent-1');
      manager.tryLock('key', 'agent-2');

      const released = manager.releaseLock('key', 'agent-3');
      expect(released).toBe(false);
    });

    it('should fail for non-existent artifact', () => {
      const released = manager.releaseLock('nonexistent', 'agent-1');
      expect(released).toBe(false);
    });
  });

  describe('read', () => {
    it('should return artifact value and version', () => {
      manager.registerArtifact('config', { setting: 'enabled' }, 'agent-1');

      const result = manager.read('config');
      expect(result).not.toBeNull();
      expect(result!.value).toEqual({ setting: 'enabled' });
      expect(result!.version).toBe(1);
      expect(result!.locked).toBe(false);
    });

    it('should return null for non-existent artifact', () => {
      const result = manager.read('nonexistent');
      expect(result).toBeNull();
    });

    it('should increment access count', () => {
      manager.registerArtifact('config', {}, 'agent-1');
      manager.read('config');
      manager.read('config');

      const info = manager.getArtifactInfo('config');
      expect(info?.accessCount).toBe(2);
    });
  });

  describe('write', () => {
    beforeEach(() => {
      manager.registerArtifact('config', { v: 1 }, 'agent-1');
    });

    it('should update value if no lock', () => {
      const result = manager.write('config', { v: 2 }, 'agent-2');

      expect(result.success).toBe(true);
      expect(result.version).toBe(2);

      const artifact = manager.read('config');
      expect(artifact!.value).toEqual({ v: 2 });
    });

    it('should reject write if locked by another agent', () => {
      manager.tryLock('config', 'agent-2');
      const result = manager.write('config', { v: 2 }, 'agent-3');

      expect(result.success).toBe(false);
      expect(result.message).toContain('locked');
    });

    it('should allow force write when locked', () => {
      manager.tryLock('config', 'agent-2');
      const result = manager.write('config', { v: 2 }, 'agent-3', { force: true });

      expect(result.success).toBe(true);
      const artifact = manager.read('config');
      expect(artifact!.value).toEqual({ v: 2 });
    });

    it('should create version entry on write', () => {
      manager.write('config', { v: 2 }, 'agent-2');
      manager.write('config', { v: 3 }, 'agent-3');
      manager.write('config', { v: 4 }, 'agent-2');

      const info = manager.getArtifactInfo('config');
      expect(info?.version).toBe(4);

      const versions = manager.getVersions('config');
      expect(versions?.map(v => v.version)).toEqual([1, 2, 3, 4]);
    });

    it('should trim versions exceeding max', () => {
      manager = new ConflictResolutionManager({}, {}, 2); // Max 2 versions
      manager.registerArtifact('config', { v: 1 }, 'agent-1');
      manager.write('config', { v: 2 }, 'agent-2');
      manager.write('config', { v: 3 }, 'agent-3');

      const versions = manager.getVersions('config');
      expect(versions?.length).toBe(2);
      expect(versions?.[0]?.version).toBe(2); // Keeps recent
      expect(versions?.[1]?.version).toBe(3);
    });

    it('should fail if artifact not found', () => {
      const result = manager.write('nonexistent', { foo: 'bar' }, 'agent-1');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Artifact not found');
    });
  });

  describe('resolution strategies', () => {
    beforeEach(() => {
      manager.registerArtifact('config', { v: 1 }, 'agent-1');
    });

    it('last-writer-wins (default)', () => {
      manager.setStrategy('config', 'last-writer-wins');
      manager.write('config', { v: 2 }, 'agent-2');
      manager.write('config', { v: 3 }, 'agent-3');

      const artifact = manager.read('config');
      expect(artifact!.value).toEqual({ v: 3 });
    });

    it('first-writer-wins', () => {
      manager.setStrategy('config', 'first-writer-wins');
      manager.tryLock('config', 'agent-2'); // Agent-2 holds lock

      const result = manager.write('config', { v: 2 }, 'agent-3');
      expect(result.success).toBe(false);
    });

    it('reject-concurrent', () => {
      manager.setStrategy('config', 'reject-concurrent');
      manager.tryLock('config', 'agent-2');

      const result = manager.write('config', { v: 2 }, 'agent-3');
      expect(result.success).toBe(false);
      expect(result.message).toContain('locked');
    });

    it('versioned - creates conflict but succeeds', () => {
      manager.setStrategy('config', 'versioned');
      manager.write('config', { v: 2 }, 'agent-2');

      const conflicts = manager.getConflicts();
      // No conflict record for versioned strategy (just keeps both versions)
      expect(conflicts.length).toBe(0);
    });
  });

  describe('getConflicts', () => {
    it('should return unresolved conflicts', () => {
      manager.setStrategy('config', 'manual');
      manager.registerArtifact('config', { v: 1 }, 'agent-1');
      manager.tryLock('config', 'agent-2');
      manager.write('config', { v: 2 }, 'agent-3'); // Creates conflict

      const conflicts = manager.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].artifactKey).toBe('config');
      expect(conflicts[0].conflictedBy).toContain('agent-3');
    });

    it('should filter resolved conflicts', () => {
      manager.setStrategy('config', 'manual');
      manager.registerArtifact('config', { v: 1 }, 'agent-1');
      manager.write('config', { v: 2 }, 'agent-2');

      const conflict = manager.getConflicts()[0];
      manager.resolveConflict('config', 'accept-latest', 'agent-3');

      const resolved = manager.getConflicts(true);
      expect(resolved.length).toBe(1);
      expect(resolved[0].resolvedAt).toBeDefined();
    });
  });

  describe('listArtifacts', () => {
    it('should list all registered artifact keys', () => {
      manager.registerArtifact('config', {}, 'agent-1');
      manager.registerArtifact('secrets', {}, 'agent-2');
      manager.registerArtifact('state', {}, 'agent-3');

      const keys = manager.listArtifacts();
      expect(keys.sort()).toEqual(['config', 'secrets', 'state']);
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should release expired locks', () => {
      manager = new ConflictResolutionManager({}, {}, 1); // 1ms TTL
      manager.registerArtifact('key', 'value', 'agent-1');
      manager.tryLock('key', 'agent-2');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          manager.cleanupExpiredLocks();
          expect(manager.read('key')?.locked).toBe(false);
          resolve();
        }, 5);
      });
    });
  });
});

describe('CollaborativeWorkspace', () => {
  let workspace: CollaborativeWorkspace;
  const manager = new ConflictResolutionManager();

  beforeEach(() => {
    workspace = new CollaborativeWorkspace(manager);
  });

  describe('read/write', () => {
    it('should read and write values', async () => {
      await workspace.set('config', { debug: true }, 'agent-1');
      const value = workspace.get('config');

      expect(value).toEqual({ debug: true });
    });

    it('should handle conflicts during write', async () => {
      // Agent 1 reads
      const read1 = workspace.readWithLock('counter', 'agent-1');
      expect(read1.locked).toBe(true);

      // Agent 2 tries to write (should conflict)
      const write2 = await workspace.write('counter', 2, 'agent-2');
      expect(write2.success).toBe(false);

      // Agent 1 writes and releases lock
      await workspace.write('counter', 1, 'agent-1');
      await workspace.releaseLock('counter', 'agent-1');
    });

    it('should list keys', async () => {
      await workspace.set('key1', 'value1', 'agent-1');
      await workspace.set('key2', 'value2', 'agent-2');

      const keys = workspace.list();
      expect(keys.sort()).toEqual(['key1', 'key2']);
    });

    it('should list keys by prefix', async () => {
      await workspace.set('config.db.host', 'localhost', 'agent-1');
      await workspace.set('config.db.port', 5432, 'agent-1');
      await workspace.set('cache.ttl', 60, 'agent-2');

      const dbKeys = workspace.listByPrefix('config.db.');
      expect(dbKeys.sort()).toEqual(['config.db.host', 'config.db.port']);
    });
  });

  describe('locking', () => {
    it('should acquire and release lock', async () => {
      const lock1 = workspace.tryLock('resource', 'agent-1');
      expect(lock1.locked).toBe(true);

      const lock2 = workspace.tryLock('resource', 'agent-2');
      expect(lock2.locked).toBe(false);

      workspace.releaseLock('resource', 'agent-1');
      const lock3 = workspace.tryLock('resource', 'agent-2');
      expect(lock3.locked).toBe(true);
    });

    it('should readWithLock acquire lock atomically', async () => {
      const read = workspace.readWithLock('resource', 'agent-1');
      expect(read.locked).toBe(true);
      expect(read.lockToken).toBeDefined();

      workspace.releaseLock('resource', 'agent-1');
    });
  });

  describe('getArtifactInfo', () => {
    it('should return artifact metadata', async () => {
      await workspace.set('config', { x: 1 }, 'agent-1');

      const info = workspace.getArtifactInfo('config');
      expect(info.exists).toBe(true);
      expect(info.version).toBe(1);
      expect(info.lockedBy).toBeUndefined();
    });

    it('should report non-existent as not exists', () => {
      const info = workspace.getArtifactInfo('nonexistent');
      expect(info.exists).toBe(false);
      expect(info.version).toBe(0);
    });
  });

  describe('toObject', () => {
    it('should export all key-value pairs', async () => {
      await workspace.set('a', 1, 'agent-1');
      await workspace.set('b', 2, 'agent-2');
      await workspace.set('c', 3, 'agent-3');

      const obj = workspace.toObject();
      expect(obj).toEqual({ a: 1, b: 2, c: 3 });
    });
  });

  describe('getConflicts', () => {
    it('should retrieve conflict information', async () => {
      manager.setStrategy('test', 'manual');
      await workspace.set('key', 'value1', 'agent-1');
      await workspace.write('key', 'value2', 'agent-2'); // Creates conflict

      const conflicts = workspace.getConflicts();
      expect(conflicts.length).toBe(1);
    });
  });
});
