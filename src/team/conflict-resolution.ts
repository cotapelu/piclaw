/**
 * Conflict Resolution - Handle concurrent access to shared artifacts
 *
 * When multiple agents try to read/write the same resource (files, workspace keys),
 * this system provides:
 * - Locking (prevent concurrent writes)
 * - Versioning (track changes)
 * - Merge strategies (auto-merge when possible)
 * - Conflict detection and resolution
 */

export type LockOwner = {
  agentId: string;
  lockedAt: number;
  ttl?: number; // Time-to-live in ms (for auto-release)
};

export type ArtifactVersion = {
  version: number;
  value: any;
  modifiedBy: string;
  modifiedAt: number;
  description?: string; // What changed
  checksum?: string; // For change detection
};

export interface SharedArtifact {
  /** Artifact key/path */
  key: string;
  /** Current value */
  value: any;
  /** Version history (circular buffer, keep last N) */
  versions: ArtifactVersion[];
  /** Current lock (if any) */
  lock: LockOwner | null;
  /** Metadata */
  metadata: {
    createdBy: string;
    createdAt: number;
    modifiedBy: string;
    modifiedAt: number;
    accessCount: number;
    conflictCount: number;
  };
}

export type ConflictResolutionStrategy =
  | "last-writer-wins"     // Latest write overwrites
  | "first-writer-wins"    // First write wins, others rejected
  | "merge"                // Attempt auto-merge (requires merge function)
  | "manual"               // Flag conflict, require human intervention
  | "versioned"            // Keep all versions, no overwrite
  | "reject-concurrent";   // Reject if already locked

export interface Conflict {
  artifactKey: string;
  conflictedBy: string[];
  timestamps: number[];
  resolvingAgent?: string;
  resolution?: "accept-latest" | "accept-earliest" | "merge" | "custom";
  resolvedAt?: number;
}

/**
 * ConflictResolutionManager - Central coordinator for artifact conflicts
 */
export class ConflictResolutionManager {
  private artifacts: Map<string, SharedArtifact> = new Map();
  private conflicts: Conflict[] = [];
  private readonly DEFAULT_MAX_VERSIONS = 10;
  private lockTtl: number;

  constructor(
    private strategy: Record<string, ConflictResolutionStrategy> = {},
    private mergeFunctions: Record<string, (v1: any, v2: any) => any> = {},
    lockTtl?: number
  ) {
    this.lockTtl = lockTtl ?? 5 * 60 * 1000; // 5 minutes default
  }

  setStrategy(key: string, strategy: ConflictResolutionStrategy): void {
    this.strategy[key] = strategy;
  }

  /**
   * Register an artifact (if not exists)
   */
  registerArtifact(key: string, initialValue: any, createdBy: string): SharedArtifact {
    if (this.artifacts.has(key)) {
      return this.artifacts.get(key)!;
    }

    const artifact: SharedArtifact = {
      key,
      value: initialValue,
      versions: [{
        version: 1,
        value: initialValue,
        modifiedBy: createdBy,
        modifiedAt: Date.now(),
        checksum: this.computeChecksum(initialValue),
      }],
      lock: null,
      metadata: {
        createdBy,
        createdAt: Date.now(),
        modifiedBy: createdBy,
        modifiedAt: Date.now(),
        accessCount: 0,
        conflictCount: 0,
      },
    };

    this.artifacts.set(key, artifact);
    return artifact;
  }

  /**
   * Try to acquire lock on artifact
   * Returns: lock token if successful, null if locked by someone else
   */
  tryLock(key: string, agentId: string, ttl?: number): { locked: boolean; lockToken?: string; owner?: string } {
    const artifact = this.artifacts.get(key);
    if (!artifact) {
      return { locked: false, owner: "unknown" };
    }

    // Check existing lock
    if (artifact.lock) {
      // Check if lock expired
      if (artifact.lock.ttl && Date.now() - artifact.lock.lockedAt > artifact.lock.ttl) {
        // Lock expired, release it
        artifact.lock = null;
      } else {
        return { locked: false, owner: artifact.lock.agentId };
      }
    }

    // Acquire lock
    const lockToken = `lock-${agentId}-${Date.now()}`;
    artifact.lock = {
      agentId,
      lockedAt: Date.now(),
      ttl: ttl ?? this.lockTtl,
    };

    artifact.metadata.accessCount++;

    return { locked: true, lockToken, owner: agentId };
  }

