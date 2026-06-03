import { describe, it, expect, vi } from 'vitest';
import { AgentTeam } from '../extensions/team/team-manager.js';
import { TeamRegistry } from '../extensions/team/team-manager.js';

const AGENT_TIMEOUT_MS = 2 * 60 * 1000;

describe('AgentTeam Additional Coverage', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
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
    const mockRegistry = { unregister: vi.fn() };
    vi.spyOn(TeamRegistry, 'getInstance').mockReturnValue(mockRegistry as any);

    await team.dispose();

    expect(mockRuntime.dispose).toHaveBeenCalled();
    expect(mockController.abort).toHaveBeenCalled();
    expect(anyTeam.childPromises).toHaveLength(0);
    expect(anyTeam.runtimes).toHaveLength(0);
    expect(mockRegistry.unregister).toHaveBeenCalledWith('test-team');
  });

  it('should run full team lifecycle', async () => {
    const team = new AgentTeam();
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
});
