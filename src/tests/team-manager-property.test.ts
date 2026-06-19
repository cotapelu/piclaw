#!/usr/bin/env node
/**
 * Property-based tests for AgentTeam invariants.
 * Uses random sequences to verify core consistency properties.
 */

import { test, expect, describe, beforeEach, afterEach } from "vitest";
import { AgentTeam } from "../extensions/team/team-manager.js";

describe("AgentTeam Property Tests", () => {
  let team: AgentTeam;

  function createFakeRuntime(sessionId: string): any {
    return { session: { sessionId } };
  }

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId(`property-test-${Date.now()}`);
    // Register a parent and a couple of agents
    team.registerRuntime(createFakeRuntime('parent-session'), 'parent');
    team.registerRuntime(createFakeRuntime('agent-1'), 'agent-1');
    team.registerRuntime(createFakeRuntime('agent-2'), 'agent-2');
  });

  afterEach(async () => {
    await team.dispose();
  });

  test("pendingIndices always sorted and unique", async () => {
    await team.initialize(['t0','t1','t2','t3','t4']);
    // Perform 100 random actions: claim then complete/release/fail
    for (let i = 0; i < 100; i++) {
      const status = await team.getTeamStatus();
      if (status.pendingTasks > 0) {
        const idx = await team.claimTask('agent-1');
        if (idx !== null) {
          const choice = Math.random();
          if (choice < 0.4) {
            await team.completeTask('agent-1', idx, 'ok');
          } else if (choice < 0.7) {
            await team.handleAgentFailure('agent-1', idx, new Error('sim'));
          } else {
            await team.releaseTask('agent-1', idx);
          }
        }
      }
      // Check pendingIndices sorted and unique
      const p = team.pendingIndices;
      for (let j = 1; j < p.length; j++) {
        expect(p[j]).toBeGreaterThan(p[j-1]);
      }
      // Ensure each pending index points to a task with status 'pending'
      for (const idx of p) {
        const t = team.taskStatuses.get(idx);
        expect(t).toBeDefined();
        if (t) expect(t.status).toBe('pending');
      }
    }
  });

  test("task assignment is exclusive", async () => {
    await team.initialize(['a','b','c','d','e']);
    const claimed: number[] = [];
    for (let i = 0; i < 30; i++) {
      const status = await team.getTeamStatus();
      if (status.pendingTasks > 0) {
        const agent = Math.random() < 0.5 ? 'agent-1' : 'agent-2';
        const idx = await team.claimTask(agent);
        if (idx !== null) claimed.push(idx);
      }
    }
    // No duplicates
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  test("total counts match tasks length", async () => {
    for (let n = 1; n < 30; n++) {
      const tasks = Array.from({length: n}, (_, i) => `task ${i}`);
      await team.initialize(tasks);
      const s = await team.getTeamStatus();
      expect(s.totalTasks).toBe(n);
      expect(s.tasks.length).toBe(n);
    }
  });

  test("completed+failed+pending = total", async () => {
    for (let iter = 0; iter < 20; iter++) {
      await team.initialize(['x','y','z','w']);
      const ops = Math.floor(Math.random() * 15) + 5;
      for (let i = 0; i < ops; i++) {
        const s = await team.getTeamStatus();
        if (s.pendingTasks > 0) {
          const idx = await team.claimTask('agent-1');
          if (idx !== null) {
            if (Math.random() < 0.6) {
              await team.completeTask('agent-1', idx, 'done');
            } else {
              await team.handleAgentFailure('agent-1', idx, new Error('fail'));
            }
          }
        }
      }
      const final = await team.getTeamStatus();
      expect(final.completedTasks + final.failedTasks + final.pendingTasks).toBe(final.totalTasks);
    }
  });

  test("zombie reclamation resets in_progress tasks", async () => {
    await team.initialize(['t0','t1']);
    const idx = await team.claimTask('agent-1');
    expect(idx).not.toBeNull();
    // Simulate zombie
    (team as any).agentLastSeen.set('agent-1', Date.now() - 200_000); // 200s > 120s timeout
    team.reclaimZombieAgents();
    const status = await team.getTeamStatus();
    const agentStatus = status.agents.find((a: any) => a.id === 'agent-1');
    expect(agentStatus?.status).toBe('idle');
    const t = status.tasks[idx!];
    expect(['pending','failed']).toContain(t.status);
  });

});