  /**
   * Release lock on artifact
   */
  releaseLock(key: string, agentId: string, token?: string): boolean {
    const artifact = this.artifacts.get(key);
    if (!artifact || !artifact.lock || artifact.lock.agentId !== agentId) {
      return false;
    }

    artifact.lock = null;
    return true;
  }

  /**
   * Read artifact (no lock)
   */
  read(key: string): { value: any; version: number; locked: boolean; lockedBy?: string } | null {
    const artifact = this.artifacts.get(key);
    if (!artifact) {
      return null;
    }

    artifact.metadata.accessCount++;

    const version = this.getCurrentVersion(artifact);
    return {
      value: artifact.value,
      version,
      locked: artifact.lock !== null,
      lockedBy: artifact.lock?.agentId
    };
  }

  /**
   * Write to artifact (with conflict detection)
   */
  write(
    key: string,
    newValue: any,
    agentId: string,
    options: {
      description?: string;
      force?: boolean; // Force write even if locked (overrides)
    } = {}
  ): { success: boolean; conflict?: Conflict; version: number; message?: string } {
    const artifact = this.artifacts.get(key);
    if (!artifact) {
      return { success: false, message: "Artifact not found", version: 0 };
    }

    // Check lock
    if (artifact.lock && artifact.lock.agentId !== agentId) {
      if (!options.force) {
        return {
          success: false,
          message: `Artifact locked by ${artifact.lock.agentId}`,
          conflict: this.createConflictRecord(key, [agentId, artifact.lock.agentId]),
          version: this.getCurrentVersion(artifact)
        };
      }
    }

    // Detect conflict: Has value changed since last read?
    const currentChecksum = this.computeChecksum(artifact.value);
    const incomingChecksum = this.computeChecksum(newValue);

    // If same value, no conflict
    if (currentChecksum === incomingChecksum) {
      return { success: true, version: this.getCurrentVersion(artifact) };
    }

    // Apply resolution strategy
    const strategy = this.strategy[key] || "last-writer-wins";
    const resolved = this.resolveWrite(key, currentChecksum, incomingChecksum, agentId, strategy);

    if (!resolved.success) {
      artifact.metadata.conflictCount++;
      return {
        success: false,
        conflict: resolved.conflict,
        version: this.getCurrentVersion(artifact),
        message: resolved.message
      };
    }

    // Apply the value
    const newVersion = this.getCurrentVersion(artifact) + 1;
    const versionEntry: ArtifactVersion = {
      version: newVersion,
      value: newValue,
      modifiedBy: agentId,
      modifiedAt: Date.now(),
      description: options.description,
      checksum: this.computeChecksum(newValue),
    };

    artifact.versions.push(versionEntry);
    // Trim versions if too many
    if (artifact.versions.length > this.DEFAULT_MAX_VERSIONS) {
      artifact.versions = artifact.versions.slice(-this.DEFAULT_MAX_VERSIONS);
    }

    artifact.value = versionEntry.value;
    artifact.metadata.modifiedBy = agentId;
    artifact.metadata.modifiedAt = Date.now();

    // Release lock if held by this agent
    if (artifact.lock?.agentId === agentId) {
      artifact.lock = null;
    }

    return { success: true, version: newVersion };
  }

