#!/usr/bin/env node

import { describe, it, expect, beforeEach } from 'vitest';
import { createTeamOpsTool } from '../../extensions/team/team-ops-tool.js';
import { AgentTeam } from '../../extensions/team/team-manager.js';

function createMockContext(sessionId: string) {
  return { session: { id: sessionId } };
}

describe('team-ops-tool', () => {
  let team: AgentTeam;
  let tool: any;

  beforeEach(() => {
    team = new AgentTeam();
    team.id = 'test-team';
    tool = createTeamOpsTool(team);
  });

  describe('task management', () => {
    it('should initialize team with tasks', async () => {
      await team.initialize(['Task 1', 'Task 2', 'Task 3']);
      expect(team.tasks).toHaveLength(3);
    });

    it('claim_task should assign pending task to agent', async () => {
      await team.initialize(['Task 1', 'Task 2']);
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'claim_task' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.taskIndex).toBe(0);
      expect(await team.getMyCurrentTask('agent-1')).toBe(0);
    });

    it('release_task should free assigned task', async () => {
      await team.initialize(['Task 1']);
      const ctx = createMockContext('agent-1');
      await tool.execute({ action: 'claim_task' }, ctx);
      const result = await tool.execute({ action: 'release_task' }, ctx);
      expect(result.isError).toBe(false);
      expect(await team.getMyCurrentTask('agent-1')).toBeNull();
    });

    it('complete_task should mark task as completed', async () => {
      await team.initialize(['Task 1']);
      const ctx = createMockContext('agent-1');
      await tool.execute({ action: 'claim_task' }, ctx);
      const result = await tool.execute({ action: 'complete_task', taskIndex: 0, result: 'All done' }, ctx);
      expect(result.isError).toBe(false);
      const status = await team.getTeamStatus();
      expect(status.tasks[0].status).toBe('completed');
    });
  });

  describe('workspace operations', () => {
    it('workspace_write should store key-value', async () => {
      const ctx = createMockContext('agent-1');
      await tool.execute({ action: 'workspace_write', key: 'config', value: 'data' }, ctx);
      expect(team.getWorkspace().get('config')).toBe('data');
    });

    it('workspace_read should return value', async () => {
      team.getWorkspace().set('x', '10', 'agent-1');
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'workspace_read', key: 'x' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('10');
    });
  });

  describe('messaging', () => {
    it('send_message should publish to channel', async () => {
      const ctx = createMockContext('agent-1');
      await tool.execute({ action: 'send_message', channel: 'team.chat', content: 'Hello' }, ctx);
      const messages = await team.getMessages('team.chat');
      expect(messages).toHaveLength(1);
    });

    it('get_messages should return messages', async () => {
      await team.publishMessage('team.chat', 'agent-1', 'A');
      await team.publishMessage('team.chat', 'agent-2', 'B');
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'get_messages' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.messages).toHaveLength(2);
    });
  });

  describe('status operations', () => {
    it('update_status should accept status', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'update_status', status: 'working' }, ctx);
      expect(result.isError).toBe(false);
    });

    it('get_team_status should return status', async () => {
      await team.initialize(['T1']);
      team.registerRuntime({ session: { id: 'agent-1' } } as any, 'agent-1');
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'get_team_status' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.totalTasks).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle unknown action', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'unknown' as any }, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe('schema', () => {
    it('should have correct tool definition', () => {
      expect(tool.name).toBe('team_ops');
      expect(tool.parameters.properties.action.enum).toContain('claim_task');
    });
  });
});
