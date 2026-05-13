/**
 * Unit tests for team-metrics.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TeamMetricsCollector, teamMetrics } from '../../team/team-metrics.js';

describe('TeamMetricsCollector', () => {
  let collector: TeamMetricsCollector;

  beforeEach(() => {
    collector = TeamMetricsCollector.getInstance();
    collector.reset();
  });

  describe('reset', () => {
    it('should reset all metrics to initial state', () => {
      collector.setTotalTasks(10);
      collector.recordTaskCompletion('agent-1', 5000);
      collector.recordMessageSent('agent-1', 'team.chat');
      collector.complete();

      collector.reset();

      const snapshot = collector.getSnapshot();
      expect(snapshot.totalTasks).toBe(0);
      expect(snapshot.completedTasks).toBe(0);
      expect(snapshot.taskCompletionTimes.length).toBe(0);
      expect(snapshot.agentStats.size).toBe(0);
    });
  });

  describe('task metrics', () => {
    it('should record task completion', () => {
      collector.setTotalTasks(5);
      collector.recordTaskCompletion('agent-1', 3000);

      const snapshot = collector.getSnapshot();
      expect(snapshot.completedTasks).toBe(1);
      expect(snapshot.taskCompletionTimes).toEqual([3000]);
    });

    it('should accumulate multiple completions', () => {
      collector.setTotalTasks(3);
      collector.recordTaskCompletion('agent-1', 2000);
      collector.recordTaskCompletion('agent-2', 3000);
      collector.recordTaskCompletion('agent-1', 1500);

      const snapshot = collector.getSnapshot();
      expect(snapshot.completedTasks).toBe(3);
      expect(snapshot.taskCompletionTimes).toEqual([2000, 3000, 1500]);
    });

    it('should record failed tasks', () => {
      collector.recordTaskFailed('agent-1');
      collector.recordTaskFailed('agent-2');

      const snapshot = collector.getSnapshot();
      expect(snapshot.failedTasks).toBe(2);
    });
  });

  describe('agent metrics', () => {
    it('should track per-agent stats', () => {
      collector.recordTaskCompletion('agent-1', 5000);
      collector.recordTaskCompletion('agent-1', 3000);
      collector.recordTaskFailed('agent-1');
      collector.recordMessageSent('agent-1', 'team.chat');
      collector.recordWorkspaceAccess('agent-1');
      collector.recordHelp('agent-1');

      const snapshot = collector.getSnapshot();
      const agent1 = snapshot.agentStats.get('agent-1');

      expect(agent1!.tasksCompleted).toBe(2);
      expect(agent1!.tasksFailed).toBe(1);
      expect(agent1!.totalWorkTime).toBe(8000);
      expect(agent1!.avgCompletionTime).toBe(4000);
      expect(agent1!.messagesSent).toBe(1);
      expect(agent1!.workspaceAccessCount).toBe(1);
      expect(agent1!.helpRequests).toBe(1);
    });

    it('should auto-create agent on first record', () => {
      collector.recordMessageSent('new-agent', 'team.help');

      const snapshot = collector.getSnapshot();
      expect(snapshot.agentStats.has('new-agent')).toBe(true);
    });
  });

  describe('messaging metrics', () => {
    it('should count sent and received messages', () => {
      collector.recordMessageSent('agent-1', 'team.chat');
      collector.recordMessageSent('agent-2', 'team.help');
      collector.recordMessageReceived('agent-3');

      const snapshot = collector.getSnapshot();
      expect(snapshot.messagesSent).toBe(2);
      expect(snapshot.messagesReceived).toBe(1);
    });

    it('should track channels used', () => {
      collector.recordMessageSent('agent-1', 'team.chat');
      collector.recordMessageSent('agent-2', 'team.help');
      collector.recordMessageSent('agent-1', 'team.notifications');

      const snapshot = collector.getSnapshot();
      expect(snapshot.channelsUsed.size).toBe(3);
      expect(snapshot.channelsUsed.has('team.chat')).toBe(true);
      expect(snapshot.channelsUsed.has('team.help')).toBe(true);
    });
  });

  describe('workspace metrics', () => {
    it('should count workspace operations', () => {
      collector.recordWorkspaceRead('agent-1');
      collector.recordWorkspaceRead('agent-2');
      collector.recordWorkspaceWrite('agent-1');
      collector.recordWorkspaceLock('agent-2');

      const snapshot = collector.getSnapshot();
      expect(snapshot.workspaceReads).toBe(2);
      expect(snapshot.workspaceWrites).toBe(1);
      expect(snapshot.workspaceLocks).toBe(1);
    });

    it('should count conflicts', () => {
      collector.recordWorkspaceConflict();
      collector.recordTaskConflict();

      const snapshot = collector.getSnapshot();
      expect(snapshot.workspaceConflicts).toBe(1);
      expect(snapshot.taskConflicts).toBe(1);
    });

    it('should track lock wait times', () => {
      collector.recordLockWaitTime(150);
      collector.recordLockWaitTime(200);
      collector.recordLockWaitTime(100);

      const snapshot = collector.getSnapshot();
      expect(snapshot.lockWaitTimes).toEqual([150, 200, 100]);
    });
  });

  describe('work stealing metrics', () => {
    it('should count theft attempts and successes', () => {
      collector.recordTheft(); // Failed steal
      collector.recordTheft();
      collector.recordSuccessfulSteal();
      collector.recordTheft();
      collector.recordSuccessfulSteal();
      collector.recordSuccessfulSteal();

      const snapshot = collector.getSnapshot();
      expect(snapshot.theftCount).toBe(3);
      expect(snapshot.successfulSteals).toBe(3);
    });
  });

  describe('help metrics', () => {
    it('should track help requests and times helped', () => {
      collector.recordHelp('agent-1'); // agent-1 requests help
      collector.recordHelp('agent-2');
      collector.recordTimesHelped('agent-3'); // agent-3 helps someone

      const snapshot = collector.getSnapshot();
      expect(snapshot.requestHelpCount).toBe(2);

      const agent2 = snapshot.agentStats.get('agent-2');
      expect(agent2!.helpRequests).toBe(1);

      const agent3 = snapshot.agentStats.get('agent-3');
      expect(agent3!.timesHelped).toBe(1);
    });
  });

  describe('complete', () => {
    it('should set endTime', () => {
      expect(collector.getSnapshot().endTime).toBeUndefined();

      collector.complete();

      const snapshot = collector.getSnapshot();
      expect(snapshot.endTime).toBeDefined();
      expect(snapshot.endTime).toBeGreaterThan(snapshot.startTime);
    });
  });

  describe('getSnapshot', () => {
    it('should return frozen snapshot', () => {
      collector.setTotalTasks(5);
      const snapshot1 = collector.getSnapshot();

      // Modify original
      collector.setTotalTasks(10);

      const snapshot2 = collector.getSnapshot();
      expect(snapshot1.totalTasks).toBe(5);
      expect(snapshot2.totalTasks).toBe(10);
    });

    it('should deep clone Maps and Sets', () => {
      collector.recordMessageSent('agent-1', 'team.chat');
      const snapshot1 = collector.getSnapshot();

      // Modify original
      collector.recordMessageSent('agent-2', 'team.help');

      const snapshot2 = collector.getSnapshot();
      expect(snapshot1.channelsUsed.size).toBe(1);
      expect(snapshot2.channelsUsed.size).toBe(2);
    });
  });

  describe('toJSON', () => {
    it('should export metrics as plain JSON object', () => {
      collector.setTotalTasks(5);
      collector.recordTaskCompletion('agent-1', 3000);
      collector.recordMessageSent('agent-1', 'team.chat');
      collector.complete();

      const json = collector.toJSON();

      expect(json).toHaveProperty('startTime');
      expect(json).toHaveProperty('endTime');
      expect(json).toHaveProperty('duration');
      expect(json).toHaveProperty('tasks');
      expect(json).toHaveProperty('agents');
      expect(json).toHaveProperty('collaboration');
      expect(json).toHaveProperty('messaging');

      expect(json.tasks.total).toBe(5);
      expect(json.tasks.completed).toBe(1);
      expect(json.messaging.totalSent).toBe(1);
    });

    it('should compute average completion time', () => {
      collector.recordTaskCompletion('agent-1', 2000);
      collector.recordTaskCompletion('agent-1', 4000);

      const json = collector.toJSON();
      expect(json.tasks.avgTaskCompletionTime).toBe(3000);
    });

    it('should handle no data gracefully', () => {
      const json = collector.toJSON();
      expect(json.tasks.avgTaskCompletionTime).toBe(0);
    });
  });

  describe('generateSummary', () => {
    it('should generate human-readable summary', () => {
      collector.setTotalTasks(10);
      collector.recordTaskCompletion('agent-1', 5000);
      collector.recordTaskCompletion('agent-2', 3000);
      collector.complete();

      const summary = collector.generateSummary();

      expect(summary).toContain('Team Metrics Report');
      expect(summary).toContain('Duration');
      expect(summary).toContain('agent-1');
      expect(summary).toContain('agent-2');
    });
  });

  describe('singleton behavior', () => {
    it('should return same instance', () => {
      const instance1 = TeamMetricsCollector.getInstance();
      const instance2 = TeamMetricsCollector.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should share state across instances', () => {
      const instance1 = TeamMetricsCollector.getInstance();
      const instance2 = TeamMetricsCollector.getInstance();

      instance1.recordTaskCompletion('agent-1', 1000);
      const snapshot2 = instance2.getSnapshot();

      expect(snapshot2.completedTasks).toBe(1);
    });
  });
});

describe('teamMetrics convenience wrapper', () => {
  beforeEach(() => {
    teamMetrics.reset();
  });

  it('should provide same API as collector', () => {
    teamMetrics.setTotalTasks(5);
    teamMetrics.recordTaskEnd('agent-1', 0, Date.now(), true);
    teamMetrics.recordMessage('sent', 'agent-1', 'team.chat');
    teamMetrics.recordWorkspaceOp('read', 'agent-1');
    teamMetrics.recordSteal();
    teamMetrics.recordHelp('agent-1');

    const snapshot = teamMetrics.getJSON();
    expect(snapshot.tasks.total).toBe(5);
    expect(snapshot.collaboration.theftCount).toBe(1);
    expect(snapshot.agents[0].messagesSent).toBe(1);
  });

  it('should support getSummary', () => {
    teamMetrics.setTotalTasks(2);
    teamMetrics.complete();

    const summary = teamMetrics.getSummary();
    expect(typeof summary).toBe('string');
    expect(summary).toContain('Team Metrics Report');
  });
});
