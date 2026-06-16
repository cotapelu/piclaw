#!/usr/bin/env node
/**
 * Memory Stability Tests
 *
 * Detect potential memory leaks in long-running operations.
 * Focus: package manager repeated update cycles, team workspace operations, session tree churn.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PiclawPackageManager } from '../piclaw-package-manager.js';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Helper to measure heap delta after repeated operations
async function measureMemoryDelta(operation: () => Promise<void>, iterations: number = 10): Promise<number> {
  // Force a GC if available (needs --expose-gc)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gc = (global as any).gc;
  if (gc) {
    gc();
  }

  const before = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i++) {
    await operation();
  }

  // Optional GC after
  if (gc) {
    gc();
  }

  const after = process.memoryUsage().heapUsed;
  return after - before; // bytes
}

describe('Memory Stability: Package Manager', () => {
  let pm: PiclawPackageManager;
  let sessionDir: string;

  beforeEach(() => {
    sessionDir = join(tmpdir(), `piclaw-memtest-${Date.now()}`);
    mkdirSync(sessionDir, { recursive: true });
    pm = new PiclawPackageManager({ cwd: sessionDir, agentDir: sessionDir });
    // Stub out heavy operations to focus on memory within logic
    pm.runCommandCapture = async () => ({ stdout: '', stderr: '' } as any);
    pm.setProgressCallback(() => {});
  });

  afterEach(() => {
    if (existsSync(sessionDir)) {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  it('should not leak memory across repeated update cycles with many sources', async () => {
    // Add 1000 dummy npm sources
    const sourceName = `memtest-${Date.now()}`;
    for (let i = 0; i < 1000; i++) {
      pm.addSourceToSettings(`npm:dummy-pkg-${i}`, { sourceGroup: sourceName });
    }

    // Define operation: run update with dryRun
    const operation = () => pm.update({ dryRun: true });

    // Measure memory delta over 5 iterations
    const deltaBytes = await measureMemoryDelta(operation, 5);
    const deltaMB = deltaBytes / 1e6;

    // Allow up to 5MB growth (generous)
    expect(deltaMB).toBeLessThan(5);

    // Log for visibility
    console.log(`Memory delta (5 iterations): ${deltaMB.toFixed(2)} MB`);
  }, 60000); // allow up to 60s for heavy memory test
});

// Additional test ideas:
// - Team workspace concurrent operations memory growth
// - Session tree create/delete churn