  /**
   * Resolve write conflict based on strategy
   */
  private resolveWrite(
    key: string,
    currentChecksum: string,
    incomingChecksum: string,
    agentId: string,
    strategy: ConflictResolutionStrategy
  ): { success: boolean; value?: any; conflict?: Conflict; message?: string; version: number } {
    const artifact = this.artifacts.get(key);
    const getVer = () => this.getCurrentVersion(artifact!);

    const conflict: Conflict = {
      artifactKey: key,
      conflictedBy: [agentId],
      timestamps: [Date.now()],
    };

    switch (strategy) {
      case "last-writer-wins":
        return { success: true, value: undefined, version: getVer() };

      case "first-writer-wins":
        if (artifact?.lock?.agentId === agentId) {
          return { success: true, value: undefined, version: getVer() };
        }
        return { success: false, conflict, message: "Another agent holds lock", version: getVer() };

      case "reject-concurrent":
        if (artifact?.lock) {
          return { success: false, conflict, message: "Artifact is locked", version: getVer() };
        }
        return { success: true, value: undefined, version: getVer() };

      case "merge":
        const mergeFn = this.mergeFunctions[key];
        if (mergeFn) {
          try {
            const merged = mergeFn(artifact?.value, this.extractValueFromChecksum(incomingChecksum));
            return { success: true, value: merged, version: getVer() };
          } catch (err) {
            return { success: false, conflict, message: `Merge failed: ${err}`, version: getVer() };
          }
        }
        return { success: true, value: undefined, version: getVer() };

      case "manual":
        this.conflicts.push(conflict);
        return { success: false, conflict, message: "Manual resolution required", version: getVer() };

      case "versioned":
        return { success: true, value: undefined, version: getVer() };

      default:
        return { success: false, conflict, message: `Unknown strategy: ${strategy}`, version: getVer() };
    }
  }

  private computeChecksum(value: any): string {
    // Simple checksum (in production, use proper hash)
    if (value === null || value === undefined) return "null";
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  private extractValueFromChecksum(checksum: string): any {
    try {
      return JSON.parse(checksum);
    } catch {
      return checksum;
    }
  }

  private getCurrentVersion(artifact: SharedArtifact): number {
    return artifact.versions.length > 0 ? artifact.versions[artifact.versions.length - 1].version : 0;
  }

  private createConflictRecord(key: string, agents: string[]): Conflict {
    return {
      artifactKey: key,
      conflictedBy: agents,
      timestamps: [Date.now()],
    };
  }

  /**
   * Get conflict history
   */
  getConflicts(resolved: boolean = false): Conflict[] {
    if (resolved) {
      return this.conflicts.filter(c => c.resolvedAt !== undefined);
    }
    return this.conflicts.filter(c => c.resolvedAt === undefined);
  }

  /**
   * Resolve conflict manually
   */
  resolveConflict(artifactKey: string, resolution: "accept-latest" | "accept-earliest" | "merge", resolvingAgent: string): boolean {
    const conflict = this.conflicts.find(c => c.artifactKey === artifactKey && c.resolvedAt === undefined);
    if (!conflict) return false;

    conflict.resolvingAgent = resolvingAgent;
    conflict.resolution = resolution;
    conflict.resolvedAt = Date.now();

    return true;
  }

  /**
   * Get artifact info
   */
  getArtifactInfo(key: string): { exists: boolean; lockedBy?: string; version: number; accessCount?: number } | null {
    const artifact = this.artifacts.get(key);
    if (!artifact) return { exists: false, version: 0 };

    return {
      exists: true,
      lockedBy: artifact.lock?.agentId,
      version: this.getCurrentVersion(artifact),
      accessCount: artifact.metadata.accessCount,
    };
  }

  /**
   * Get versions of an artifact
   */
  getVersions(key: string): ArtifactVersion[] | null {
    const artifact = this.artifacts.get(key);
    return artifact ? artifact.versions : null;
  }

  /**
   * List all artifacts
   */
  listArtifacts(): string[] {
    return Array.from(this.artifacts.keys());
  }

  /**
   * Cleanup expired locks (periodic maintenance)
   */
  cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const artifact of this.artifacts.values()) {
      if (artifact.lock?.ttl && now - artifact.lock.lockedAt > artifact.lock.ttl) {
        artifact.lock = null;
      }
    }
  }
}

/**
 * Convenience wrappers for common operations (async interface)
 * Implements a superset of SharedWorkspace for team agents
 */
export class CollaborativeWorkspace {
  constructor(
    private conflictManager: ConflictResolutionManager,
    private defaultStrategy: ConflictResolutionStrategy = "last-writer-wins"
  ) {}

