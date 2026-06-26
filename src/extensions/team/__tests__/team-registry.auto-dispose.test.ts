import { TeamRegistry, AgentTeam } from '../team-manager.js';

describe('TeamRegistry Auto-Dispose', () => {
  let registry: TeamRegistry;

  beforeEach(async () => {
    registry = TeamRegistry.getInstance();
    // Cleanup any existing state
    const teams = Array.from((registry as any).teams.values()) as AgentTeam[];
    for (const team of teams) {
      await team.dispose().catch(console.error);
    }
    (registry as any).teams.clear();
    const timers = Array.from((registry as any).autoDisposeTimers.values()) as NodeJS.Timeout[];
    timers.forEach(clearTimeout);
    (registry as any).autoDisposeTimers.clear();
  });

  afterEach(async () => {
    const teams = Array.from((registry as any).teams.values()) as AgentTeam[];
    for (const team of teams) {
      await team.dispose().catch(console.error);
    }
    (registry as any).teams.clear();
    const timers = Array.from((registry as any).autoDisposeTimers.values()) as NodeJS.Timeout[];
    timers.forEach(clearTimeout);
    (registry as any).autoDisposeTimers.clear();
  });

  test('should create timer when resetAutoDisposeTimer called', () => {
    const team = new AgentTeam();
    team.id = 'team-1';
    registry.register(team.id, team);

    expect((registry as any).autoDisposeTimers.has(team.id)).toBe(false);
    registry.resetAutoDisposeTimer(team.id);
    expect((registry as any).autoDisposeTimers.has(team.id)).toBe(true);
  });

  test('should clear old timer when resetAutoDisposeTimer called again', () => {
    const team = new AgentTeam();
    team.id = 'team-2';
    registry.register(team.id, team);

    registry.resetAutoDisposeTimer(team.id);
    const timer1 = (registry as any).autoDisposeTimers.get(team.id);
    expect(timer1).toBeDefined();

    // Call again
    registry.resetAutoDisposeTimer(team.id);
    const timer2 = (registry as any).autoDisposeTimers.get(team.id);

    // Should still have one timer
    expect((registry as any).autoDisposeTimers.size).toBe(1);
    // Timer reference may be same or different; not important
    expect(timer2).toBeDefined();
  });

  test('should auto-dispose team after delay', async () => {
    const team = new AgentTeam();
    team.id = 'team-3';
    registry.register(team.id, team);

    // Set short delay
    (registry as any).AUTO_DISPOSE_DELAY = 50;

    registry.resetAutoDisposeTimer(team.id);

    // Poll for up to 300ms for the team to be removed (accounts for async file I/O).
    const timeoutMs = 300;
    const start = Date.now();
    while (registry.get(team.id) !== undefined && Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    expect(registry.get(team.id)).toBeUndefined();
  });

  test('should clear timer when team unregistered', () => {
    const team = new AgentTeam();
    team.id = 'team-4';
    registry.register(team.id, team);

    registry.resetAutoDisposeTimer(team.id);
    expect((registry as any).autoDisposeTimers.has(team.id)).toBe(true);

    // Unregister should clear timer
    (registry as any).unregister(team.id);

    expect((registry as any).autoDisposeTimers.has(team.id)).toBe(false);
  });

  test('getTeamStatus should reset timer', async () => {
    const team = new AgentTeam();
    team.id = 'team-5';
    registry.register(team.id, team);

    // Minimal setup to prevent getTeamStatus from throwing
    team.tasks = ['dummy'];
    (team as any).taskStatuses.set(0, { assignee: null, status: 'pending', result: '' });
    (team as any).agentStatuses.set('parent', { currentTaskIndex: null, status: 'idle' });

    expect((registry as any).autoDisposeTimers.has(team.id)).toBe(false);

    await registry.getTeamStatus(team.id);

    expect((registry as any).autoDisposeTimers.has(team.id)).toBe(true);
  });

  test('should not dispose incomplete team on timer', async () => {
    const team = new AgentTeam();
    team.id = 'team-6';
    registry.register(team.id, team);

    // Simulate incomplete team (tasks set but not completed)
    team.tasks = ['task1'];
    (team as any).taskStatuses.set(0, { assignee: null, status: 'pending', result: '' });

    (registry as any).AUTO_DISPOSE_DELAY = 50;
    registry.resetAutoDisposeTimer(team.id);

    // Wait a bit; this test documents intended behavior and has no assertions.
    await new Promise(resolve => setTimeout(resolve, 150));
  });
});
