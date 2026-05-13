/**
 * Performance Benchmarks for Team Operations
 *
 * Run with: npx tsx src/benchmarks/team-performance.ts
 */

import { TeamMessageBus } from '../team/message-bus.js';
import { ConflictResolutionManager } from '../team/conflict-resolution.js';
import { CollaborativeWorkspace } from '../team/conflict-resolution.js';
import { TeamMetricsCollector } from '../team/team-metrics.js';

interface BenchmarkResult {
  name: string;
  operations: number;
  totalMs: number;
  avgMs: number;
  opsPerSec: number;
}

class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  async run(name: string, fn: () => Promise<unknown> | unknown, iterations: number = 1000): Promise<BenchmarkResult> {
    console.log(`\n🏃 Running: ${name} (${iterations} iterations)`);

    // Warmup
    for (let i = 0; i < Math.min(10, iterations); i++) {
      fn();
    }

    // Actual benchmark
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
    const end = performance.now();

    const totalMs = end - start;
    const avgMs = totalMs / iterations;
    const opsPerSec = (iterations / totalMs) * 1000;

    const result: BenchmarkResult = {
      name,
      operations: iterations,
      totalMs,
      avgMs,
      opsPerSec,
    };

    this.results.push(result);
    this.printResult(result);
    return result;
  }

  printResult(result: BenchmarkResult): void {
    console.log(`  ✅ ${result.opsPerSec.toFixed(2)} ops/sec (avg: ${result.avgMs.toFixed(4)} ms)`);
  }

  printSummary(): void {
    console.log(`\n${  '═'.repeat(60)}`);
    console.log('📊 BENCHMARK SUMMARY');
    console.log('═'.repeat(60));
    for (const r of this.results) {
      console.log(`${r.name.padEnd(40)} ${r.opsPerSec.toFixed(2).padStart(12)} ops/sec`);
    }
    console.log('═'.repeat(60));
  }
}

async function main() {
  const runner = new BenchmarkRunner();

  // 1. Message Bus Throughput
  const bus = new TeamMessageBus();
  await runner.run('Message Bus: publish single message', () => {
    bus.publish({
      channel: 'team.chat',
      from: 'agent-1',
      content: 'Hello',
    });
  }, 10000);

  await runner.run('Message Bus: publish with type', () => {
    bus.publish({
      channel: 'team.help',
      from: 'agent-2',
      content: 'Need assistance',
      type: 'help_request',
    });
  }, 10000);

  // Subscribe and receive
  bus.subscribe('agent-3', 'team.chat', { callback: () => {} });
  await runner.run('Message Bus: publish to subscribed agent', () => {
    bus.publish({
      channel: 'team.chat',
      from: 'agent-1',
      content: 'Broadcast',
    });
  }, 10000);

  // Direct messages
  await runner.run('Message Bus: direct message', () => {
    bus.sendDirectMessage('agent-1', 'agent-2', 'Private');
  }, 10000);

  // Get messages
  await runner.run('Message Bus: getMessages (small)', () => {
    bus.getMessages('team.chat');
  }, 5000);

  // 2. Workspace Latency
  const manager = new ConflictResolutionManager();
  const workspace = new CollaborativeWorkspace(manager);

  // Setup
  for (let i = 0; i < 100; i++) {
    await workspace.set(`key-${i}`, { value: i }, 'agent-1');
  }

  await runner.run('Workspace: get (existing key)', () => {
    return workspace.get('key-42');
  }, 20000);

  await runner.run('Workspace: set (update)', () => {
    return workspace.set('key-42', { value: 999 }, 'agent-2');
  }, 10000);

  await runner.run('Workspace: tryLock + release', async () => {
    const locked = await workspace.tryLock('key-0', 'agent-3');
    if (locked.locked) {
      await workspace.releaseLock('key-0', 'agent-3');
    }
  }, 5000);

  await runner.run('Workspace: readWithLock', async () => {
    const result = await workspace.readWithLock('key-1', 'agent-4');
    await workspace.releaseLock('key-1', 'agent-4');
    return result;
  }, 5000);

  await runner.run('Workspace: list keys', () => {
    return workspace.list();
  }, 10000);

  await runner.run('Workspace: getArtifactInfo', () => {
    return workspace.getArtifactInfo('key-42');
  }, 20000);

  // 3. ConflictResolutionManager throughput
  const crManager = new ConflictResolutionManager();

  // Setup
  for (let i = 0; i < 50; i++) {
    crManager.registerArtifact(`artifact-${i}`, { data: i }, 'agent-1');
  }

  await runner.run('ConflictResolution: read artifact', () => {
    return crManager.read('artifact-25');
  }, 20000);

  await runner.run('ConflictResolution: write artifact', () => {
    return crManager.write('artifact-25', { data: 999 }, 'agent-2');
  }, 10000);

  await runner.run('ConflictResolution: tryLock', () => {
    return crManager.tryLock('artifact-25', 'agent-3');
  }, 10000);

  await runner.run('ConflictResolution: releaseLock', () => {
    return crManager.releaseLock('artifact-25', 'agent-3');
  }, 10000);

  await runner.run('ConflictResolution: listArtifacts', () => {
    return crManager.listArtifacts();
  }, 10000);

  await runner.run('ConflictResolution: getVersions', () => {
    return crManager.getVersions('artifact-25');
  }, 10000);

  await runner.run('ConflictResolution: getArtifactInfo', () => {
    return crManager.getArtifactInfo('artifact-25');
  }, 20000);

  // 4. TeamMetricsCollector overhead
  const metrics = TeamMetricsCollector.getInstance();
  metrics.reset();

  await runner.run('Metrics: recordTaskCompletion', () => {
    metrics.recordTaskCompletion('agent-1', 1000);
  }, 50000);

  await runner.run('Metrics: recordMessageSent', () => {
    metrics.recordMessageSent('agent-1', 'team.chat');
  }, 50000);

  await runner.run('Metrics: recordWorkspaceRead', () => {
    metrics.recordWorkspaceRead('agent-1');
  }, 50000);

  await runner.run('Metrics: getSnapshot', () => {
    return metrics.getSnapshot();
  }, 10000);

  await runner.run('Metrics: toJSON', () => {
    return metrics.toJSON();
  }, 10000);

  // 5. Composite: Multiple agents working
  const compositeBus = new TeamMessageBus();
  const compositeMetrics = TeamMetricsCollector.getInstance();
  compositeMetrics.reset();
  compositeMetrics.setTotalTasks(1000);

  await runner.run('Composite: agent workflow (message + metric)', async () => {
    const msg = compositeBus.publish({
      channel: 'team.chat',
      from: `agent-${Math.floor(Math.random() * 10)}`,
      content: 'Task update',
    });
    compositeMetrics.recordMessageSent(msg.from, msg.channel);
  }, 5000);

  // Large team message broadcast
  for (let i = 0; i < 10; i++) {
    compositeBus.subscribe(`agent-${i}`, 'team.chat', { callback: () => {} });
  }

  await runner.run('Composite: broadcast to many subscribers', async () => {
    const msg = compositeBus.publish({
      channel: 'team.chat',
      from: 'manager',
      content: 'Team meeting now',
    });
    return msg;
  }, 2000);

  // Print summary
  runner.printSummary();
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
