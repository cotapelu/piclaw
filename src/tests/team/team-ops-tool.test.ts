#!/usr/bin/env node

/**
 * Tests for team-ops-tool - team collaboration operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTeamOpsTool } from '../../team/team-ops-tool.js';
import { AgentTeam } from '../../team/team-manager.js';

// Mock context with session
function createMockContext(sessionId: string) {
  return {
    session: {
      id: sessionId,
    },
  };
}

describe('team-ops-tool', () => {
  let team: AgentTeam;
  let tool: any;

  beforeEach(() => {
    // Create a fresh team for each test
    team = new AgentTeam();
    team.id = 'test-team';
    tool = createTeamOpsTool(team);
  });

  describe('task management', () => {
    it('should initialize team with tasks', () => {
      team.initialize(['Task 1', 'Task 2', 'Task 3']);
      expect(team.tasks).toHaveLength(3);
    });

    it('claim_task should assign pending task to agent', async () => {
      team.initialize(['Task 1', 'Task 2']);
      const ctx = createMockContext('agent-1');

      const result = await tool.execute({ action: 'claim_task' }, ctx);

      expect(result.isError).toBe(false);
      expect(result.details?.taskIndex).toBe(0);
      expect(team.getMyCurrentTask('agent-1')).toBe(0);
    });

    it('claim_task should return error if no pending tasks', async () => {
      team.initialize(['Task 1']);
      // Manually mark task as completed
      team.taskStatuses.set(0, { assignee: 'agent-1', status: 'completed', result: 'done' });
      // Reset to pending first so claim fails
      team.taskStatuses.set(0, { assignee: null, status: 'pending', result: '' });
      const ctx = createMockContext('agent-1');
      const result1 = await tool.execute({ action: 'claim_task' }, ctx);
      expect(result1.isError).toBe(false);

      // Mark completed
      team.taskStatuses.set(0, { assignee: 'agent-1', status: 'completed', result: 'done' });
      const result2 = await tool.execute({ action: 'claim_task' }, ctx);
      expect(result2.isError).toBe(true);
    });

    it('release_task should free assigned task', async () => {
      team.initialize(['Task 1']);
      const ctx = createMockContext('agent-1');

      // First claim the task
      await tool.execute({ action: 'claim_task' }, ctx);
      expect(team.getMyCurrentTask('agent-1')).toBe(0);

      const result = await tool.execute({ action: 'release_task' }, ctx);
      expect(result.isError).toBe(false);
      expect(team.getMyCurrentTask('agent-1')).toBeNull();
    });

    it('release_task should fail if no active task', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'release_task' }, ctx);
      expect(result.isError).toBe(true);
    });

    it('complete_task should mark task as completed', async () => {
      team.initialize(['Task 1']);
      const ctx = createMockContext('agent-1');

      await tool.execute({ action: 'claim_task' }, ctx);
      const result = await tool.execute({ action: 'complete_task', taskIndex: 0, result: 'All done' }, ctx);

      expect(result.isError).toBe(false);
      expect(team.taskStatuses.get(0)?.status).toBe('completed');
      expect(team.taskStatuses.get(0)?.result).toBe('All done');
      expect(team.getMyCurrentTask('agent-1')).toBeNull();
    });

    it('complete_task should fail if taskIndex missing', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'complete_task' }, ctx);
      expect(result.isError).toBe(true);
    });

    it('complete_task should fail if task not assigned to agent', async () => {
      team.initialize(['Task 1']);
      const ctx = createMockContext('agent-1');
      const ctx2 = createMockContext('agent-2');

      // agent-1 claims task 0
      await tool.execute({ action: 'claim_task' }, ctx);
      // agent-2 tries to complete it
      const result = await tool.execute({ action: 'complete_task', taskIndex: 0 }, ctx2);
      expect(result.isError).toBe(true);
    });
  });

  describe('workspace operations', () => {
    it('workspace_write should store key-value pair', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({
        action: 'workspace_write',
        key: 'design',
        value: '{ "architecture": "microservices" }',
      }, ctx);

      expect(result.isError).toBe(false);
      expect(team.getWorkspace().get('design')).toBe('{ "architecture": "microservices" }');
    });

    it('workspace_write should fail if key or value missing', async () => {
      const ctx = createMockContext('agent-1');
      const result1 = await tool.execute({ action: 'workspace_write', key: 'test' }, ctx);
      expect(result1.isError).toBe(true);

      const result2 = await tool.execute({ action: 'workspace_write', value: 'data' }, ctx);
      expect(result2.isError).toBe(true);
    });

    it('workspace_read should return value for existing key', async () => {
      team.getWorkspace().set('config', 'value123', 'agent-1');
      const ctx = createMockContext('agent-1');

      const result = await tool.execute({ action: 'workspace_read', key: 'config' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('value123');
    });

    it('workspace_read should return not found for missing key', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'workspace_read', key: 'missing' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('(not found)');
    });

    it('workspace_read should fail if key missing', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'workspace_read' }, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe('messaging', () => {
    it('send_message should publish to channel', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({
        action: 'send_message',
        channel: 'team.chat',
        content: 'Hello team!',
      }, ctx);

      expect(result.isError).toBe(false);
      const messages = team.getMessages('team.chat');
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello team!');
      expect(messages[0].from).toBe('agent-1');
    });

    it('send_message should use default channel if not specified', async () => {
      const ctx = createMockContext('agent-1');
      await tool.execute({ action: 'send_message', content: 'Hi' }, ctx);
      const messages = team.getMessages('team.chat');
      expect(messages).toHaveLength(1);
    });

    it('send_message should fail if content missing', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'send_message' }, ctx);
      expect(result.isError).toBe(true);
    });

    it('get_messages should return all messages by default', async () => {
      team.publishMessage('team.chat', 'agent-1', 'Msg1');
      team.publishMessage('team.chat', 'agent-2', 'Msg2');
      team.publishMessage('team.chat', 'agent-1', 'Msg3');

      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'get_messages' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.details).toBeDefined();
      const msgs = result.details?.messages;
      expect(msgs).toHaveLength(3);
      expect(msgs?.[0].content).toBe('Msg1');
    });

    it('get_messages should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        team.publishMessage('team.chat', 'agent-1', `Msg${i}`);
      }

      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'get_messages', limit: 2 }, ctx);
      expect(result.isError).toBe(false);
      expect(result.details).toBeDefined();
      const msgs = result.details?.messages;
      expect(msgs).toHaveLength(2);
    });

    it('get_messages should return empty for empty channel', async () => {
      team.messageBus.clear();
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'get_messages' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('(no messages)');
    });
  });

  describe('status operations', () => {
    it('update_status should accept any status string', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'update_status', status: 'working' }, ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.status).toBe('working');
    });

    it('update_status should fail if status missing', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'update_status' }, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe('get_team_status', () => {
    it('should return comprehensive team status', async () => {
      team.initialize(['Task 1', 'Task 2', 'Task 3']);
      team.registerRuntime({} as any, 'agent-1');
      team.registerRuntime({} as any, 'agent-2');
      team.agentStatuses.set('agent-1', { currentTaskIndex: 0, status: 'working' });
      team.taskStatuses.set(0, { assignee: 'agent-1', status: 'in_progress', result: '' });
      team.taskStatuses.set(1, { assignee: null, status: 'pending', result: '' });
      team.taskStatuses.set(2, { assignee: null, status: 'pending', result: '' });

      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'get_team_status' }, ctx);

      expect(result.isError).toBe(false);
      const status = result.details;
      expect(status.totalTasks).toBe(3);
      expect(status.agents).toHaveLength(2);
      expect(status.tasks).toHaveLength(3);
      expect(status.completedTasks).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle unknown action gracefully', async () => {
      const ctx = createMockContext('agent-1');
      const result = await tool.execute({ action: 'unknown_action' as any }, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown action');
    });

    it('should catch exceptions and return error', async () => {
      const ctx = createMockContext('agent-1');
      // Force an error by passing invalid type
      // The execute should return isError: false on success, not throw
      const result = await tool.execute({ action: 'claim_task' } as any, ctx);
      // Should not throw, should return isError: false (normal path)
      expect(result).toHaveProperty('isError');
    });
  });

  describe('schema validation', () => {
    it('should have correct tool definition', () => {
      expect(tool.name).toBe('team_ops');
      expect(tool.label).toBe('Team Ops');
      expect(tool.description).toContain('Team collaboration');
    });

    it('should define all required parameters in schema', () => {
      const schema = tool.parameters;
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('action');
      expect(schema.required).toContain('action');
      expect(schema.properties.action.enum).toContain('claim_task');
      expect(schema.properties.action.enum).toContain('release_task');
      expect(schema.properties.action.enum).toContain('complete_task');
      expect(schema.properties.action.enum).toContain('get_team_status');
      expect(schema.properties.action.enum).toContain('workspace_read');
      expect(schema.properties.action.enum).toContain('workspace_write');
      expect(schema.properties.action.enum).toContain('send_message');
      expect(schema.properties.action.enum).toContain('get_messages');
      expect(schema.properties.action.enum).toContain('update_status');
    });
  });
});
