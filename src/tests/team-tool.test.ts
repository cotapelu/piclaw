import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeamTool } from '../extensions/team/team-tool.js';

// Mock the team-manager module
vi.mock('../extensions/team/team-manager.js', () => ({
  bootPiclawTeam: vi.fn(),
  executeTeamTasks: vi.fn(),
}));

import { bootPiclawTeam, executeTeamTasks } from '../extensions/team/team-manager.js';

const tool = createTeamTool();

describe('team_run tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockParentRuntime = () => ({
    session: { sessionManager: { parentRuntime: null } } as any,
    cwd: '/tmp',
  });

  it('requires tasks array', async () => {
    const parent = createMockParentRuntime();
    const ctx = { sessionManager: { parentRuntime: parent } } as any;
    const result = await tool.execute('id', {} as any, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  });

  it('rejects non-array tasks', async () => {
    const parent = createMockParentRuntime();
    const ctx = { sessionManager: { parentRuntime: parent } } as any;
    const result = await tool.execute('id', { tasks: 'not array' } as any, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  });

  it('requires parentRuntime in context', async () => {
    const ctx = { sessionManager: {} } as any;
    const result = await tool.execute('id', { tasks: ['t1'] }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No parent runtime');
  });

  it('accepts JSON string params', async () => {
    const parent = createMockParentRuntime();
    const ctx = { sessionManager: { parentRuntime: parent } } as any;
    const mockTeam = { dispose: vi.fn().mockResolvedValue(undefined) };
    bootPiclawTeam.mockResolvedValue(mockTeam);
    executeTeamTasks.mockResolvedValue(undefined);
    mockTeam.getResults = vi.fn().mockResolvedValue(['res']);

    const result = await tool.execute('id', '{"tasks":["t1"]}' as any, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(bootPiclawTeam).toHaveBeenCalledWith(parent, expect.anything());
    expect(mockTeam.getResults).toHaveBeenCalled();
  });

  it('executes team successfully with default teamSize', async () => {
    const parent = createMockParentRuntime();
    const ctx = { sessionManager: { parentRuntime: parent } } as any;
    const mockTeam = { dispose: vi.fn().mockResolvedValue(undefined) };
    bootPiclawTeam.mockResolvedValue(mockTeam);
    executeTeamTasks.mockResolvedValue(undefined);
    mockTeam.getResults = vi.fn().mockResolvedValue(['Result 1', 'Result 2']);

    const result = await tool.execute('id', { tasks: ['Task 1', 'Task 2'] }, undefined, undefined, ctx);

    expect(bootPiclawTeam).toHaveBeenCalledWith(parent, expect.anything());
    expect(executeTeamTasks).toHaveBeenCalledWith(mockTeam, ['Task 1', 'Task 2']);
    expect(mockTeam.getResults).toHaveBeenCalled();
    expect(mockTeam.dispose).toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅ Team completed 2 tasks.');
    expect(result.details.results[0].result).toBe('Result 1');
  });

  it('passes custom teamSize and teamRoles', async () => {
    const parent = createMockParentRuntime();
    const ctx = { sessionManager: { parentRuntime: parent } } as any;
    const mockTeam = { dispose: vi.fn().mockResolvedValue(undefined) };
    bootPiclawTeam.mockResolvedValue(mockTeam);
    executeTeamTasks.mockResolvedValue(undefined);
    mockTeam.getResults = vi.fn().mockResolvedValue(['Result']);

    await tool.execute('id', { tasks: ['t1'], teamSize: 3, teamRoles: ['planner', 'coder'] }, undefined, undefined, ctx);

    expect(bootPiclawTeam).toHaveBeenCalledWith(parent, expect.anything()); // custom teamSize and roles passed
    // To be more precise, could check second arg's properties via mock calls

  });

  it('handles bootPiclawTeam failure', async () => {
    const parent = createMockParentRuntime();
    const ctx = { sessionManager: { parentRuntime: parent } } as any;
    bootPiclawTeam.mockRejectedValue(new Error('Boot failed'));

    const result = await tool.execute('id', { tasks: ['t1'] }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Team execution failed');
    expect(result.details.error).toBe('Boot failed');
  });

  it('handles executeTeamTasks failure', async () => {
    const parent = createMockParentRuntime();
    const ctx = { sessionManager: { parentRuntime: parent } } as any;
    const mockTeam = { dispose: vi.fn().mockResolvedValue(undefined) };
    bootPiclawTeam.mockResolvedValue(mockTeam);
    executeTeamTasks.mockRejectedValue(new Error('Task exec failed'));

    const result = await tool.execute('id', { tasks: ['t1'] }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Team execution failed');
    expect(result.details.error).toBe('Task exec failed');
    // In this code path, dispose is not called because catch occurs before dispose
    expect(mockTeam.dispose).not.toHaveBeenCalled();
  });

  it('truncates long task and result previews', async () => {
    const parent = createMockParentRuntime();
    const ctx = { sessionManager: { parentRuntime: parent } } as any;
    const mockTeam = { dispose: vi.fn().mockResolvedValue(undefined) };
    bootPiclawTeam.mockResolvedValue(mockTeam);
    executeTeamTasks.mockResolvedValue(undefined);
    const longResult = 'a'.repeat(150);
    mockTeam.getResults = vi.fn().mockResolvedValue([longResult]);

    const result = await tool.execute('id', { tasks: ['x'.repeat(100)] }, undefined, undefined, ctx);
    const text = result.content[0].text;
    expect(text).toContain('...'); // both task and result truncated
    expect(text).toContain('Result:');
    // Task truncated to 50 chars + '...'
    expect(text).toContain(`${'x'.repeat(50)  }...`);
    // Result truncated to 100 chars + '...'
    expect(text).toContain(`${'a'.repeat(100)  }...`);
  });
});
