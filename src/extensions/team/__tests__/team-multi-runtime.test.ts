// @ts-nocheck
import { jest } from '@jest/globals';
import { AgentTeam } from '../team-manager.js';
import type { AgentSessionRuntime, AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let counter = 0;

// Simple mock runtime factory - returns plain objects, no recursion
function createSimpleRuntime(role: string): Partial<AgentSessionRuntime> {
  const id = `session-${role}-${counter++}`;
  const tmpAgentDir = path.join(os.tmpdir(), `evo-test-${role}-${Date.now()}`);
  try { fs.mkdirSync(tmpAgentDir, { recursive: true }); } catch (e) {}
  return {
    session: { 
      sessionId: id, 
      subscribe: jest.fn().mockReturnValue(() => {})
    },
    services: {
      agentDir: tmpAgentDir,
      cwd: process.cwd(),
      diagnostics: [],
      authStorage: {} as any,
      settingsManager: {} as any,
      modelRegistry: {} as any
    },
    cwd: process.cwd(),
    setRebindSession: jest.fn(),
    setBeforeSessionInvalidate: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
    createRuntime: jest.fn() as any
  };
}

function createMockAgentSessionEvent(type: string, message?: any): AgentSessionEvent {
  return {
    type: type as any,
    ...(message && { message })
  } as AgentSessionEvent;
}

describe('AgentTeam Multi-Runtime', () => {
  let team: AgentTeam;
  let parentRuntime: AgentSessionRuntime;
  let notifyUpdateSpy: jest.SpyInstance;

  function setRoles(team: AgentTeam, count: number) {
    const roles = Array.from({ length: count }, (_, i) => `agent-${i + 1}`);
    team.roles = roles;
    for (const role of roles) {
      team.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
    }
    team.size = roles.length;
  }

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test-team');
    parentRuntime = createSimpleRuntime('parent') as AgentSessionRuntime;
    // Configure parent's createRuntime to return a fresh child runtime each call
    parentRuntime.createRuntime = jest.fn().mockImplementation(async (options: any) => {
      return createSimpleRuntime('child') as AgentSessionRuntime;
    });
    notifyUpdateSpy = jest.spyOn(team, 'notifyUpdate');
  });

  afterEach(async () => {
    await team.dispose();
    if (notifyUpdateSpy && notifyUpdateSpy.mockRestore) {
      notifyUpdateSpy.mockRestore();
    }
  });

  describe('setupChildRuntimes', () => {
    it('should create correct number of child runtimes (teamSize=4)', async () => {
      setRoles(team, 4);
      await team.initialize(['task1', 'task2']);
      await (team as any).setupChildRuntimes(parentRuntime);

      // runtimes array should contain all 4 child runtimes
      expect((team as any).runtimes.length).toBe(4);
      // All roles are present
      expect(team.roles).toEqual(['agent-1', 'agent-2', 'agent-3', 'agent-4']);
      // Each runtime should map to a role
      for (const role of team.roles) {
        const runtime = (team as any).runtimes.find((r: any) => (team as any).roleByAgentId.get(r.session.sessionId) === role);
        expect(runtime).toBeDefined();
      }
    });

    it('should create child runtimes with custom agentCwd', async () => {
      setRoles(team, 2);
      await team.initialize(['task1']);
      await (team as any).setupChildRuntimes(parentRuntime, '/custom/agent/cwd');

      const createCalls = (parentRuntime.createRuntime as jest.Mock).mock.calls;
      expect(createCalls.length).toBe(2);
      // The second argument of the call is the options object
      const [, firstOpts] = createCalls[0];
      expect(firstOpts.cwd).toBe('/custom/agent/cwd');
    });

    it('should use parent cwd when agentCwd not provided', async () => {
      setRoles(team, 2);
      await team.initialize(['task1']);
      await (team as any).setupChildRuntimes(parentRuntime);

      const createCalls = (parentRuntime.createRuntime as jest.Mock).mock.calls;
      expect(createCalls.length).toBe(2);
      const [, firstOpts] = createCalls[0];
      expect(firstOpts.cwd).toBe(parentRuntime.cwd);
    });

    it('should create isolated session directories for each agent', async () => {
      setRoles(team, 2);
      await team.initialize(['task1']);
      await (team as any).setupChildRuntimes(parentRuntime);

      const createCalls = (parentRuntime.createRuntime as jest.Mock).mock.calls;
      // agentDir should be unique per agent: teams/<team-id>/<role>
      const [, firstOpts] = createCalls[0];
      const [, secondOpts] = createCalls[1];
      const firstAgentDir = firstOpts.agentDir as string;
      const secondAgentDir = secondOpts.agentDir as string;
      expect(firstAgentDir).toContain(`teams${path.sep}test-team${path.sep}agent-1`);
      expect(secondAgentDir).toContain(`teams${path.sep}test-team${path.sep}agent-2`);
      expect(firstAgentDir).not.toBe(secondAgentDir);
    });

    it('should subscribe to child session events', async () => {
      setRoles(team, 1);
      await team.initialize(['task1']);
      await (team as any).setupChildRuntimes(parentRuntime);

      const childRuntime = (team as any).runtimes[0];
      const subscribe = childRuntime.session.subscribe as jest.Mock;
      expect(subscribe).toHaveBeenCalled();
      const handler = subscribe.mock.calls[0][0];
      expect(typeof handler).toBe('function');
    });

    it('should map role to runtime session.id', async () => {
      setRoles(team, 3);
      await team.initialize(['task1']);
      await (team as any).setupChildRuntimes(parentRuntime);

      // Every runtime.session.sessionId should map to a role
      const teamAny = team as any;
      for (const rt of teamAny.runtimes) {
        const role = teamAny.roleByAgentId.get(rt.session.sessionId);
        expect(role).toBeDefined();
        expect(team.roles).toContain(role);
      }
    });
  });

  describe('handleAgentEvent', () => {
    let childRuntime: AgentSessionRuntime;

    beforeEach(async () => {
      setRoles(team, 1);
      await team.initialize(['task1']);
      await (team as any).setupChildRuntimes(parentRuntime);
      // Clear notification history after initialization
      notifyUpdateSpy.mockClear();
      childRuntime = (team as any).runtimes[0];
    });

    it('should forward agent_start event with role prefix', async () => {
      const teamAny = team as any;
      teamAny.handleAgentEvent('agent-1', { type: 'agent_start' });

      expect(notifyUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [expect.objectContaining({ text: expect.stringContaining('[agent-1]') })],
          details: expect.objectContaining({ role: 'agent-1', eventType: 'agent_start' })
        })
      );
    });

    it('should forward agent_end event with error flag', async () => {
      const teamAny = team as any;
      teamAny.handleAgentEvent('agent-1', { type: 'agent_end', stopReason: 'error' });

      expect(notifyUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [expect.objectContaining({ text: expect.stringContaining('[agent-1]') })],
          isError: true
        })
      );
    });

    it('should forward message_start with correct content truncation', async () => {
      const teamAny = team as any;
      const longText = 'a'.repeat(300);
      teamAny.handleAgentEvent('agent-1', {
        type: 'message_start',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: longText }]
        }
      });

      expect(notifyUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [expect.objectContaining({ text: expect.stringMatching(/\[agent-1\] Assistant: .{200}/) })],
          details: expect.objectContaining({ role: 'agent-1', eventType: 'message_start' })
        })
      );
    });

    it('should ignore message_update events (streaming)', async () => {
      const subscribe = childRuntime.session.subscribe as jest.Mock;
      const handler = subscribe.mock.calls[0][0];
      await handler({ type: 'message_update' });

      // Should not call notifyUpdate for streaming updates
      expect(notifyUpdateSpy).not.toHaveBeenCalled();
    });

    it('should handle unknown event types gracefully', async () => {
      const subscribe = childRuntime.session.subscribe as jest.Mock;
      const handler = subscribe.mock.calls[0][0];
      await handler({ type: 'unknown_event' } as any);

      expect(notifyUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('agent loop integration', () => {
    it('should create runtimes (loops started separately)', async () => {
      setRoles(team, 2);
      await team.initialize(['task1']);
      await (team as any).setupChildRuntimes(parentRuntime);

      // runtimes should be created
      expect((team as any).runtimes.length).toBe(2);
    });

    it('should dispose child runtimes on team.dispose', async () => {
      setRoles(team, 1);
      await team.initialize(['task1']);
      await (team as any).setupChildRuntimes(parentRuntime);

      // Capture runtime before dispose
      const childRuntimes = (team as any).runtimes as any[];
      expect(childRuntimes.length).toBeGreaterThan(0);
      const childRuntime = childRuntimes[0];

      await team.dispose();

      // Verify child runtime dispose called
      expect(childRuntime.dispose).toHaveBeenCalled();
    });
  });

  describe('concurrent event forwarding', () => {
    it('should handle multiple events from different agents concurrently', async () => {
      setRoles(team, 2);
      await team.initialize(['task1', 'task2']);
      await (team as any).setupChildRuntimes(parentRuntime);
      // Clear any notifications from initialization
      notifyUpdateSpy.mockClear();

      const [rt1, rt2] = (team as any).runtimes;
      const handler1 = rt1.session.subscribe.mock.calls[0][0];
      const handler2 = rt2.session.subscribe.mock.calls[0][0];

      // Forward events concurrently
      await Promise.all([
        handler1({ type: 'agent_start' }),
        handler2({ type: 'agent_start' })
      ]);

      // Both should have been called with correct roles
      expect(notifyUpdateSpy).toHaveBeenCalledTimes(2);
      const calls = notifyUpdateSpy.mock.calls;
      const roles = calls.map((call: any) => call[0].details.role);
      expect(roles).toContain('agent-1');
      expect(roles).toContain('agent-2');
    });
  });
});
