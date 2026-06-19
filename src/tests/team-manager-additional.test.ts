import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTeam, TeamRegistry, executeTeamTasks } from '../extensions/team/team-manager.js';

// Simple mock logger for capturing logs
function createMockLogger() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  };
}

const AGENT_TIMEOUT_MS = 2 * 60 * 1000;

describe('AgentTeam Additional Coverage', () => {
  let team: AgentTeam;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    team = new AgentTeam(mockLogger as any);
    team.setTeamId('test-team');
  });

  it('should return null when no tasks pending', async () => {
    await team.initialize(['Task A']);
    const idx1 = await team.claimTask('agent-1');
    expect(idx1).toBe(0);
    const idx2 = await team.claimTask('agent-2');
    expect(idx2).toBeNull();
  });

  it('should get team status correctly', async () => {
    await team.initialize(['Task A', 'Task B']);
    await team.claimTask('agent-1');
    const status = await team.getTeamStatus();
    expect(status.totalTasks).toBe(2);
    expect(status.completedTasks).toBe(0);
    expect(status.failedTasks).toBe(0);
    expect(status.pendingTasks).toBe(1);
    expect(status.isComplete).toBe(false);
    expect(status.agents).toHaveLength(1);
    expect(status.agents[0].status).toBe('working');
  });

  it('should get current task for agent', async () => {
    await team.initialize(['Task A']);
    await team.claimTask('agent-1');
    const taskIdx = await (team as any).getMyCurrentTask('agent-1');
    expect(taskIdx).toBe(0);
  });

  it('should update heartbeat', async () => {
    await team.initialize(['Task A']);
    (team as any).updateHeartbeat('agent-1');
    const anyTeam = team as any;
    const ts = anyTeam.agentLastSeen.get('agent-1');
    expect(ts).toBeGreaterThan(Date.now() - 1000);
  });

  it('should dispose with runtimes and child promises', async () => {
    const anyTeam = team as any;
    const mockRuntime = { dispose: vi.fn().mockResolvedValue(undefined) } as any;
    anyTeam.runtimes.push(mockRuntime);
    const mockController = { abort: vi.fn() };
    anyTeam.childControllers.set('ctrl', mockController);
    const childPromise = Promise.resolve();
    anyTeam.childPromises.push(childPromise);
    const mockManager = { unregister: vi.fn() } as any;
    // Inject mock manager
    (team as any).manager = mockManager;

    await team.dispose();

    expect(mockRuntime.dispose).toHaveBeenCalled();
    expect(mockController.abort).toHaveBeenCalled();
    expect(anyTeam.childPromises).toHaveLength(0);
    expect(anyTeam.runtimes).toHaveLength(0);
    expect(mockManager.unregister).toHaveBeenCalledWith('test-team');
  });

  it('should run full team lifecycle', async () => {
    const team = new AgentTeam(mockLogger as any);
    team.setTeamId('lifecycle-team');
    await team.initialize(['Task1', 'Task2']);

    const idx1 = await team.claimTask('agent-1');
    expect(idx1).toBe(0);

    const current = await (team as any).getMyCurrentTask('agent-1');
    expect(current).toBe(0);

    const released = await team.releaseTask('agent-1', 0);
    expect(released).toBe(true);

    const idx2 = await team.claimTask('agent-2');
    expect(idx2).toBe(0);

    await team.handleAgentFailure('agent-2', 0, new Error('fail'));
    const anyTeam = team as any;
    let task = anyTeam.taskStatuses.get(0) as any;
    expect(task.status).toBe('pending');
    expect(task.retryCount).toBe(1);

    anyTeam.agentLastSeen.set('agent-2', Date.now() - AGENT_TIMEOUT_MS - 1);
    team.reclaimZombieAgents();
    task = anyTeam.taskStatuses.get(0) as any;
    expect(task.status).toBe('pending');
    expect(anyTeam.pendingIndices).toContain(0);

    const status = await team.getTeamStatus();
    expect(status.totalTasks).toBe(2);
    expect(status.pendingTasks).toBeGreaterThanOrEqual(1);

    (team as any).monitorInterval = setInterval(() => {}, 1000);
    await team.dispose();
    expect((team as any).monitorInterval).toBeNull();
  });

  describe('getContext and workspace', () => {
    it('should return context with correct team summary', async () => {
      const t = new AgentTeam(mockLogger as any);
      t.setTeamId('ctx-test');
      t.roles = ['agent-1'];
      await t.initialize(['A', 'B']);
      const ctx = t.getContext();
      const summary = ctx.getTeamSummary();
      expect(summary.totalTasks).toBe(2);
      expect(summary.completedTasks).toBe(0);
      expect(summary.activeAgents).toBe(0);
      // First claim task then complete it
      const idx = await t.claimTask('agent-1');
      expect(idx).toBe(0);
      await t.completeTask('agent-1', 0, 'done');
      const summary2 = ctx.getTeamSummary();
      expect(summary2.completedTasks).toBe(1);
      expect(summary2.activeAgents).toBe(0);
    });
  });

  describe('notifyUpdate error handling', () => {
    it('should catch errors in onUpdate and log warning without crashing', () => {
      const t = new AgentTeam(mockLogger as any);
      (t as any).onUpdate = () => { throw new Error('Update failed'); };
      t.notifyUpdate({ content: [{ type: 'text', text: 'test' }] });
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send update'), expect.any(Error));
    });
  });

  describe('workspace operations', () => {
    it('should perform workspace writes and reads with lock', async () => {
      const t = new AgentTeam(mockLogger as any);
      await t.initialize(['A']);
      await t.workspaceWrite('key1', { x: 1 }, 'agent-1');
      const val = await t.workspaceRead('key1');
      expect(val).toEqual({ x: 1 });
      const keys = await t.workspaceList();
      expect(keys).toContain('key1');
      await t.workspaceDelete('key1');
      const keys2 = await t.workspaceList();
      expect(keys2).not.toContain('key1');
    });

    it('should clear workspace', async () => {
      const t = new AgentTeam(mockLogger as any);
      await t.initialize(['A']);
      await t.workspaceWrite('k1', 1, 'a1');
      await t.workspaceWrite('k2', 2, 'a2');
      await t.workspaceClear();
      const keys = await t.workspaceList();
      expect(keys).toHaveLength(0);
    });
  });

  describe('message bus', () => {
    it('should send and receive messages on channel', async () => {
      const t = new AgentTeam(mockLogger as any);
      await t.initialize(['A']);
      await t.publishMessage('channel1', 'agent-1', 'hello');
      const msgs = await t.getMessages('channel1');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].from).toBe('agent-1');
      expect(msgs[0].content).toBe('hello');
    });

    it('should limit messages with limit param', async () => {
      const t = new AgentTeam(mockLogger as any);
      await t.initialize(['A']);
      for (let i = 0; i < 5; i++) {
        await t.publishMessage('chan', `agent-${i}`, `msg${i}`);
      }
      const last2 = await t.getMessages('chan', 2);
      expect(last2).toHaveLength(2);
      expect(last2[0].content).toBe('msg3');
      expect(last2[1].content).toBe('msg4');
    });
  });

  describe('task reporting', () => {
    it('should record metrics on completeTask', async () => {
      const t = new AgentTeam(mockLogger as any);
      await t.initialize(['Task X']);
      const idx = await t.claimTask('agent-1');
      expect(idx).toBe(0);
      await t.completeTask('agent-1', 0, 'result X');
      const results = await t.getResults();
      expect(results[0]).toBe('result X');
      const metrics = t.getMetrics();
      expect(metrics.completedTasks).toBe(1);
      expect(metrics.agentTaskCounts['agent-1']).toBe(1);
    });
  });

  describe('zombie reclamation', () => {
    it('should reclaim zombie agents and requeue tasks', async () => {
      const t = new AgentTeam(mockLogger as any);
      await t.initialize(['T1', 'T2']);
      await t.claimTask('agent-1');
      await t.claimTask('agent-2');
      // Simulate zombie for agent-1
      (t as any).agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1);
      t.reclaimZombieAgents();
      const status = await t.getTeamStatus();
      const agent1 = status.agents.find((a: any) => a.id === 'agent-1');
      expect(agent1?.status).toBe('idle');
      // Both tasks should be pending again
      expect(status.pendingTasks).toBeGreaterThanOrEqual(1);
    });
  });
});
