import { describe, it, expect, vi, afterEach } from 'vitest';
import { AgentTeam, TeamRegistry } from '../extensions/team/team-manager.js';

// Use AGENT_TIMEOUT_MS constant from file? It's private. We'll compute relative.
// We can access via any or just use our own value larger than constant? Actually we need to set timestamp older than constant. We'll approximate: AGENT_TIMEOUT_MS = 2 * 60 * 1000 = 120000.
const AGENT_TIMEOUT_MS = 2 * 60 * 1000;

describe('AgentTeam Edge Cases', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should reclaim zombie agents and reassign tasks with backoff', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);

    // Agent claims task
    const idx = await team.claimTask('agent-1');
    expect(idx).toBe(0);

    const anyTeam = team as any;
    // Simulate old heartbeat
    anyTeam.agentLastSeen.set('agent-1', Date.now() - AGENT_TIMEOUT_MS - 1);

    // Run reclaim
    team.reclaimZombieAgents();

    // Task should be pending with backoff
    const task = anyTeam.taskStatuses.get(0) as any;
    expect(task.status).toBe('pending');
    expect(task.retryCount).toBe(1);
    expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
    expect(anyTeam.pendingIndices).toContain(0);
    // Agent should be idle
    const agentStat = anyTeam.agentStatuses.get('agent-1') as any;
    expect(agentStat.status).toBe('idle');
  });

  it('should mark task failed after max retries in handleAgentFailure', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    await team.claimTask('agent-1');

    const anyTeam = team as any;
    // Set retryCount to max-1 (since DEFAULTS 3, after failure will become 3)
    const task = anyTeam.taskStatuses.get(0) as any;
    task.retryCount = 2; // one more will reach 3

    await team.handleAgentFailure('agent-1', 0, new Error('boom'));

    expect(task.status).toBe('failed');
    expect(task.result).toContain('boom');
    expect(anyTeam.pendingIndices).not.toContain(0);
    const agentStat = anyTeam.agentStatuses.get('agent-1') as any;
    expect(agentStat.status).toBe('idle');
  });

  it('should retry with backoff on agent failure before max retries', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    await team.claimTask('agent-1');

    const anyTeam = team as any;
    const task = anyTeam.taskStatuses.get(0) as any;
    task.retryCount = 0;

    await team.handleAgentFailure('agent-1', 0, new Error('oops'));

    expect(task.status).toBe('pending');
    expect(task.retryCount).toBe(1);
    expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
    expect(anyTeam.pendingIndices).toContain(0);
    const agentStat = anyTeam.agentStatuses.get('agent-1') as any;
    expect(agentStat.status).toBe('idle');
  });

  it('should not reassign a task that is still in backoff', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    const anyTeam = team as any;
    // Simulate a pending task with backoff in future
    const backoffTime = Date.now() + 60 * 60 * 1000;
    anyTeam.taskStatuses.set(0, { assignee: null, status: 'pending', result: '', retryCount: 1, retryAvailableAt: backoffTime } as any);
    anyTeam.pendingIndices = [0];
    anyTeam.agentStatuses = new Map();
    anyTeam.roleByAgentId = new Map();

    const claim = await team.claimTask('agent-1');
    expect(claim).toBeNull();
  });

  it('should release task and return to pending', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    await team.claimTask('agent-1');

    const anyTeam = team as any;
    const released = await team.releaseTask('agent-1', 0);
    expect(released).toBe(true);
    expect(anyTeam.pendingIndices).toContain(0);
    const task = anyTeam.taskStatuses.get(0) as any;
    expect(task.status).toBe('pending');
    expect(task.assignee).toBeNull();
  });

  it('should update heartbeat correctly', () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    team.initialize([]).then(() => {
      const anyTeam = team as any;
      // Initially, agentLastSeen empty
      expect(anyTeam.agentLastSeen.has('agent-1')).toBe(false);
      team.updateHeartbeat('agent-1');
      expect(anyTeam.agentLastSeen.has('agent-1')).toBe(true);
      const lastSeen = anyTeam.agentLastSeen.get('agent-1');
      expect(lastSeen).toBeGreaterThanOrEqual(Date.now() - 1000);
    });
  });

  it('should write and read from workspace', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.workspaceWrite('mykey', 'myvalue', 'parent');
    const val = await team.workspaceRead('mykey');
    expect(val).toBe('myvalue');
  });

  it('should list workspace keys', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.workspaceWrite('k1', 'v1', 'parent');
    await team.workspaceWrite('k2', 'v2', 'parent');
    const keys = await team.workspaceList();
    expect(keys.sort()).toEqual(['k1', 'k2']);
  });

  it('should delete workspace key', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.workspaceWrite('k', 'v', 'parent');
    const deleted = await team.workspaceDelete('k');
    expect(deleted).toBe(true);
    const val = await team.workspaceRead('k');
    expect(val).toBeUndefined();
  });

  it('should publish and retrieve messages', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.publishMessage('channel', 'agent-1', 'hello');
    const msgs = await team.getMessages('channel');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('hello');
  });

  // Additional coverage tests

  it('should claimTask return null when no pending tasks', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    const anyTeam = team as any;
    anyTeam.pendingIndices = [];
    const idx = await team.claimTask('agent-1');
    expect(idx).toBeNull();
  });

  it('should handle handleAgentFailure for task not assigned', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    await team.handleAgentFailure('agent-1', 0);
    const anyTeam = team as any;
    const task = anyTeam.taskStatuses.get(0) as any;
    expect(task.status).toBe('pending');
    expect(anyTeam.pendingIndices).toContain(0);
  });

  it('should return correct team status after initialize', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A', 'Task B']);
    const status = await team.getTeamStatus();
    expect(status.totalTasks).toBe(2);
    expect(status.pendingTasks).toBe(2);
    expect(status.completedTasks).toBe(0);
    expect(status.failedTasks).toBe(0);
    expect(status.isComplete).toBe(false);
    expect(status.agents).toEqual([]);
  });

  it('should get my current task after claim', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    const idx = await team.claimTask('agent-1');
    expect(idx).toBe(0);
    const current = await team.getMyCurrentTask('agent-1');
    expect(current).toBe(0);
  });

  it('should complete task and update agent status', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    const idx = await team.claimTask('agent-1');
    expect(idx).toBe(0);
    await team.completeTask('agent-1', 0, 'result data');
    const anyTeam = team as any;
    const task = anyTeam.taskStatuses.get(0) as any;
    expect(task.status).toBe('completed');
    expect(task.result).toBe('result data');
    expect(task.assignee).toBeNull();
    expect(anyTeam.pendingIndices).not.toContain(0);
    const status = anyTeam.agentStatuses.get('agent-1') as any;
    expect(status.status).toBe('idle');
    expect(status.currentTaskIndex).toBeNull();
  });

  it('should get results after multiple completions', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A', 'Task B']);
    await team.claimTask('agent-1');
    await team.claimTask('agent-2');
    await team.completeTask('agent-1', 0, 'first');
    await team.completeTask('agent-2', 1, 'second');
    const results = await team.getResults();
    expect(results).toEqual(['first', 'second']);
  });

  it('should wait for completion when tasks already done', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    await team.claimTask('agent-1');
    await team.completeTask('agent-1', 0, 'done');
    await expect(team.waitForCompletion()).resolves.toBeUndefined();
  });

  it('should dispose child controllers and promises', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    const fakeController = { abort: vi.fn() } as any;
    (team as any).childControllers.set('agent-1', fakeController);
    (team as any).childPromises.push(Promise.resolve());
    (team as any).runtimes.push({ dispose: vi.fn().mockResolvedValue(undefined) } as any);
    await team.dispose();
    expect(fakeController.abort).toHaveBeenCalled();
  });

  it('should handle reclaimZombieAgents with no agents', () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    const anyTeam = team as any;
    anyTeam.agentLastSeen.clear();
    anyTeam.agentStatuses.clear();
    team.reclaimZombieAgents();
    expect(anyTeam.taskStatuses.size).toBe(0);
  });

  it('should ignore reportResult for missing task', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');
    await team.initialize(['Task A']);
    await team.reportResult(1, 'result');
    const anyTeam = team as any;
    const task0 = anyTeam.taskStatuses.get(0) as any;
    expect(task0.status).toBe('pending');
  });

  it('should dispose team and clean up resources', async () => {
    const team = new AgentTeam();
    team.setTeamId('test-team');

    // Mock runtimes with dispose
    const mockRuntime = { dispose: vi.fn().mockResolvedValue(undefined) } as any;
    (team as any).runtimes.push(mockRuntime);
    // Mock childControllers
    const mockController = { abort: vi.fn() };
    (team as any).childControllers.set('test-controller', mockController);
    // Mock childPromises
    const childPromise = Promise.resolve();
    (team as any).childPromises.push(childPromise);
    // Inject mock manager
    const mockManager = { unregister: vi.fn() } as any;
    (team as any).manager = mockManager;

    await team.dispose();

    expect(mockRuntime.dispose).toHaveBeenCalled();
    expect(mockController.abort).toHaveBeenCalled();
    expect((team as any).childPromises).toHaveLength(0);
    expect((team as any).runtimes).toHaveLength(0);
    expect(mockManager.unregister).toHaveBeenCalledWith('test-team');
  });
});
