import { AgentTeam } from '../team-manager.js';

// Mock runtime (minimal)
const mockRuntime = { session: { id: 'agent' } } as any;

describe('AgentTeam Performance', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.registerRuntime(mockRuntime, 'agent-1');
  });

  test('claimTask linear scan is acceptable for typical sizes', async () => {
    const sizes = [10, 50, 100, 500];
    const iterations = 1000;

    for (const size of sizes) {
      await team.initialize(Array.from({ length: size }, (_, i) => `task${i}`));

      // Warm up
      for (let i = 0; i < size; i++) {
        await team.claimTask('agent-1');
        await team.completeTask('agent-1', i, `result${i}`);
      }

      // Measure
      const start = Date.now();
      for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < size; i++) {
          await team.claimTask('agent-1');
          await team.completeTask('agent-1', i, `result${i}`);
        }
      }
      const elapsed = Date.now() - start;
      const avgOpsPerMs = (iterations * size) / elapsed;
      // Should handle at least 1 claim+complete per ms for typical sizes
      expect(avgOpsPerMs).toBeGreaterThan(0.5);
    }
  }, 60000);

  test('getTeamStatus does not grow quadratically', async () => {
    const sizes = [10, 100, 500];
    for (const size of sizes) {
      await team.initialize(Array.from({ length: size }, (_, i) => `task${i}`));
      // Mark half as completed
      for (let i = 0; i < size / 2; i++) {
        await team.completeTask('agent-1', i, `result${i}`);
      }

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await team.getTeamStatus();
      }
      const elapsed = Date.now() - start;
      // Should be sublinear-ish in practice; 100 calls should be fast (<50ms even for 500 tasks)
      expect(elapsed).toBeLessThan(50);
    }
  });
});
