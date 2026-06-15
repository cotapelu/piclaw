#!/usr/bin/env node

/**
 * Long-Running Stability Test
 *
 * Simulates extended operation by performing many cycles of core operations.
 * Goal: detect resource leaks, file descriptor exhaustion, or progressive slowdown.
 *
 * This test runs a mixed workload:
 * - Package manager update cycles with many sources
 * - AgentTeam lifecycle (create, run tasks, dispose)
 *
 * It is designed to be run in CI with a timeout (e.g., 2-3 minutes).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PiclawPackageManager } from '../piclaw-package-manager.js';
import { AgentTeam } from '../extensions/team/team-manager.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

// Stub runCommandCapture globally for package manager
// We'll do it per instance.

// Helper: measure memory after GC if possible
function getHeapUsed(): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gc = (global as any).gc;
  if (gc) gc();
  return process.memoryUsage().heapUsed;
}

describe('Long-Running Stability', () => {
  let pm: PiclawPackageManager;
  let sessionDir: string;

  beforeEach(() => {
    sessionDir = join(tmpdir(), `piclaw-stability-${Date.now()}`);
    mkdirSync(sessionDir, { recursive: true });
    pm = new PiclawPackageManager({ cwd: sessionDir, agentDir: sessionDir });
    pm.runCommandCapture = async () => ({ stdout: '', stderr: '' } as any);
    pm.setProgressCallback(() => {});
  });

  afterEach(() => {
    if (existsSync(sessionDir)) rmSync(sessionDir, { recursive: true, force: true });
  });

  it('should remain stable over many package manager update cycles', async () => {
    const packageCount = 1000;
    const cycles = 20;

    // Add many sources once
    const sourceGroup = `stability-${Date.now()}`;
    for (let i = 0; i < packageCount; i++) {
      pm.addSourceToSettings(`npm:stress-pkg-${i}`, { sourceGroup });
    }

    const memoryBefore = getHeapUsed();
    const start = performance.now();

    for (let cycle = 0; cycle < cycles; cycle++) {
      await pm.update({ dryRun: true });
      // Optionally: check that no accumulated state bloats
    }

    const elapsed = performance.now() - start;
    const memoryAfter = getHeapUsed();
    const memoryDeltaMB = (memoryAfter - memoryBefore) / 1e6;
    const avgCycleTime = elapsed / cycles;

    console.log(`\n📈 Package manager stability: ${cycles} cycles, ${packageCount} sources`);
    console.log(`   Total time: ${elapsed.toFixed(2)}ms, avg: ${avgCycleTime.toFixed(2)}ms/cycle`);
    console.log(`   Memory delta: ${memoryDeltaMB.toFixed(2)} MB`);

    // Allow reasonable memory growth (e.g., <10MB over many cycles)
    expect(memoryDeltaMB).toBeLessThan(10);
    // Ensure total time is not degrading severely (e.g., < 5 seconds for 20 cycles)
    expect(elapsed).toBeLessThan(5000);
  }, 120000); // 2 min timeout

  it('should handle repeated team creation and disposal without leaks', async () => {
    const iterations = 50; // reduce to keep test time reasonable
    const tasksPerTeam = 5;

    const memoryBefore = getHeapUsed();
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Create a new team
      const team = new AgentTeam();
      team.setTeamId(`stability-team-${i}`);
      // Register a minimal mock runtime
      team.registerRuntime({ session: { sessionId: `session-${i}` } } as any, 'agent-1');

      // Initialize with dummy tasks
      const tasks = Array.from({ length: tasksPerTeam }, (_, t) => `Stability task ${t}`);
      await team.initialize(tasks);

      // Immediately dispose
      await team.dispose();
    }

    const elapsed = performance.now() - start;
    const memoryAfter = getHeapUsed();
    const memoryDeltaMB = (memoryAfter - memoryBefore) / 1e6;

    console.log(`\n📈 Team stability: ${iterations} iterations, tasksPerTeam=${tasksPerTeam}`);
    console.log(`   Total time: ${elapsed.toFixed(2)}ms, avg: ${(elapsed/iterations).toFixed(2)}ms/iter`);
    console.log(`   Memory delta: ${memoryDeltaMB.toFixed(2)} MB`);

    expect(memoryDeltaMB).toBeLessThan(20);
    expect(elapsed).toBeLessThan(15000);
  }, 120000);
});