  /**
   * Read artifact (no lock)
   */
  read(key: string): { value: any; version: number; locked: boolean; lockedBy?: string } | null {
    const result = this.conflictManager.read(key);
    return result;
  }

  /**
   * Get value only (simple accessor)
   */
  get(key: string): any {
    const result = this.conflictManager.read(key);
    return result?.value ?? null;
  }

  /**
   * Get full artifact info (metadata, version)
   */
  getEntry(key: string): { value: any; version: number; lockedBy?: string; owner?: string } | undefined {
    const info = this.conflictManager.getArtifactInfo(key);
    if (!info || !info.exists) return undefined;

    const artifact = this.conflictManager.constructor.prototype.artifacts?.get?.(key);
    // Not easily accessible; reconstruct from read
    const readResult = this.read(key);
    if (!readResult) return undefined;

    return {
      value: readResult.value,
      version: readResult.version,
      lockedBy: readResult.lockedBy,
      owner: artifact?.metadata?.createdBy,
    };
  }

  /**
   * Write with conflict handling (async-friendly, though currently sync)
   */
  async write(
    key: string,
    value: any,
    agentId: string,
    description?: string
  ): Promise<{ success: boolean; message?: string; conflict?: any; version: number }> {
    // Ensure artifact exists
    this.conflictManager.registerArtifact(key, value, agentId);

    const result = this.conflictManager.write(key, value, agentId, { description });
    return result;
  }

  /**
   * Set value (simple, no conflict resolution beyond strategy)
   * Alias for write but returns only success
   */
  async set(key: string, value: any, agentId: string, description?: string): Promise<boolean> {
    const result = await this.write(key, value, agentId, description);
    return result.success;
  }

  /**
   * Try to acquire exclusive lock
   */
  tryLock(key: string, agentId: string, ttl?: number): { locked: boolean; lockToken?: string; owner?: string } {
    return this.conflictManager.tryLock(key, agentId, ttl);
  }

  /**
   * Release lock
   */
  releaseLock(key: string, agentId: string): boolean {
    return this.conflictManager.releaseLock(key, agentId);
  }

  /**
   * Read with lock acquisition (atomic)
   */
  readWithLock(key: string, agentId: string): {
    value: any;
    version: number;
    locked: boolean;
    lockToken?: string;
    lockedBy?: string;
  } {
    const lockResult = this.conflictManager.tryLock(key, agentId);
    if (!lockResult.locked) {
      return { value: null, version: 0, locked: false, lockedBy: lockResult.owner };
    }
    const read = this.read(key);
    if (!read) {
      return { value: null, version: 0, locked: true, lockToken: lockResult.lockToken };
    }
    return { ...read, locked: true, lockToken: lockResult.lockToken };
  }

  /**
   * List all artifact keys
   */
  list(): string[] {
    return this.conflictManager.listArtifacts();
  }

  /**
   * List keys by prefix
   */
  listByPrefix(prefix: string): string[] {
    return this.list().filter(k => k.startsWith(prefix));
  }

  /**
   * Get artifact info (exists, locked, version)
   */
  getArtifactInfo(key: string): { exists: boolean; lockedBy?: string; version: number; accessCount?: number } {
    return this.conflictManager.getArtifactInfo(key) ?? { exists: false, version: 0 };
  }

  /**
   * Delete artifact
   */
  delete(key: string): boolean {
    // Not implemented - would need artifact removal from map
    // For now return false
    return false;
  }

  /**
   * Clear all artifacts
   */
  clear(): void {
    // Not easily possible with conflict manager private map
    // Could add clear method to manager
  }

  /**
   * Get all entries as plain object
   */
  toObject(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const key of this.list()) {
      const val = this.get(key);
      obj[key] = val;
    }
    return obj;
  }

  /**
   * Get conflict info for debugging
   */
  getConflicts(resolved: boolean = false) {
    return this.conflictManager.getConflicts(resolved);
  }

  /**
   * Resolve conflict manually
   */
  resolveConflict(artifactKey: string, resolution: "accept-latest" | "accept-earliest" | "merge"): boolean {
    // Need agentId? Use placeholder
    return this.conflictManager.resolveConflict(artifactKey, resolution, "unknown");
  }
}
