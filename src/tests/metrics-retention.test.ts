#!/usr/bin/env node
/**
 * Tests for metrics retention cleanup utility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanupOldMetrics } from '../utils/metrics-retention.js';
import { mkdir, writeFile, utimes, readdir, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('metrics-retention', () => {
  let dir: string;

  // Helper to create a file with a specific age in days
  async function createFile(name: string, ageDays: number): Promise<void> {
    const filePath = join(dir, name);
    await writeFile(filePath, '{}');
    const mtime = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    const atime = new Date();
    await utimes(filePath, atime, mtime);
  }

  beforeEach(async () => {
    dir = join(tmpdir(), `piclaw-metrics-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up directory contents and remove dir
    try {
      const files = await readdir(dir);
      for (const f of files) {
        await unlink(join(dir, f));
      }
    } catch {}
    try {
      await rmdir(dir);
    } catch {}
  });

  it('deletes files older than retention period', async () => {
    // Create files
    await createFile('metrics-2020-01-01.json', 365 * 5); // very old (5 years)
    await createFile(`metrics-${new Date().toISOString().slice(0, 10)}.json`, 0); // today
    // 31 days old (beyond 30-day retention) - should be deleted
    await createFile('metrics-2024-05-26.json', 31);
    // Non-matching file
    await createFile('other.json', 10);
    // Malformed name
    await createFile('metrics-invalid.json', 10);

    const retentionDays = 30;
    await cleanupOldMetrics(dir, retentionDays);

    const remaining = await readdir(dir);

    // Should keep today's and the 30-day-old file (since retention=30, files with mtime >= cutoff are kept)
    // For 31 days old, mtime < cutoff, so deleted.
    expect(remaining).toContain(`metrics-${new Date().toISOString().slice(0, 10)}.json`);
    expect(remaining).not.toContain('metrics-2024-05-26.json'); // 31 days old should be deleted
    expect(remaining).not.toContain('metrics-2020-01-01.json');
    expect(remaining).toContain('other.json'); // not matched pattern
    expect(remaining).toContain('metrics-invalid.json'); // malformed name, should be kept
  });

  it('handles non-existent directory gracefully', async () => {
    const nonExistent = join(dir, 'does-not-exist');
    // Should not throw
    await expect(cleanupOldMetrics(nonExistent, 30)).resolves.toBeUndefined();
  });

  it('respects retentionDays 0 (keep all)', async () => {
    await createFile('metrics-2020-01-01.json', 365 * 5);
    await createFile('metrics-recent.json', 1);

    await cleanupOldMetrics(dir, 0);

    const remaining = await readdir(dir);
    expect(remaining).toContain('metrics-2020-01-01.json');
    expect(remaining).toContain('metrics-recent.json');
  });

  it('handles negative retention days as no-op', async () => {
    await createFile('metrics-2020-01-01.json', 365 * 5);
    await cleanupOldMetrics(dir, -10);
    const remaining = await readdir(dir);
    expect(remaining).toContain('metrics-2020-01-01.json');
  });

  it('ignores non-metrics files', async () => {
    await createFile('foo.txt', 365);
    await createFile('bar.json', 365);
    await cleanupOldMetrics(dir, 1);
    const remaining = await readdir(dir);
    expect(remaining).toContain('foo.txt');
    expect(remaining).toContain('bar.json');
  });
});
