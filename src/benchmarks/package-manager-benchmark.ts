#!/usr/bin/env node

/**
 * Package Manager Performance Benchmark
 *
 * Measures the overhead of PiclawPackageManager update logic with many sources.
 * Run with: npx tsx src/benchmarks/package-manager-benchmark.ts
 */

import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { PiclawPackageManager } from "../piclaw-package-manager.js";

async function benchmarkUpdate(packageCount: number, concurrency: number): Promise<{
  packages: number;
  totalTimeMs: number;
  avgMsPerPkg: number;
  opsPerSecond: number;
  memoryDeltaMB: number;
}> {
  const memoryBefore = process.memoryUsage().heapUsed;
  const sessionDir = join(tmpdir(), `piclaw-pm-bench-${Date.now()}`);
  mkdirSync(sessionDir, { recursive: true });

  // Create a PiclawPackageManager
  const pm = new PiclawPackageManager({ cwd: sessionDir, agentDir: sessionDir });

  // Stub runCommandCapture to avoid real installs and speed up benchmark
  const stubResult = { stdout: '', stderr: '' };
  pm.runCommandCapture = async () => stubResult;

  // Generate many dummy npm packages and add to settings
  const sourceName = `benchmark-${Date.now()}`;
  for (let i = 0; i < packageCount; i++) {
    // add source to settings
    pm.addSourceToSettings(`npm:dummy-pkg-${i}`, { sourceGroup: sourceName });
  }

  console.log(`\n🚀 Benchmarking update with ${packageCount} packages (concurrency=${concurrency})`);

  const start = performance.now();
  // Run update with dryRun to avoid side-effects (but we stub anyway)
  await pm.update({ dryRun: true });
  const end = performance.now();

  const totalTimeMs = end - start;
  const avgMsPerPkg = totalTimeMs / packageCount;
  const opsPerSecond = (packageCount / totalTimeMs) * 1000;

  // Cleanup
  if (existsSync(sessionDir)) rmSync(sessionDir, { recursive: true, force: true });

  // Measure memory after cleanup to see net allocation
  const memoryAfter = process.memoryUsage().heapUsed;

  return {
    packages: packageCount,
    totalTimeMs,
    avgMsPerPkg,
    opsPerSecond,
    memoryDeltaMB: (memoryAfter - memoryBefore) / 1e6,
  };
}

async function runBenchmarks() {
  console.log("=== Package Manager Performance Benchmark ===\n");

  const results: any[] = [];

  // Test various package counts to see scaling
  const testCases = [
    { count: 100, concurrency: 5 },
    { count: 500, concurrency: 10 },
    { count: 1000, concurrency: 10 },
    { count: 2500, concurrency: 20 },
    { count: 5000, concurrency: 20 },
  ];

  for (const tc of testCases) {
    try {
      const result = await benchmarkUpdate(tc.count, tc.concurrency);
      results.push(result);
      console.log(`✅ ${tc.count} pkgs: total=${result.totalTimeMs.toFixed(2)}ms, avg=${result.avgMsPerPkg.toFixed(3)}ms/pkg, throughput=${result.opsPerSecond.toFixed(1)} pkg/s`);
    } catch (err: any) {
      console.error(`❌ ${tc.count} pkgs failed:`, err.message);
    }
  }

  console.log("\n=== Results ===");
  console.table(results);

  // Write to JSON for analysis
  const outFile = join(process.cwd(), "pm-benchmark-results.json");
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n📊 Results saved to: ${outFile}`);

  // Suggest thresholds
  console.log("\n💡 Suggested Performance Thresholds:");
  if (results.length > 0) {
    const latest = results[results.length - 1];
    console.log(`   - Average per package: < ${(latest.avgMsPerPkg * 1.1).toFixed(3)}ms`);
    console.log(`   - Throughput for 1000 pkgs: > ${(1000 / (latest.avgMsPerPkg * 1.1)).toFixed(0)} pkg/s`);
  }
}

runBenchmarks().catch(err => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
