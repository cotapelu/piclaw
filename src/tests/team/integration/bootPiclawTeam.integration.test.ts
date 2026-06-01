/**
 * Integration tests for team creation and lifecycle (bootPiclawTeam)
 */

import { describe, it, expect } from 'vitest';
import { bootPiclaw } from '../../../piclaw-core.js';
import { bootPiclawTeam } from '../../../extensions/team/team-manager.js';

describe('Team Creation & Initialization (bootPiclawTeam)', () => {
  describe('team creation', () => {
    it('should create team with correct size', async () => {
      const parent = await bootPiclaw();
      const team = await bootPiclawTeam(parent, { teamSize: 3 });

      expect(team.size).toBe(4); // roles count: parent + 3 children
      expect(team.runtimes.length).toBe(3); // only child agents
      expect(team.roles).toEqual(['parent', 'agent-1', 'agent-2', 'agent-3']);

      await team.dispose();
      await parent.dispose();
    });

    it('should create team with custom roles', async () => {
      const parent = await bootPiclaw();
      const team = await bootPiclawTeam(parent, { teamSize: 2, teamRoles: ['dev', 'reviewer'] });

      expect(team.roles).toEqual(['parent', 'dev', 'reviewer']);
      expect(team.size).toBe(3);
      expect(team.runtimes.length).toBe(2);

      await team.dispose();
      await parent.dispose();
    });

    it('should enforce max team size (4)', async () => {
      const parent = await bootPiclaw();
      const team = await bootPiclawTeam(parent, { teamSize: 10 });

      // max team size is 4 children (plus parent makes 5 roles)
      expect(team.size).toBe(5);
      expect(team.roles).toEqual(['parent', 'agent-1', 'agent-2', 'agent-3', 'agent-4']);
      expect(team.runtimes.length).toBe(4);

      await team.dispose();
      await parent.dispose();
    });

    it('should generate unique team IDs', async () => {
      const parent = await bootPiclaw();
      const team1 = await bootPiclawTeam(parent, { teamSize: 1 });
      const team2 = await bootPiclawTeam(parent, { teamSize: 1 });

      expect(team1.id).not.toBe(team2.id);

      await team1.dispose();
      await team2.dispose();
      await parent.dispose();
    });
  });



  describe('team operations', () => {
    it('should initialize tasks and report status', async () => {
      const parent = await bootPiclaw();
      const team = await bootPiclawTeam(parent, { teamSize: 1 });
      const tasks = ['Task A', 'Task B', 'Task C'];
      await team.initialize(tasks);

      const status = await team.getTeamStatus();
      expect(status.totalTasks).toBe(3);
      expect(status.completedTasks).toBe(0);
      expect(status.tasks.map(t => t.status)).toEqual(['pending', 'pending', 'pending']);

      await team.dispose();
      await parent.dispose();
    });

    it('should claim and complete tasks', async () => {
      const parent = await bootPiclaw();
      const team = await bootPiclawTeam(parent, { teamSize: 1 });
      const tasks = ['Task X', 'Task Y'];
      await team.initialize(tasks);

      // Claim a task
      const idx = await team.claimTask('agent-1');
      expect(idx).toBe(0);
      let status = await team.getTeamStatus();
      expect(status.tasks[0].status).toBe('in_progress');
      expect(status.tasks[0].assignee).toBe('agent-1');

      // Complete the task
      await team.reportResult(idx, 'done');
      status = await team.getTeamStatus();
      expect(status.tasks[0].status).toBe('completed');
      expect(status.completedTasks).toBe(1);

      // Claim next
      const idx2 = await team.claimTask('agent-1');
      expect(idx2).toBe(1);
      await team.reportResult(idx2, 'done');
      status = await team.getTeamStatus();
      expect(status.completedTasks).toBe(2);
      expect(status.isComplete).toBe(true);

      await team.dispose();
      await parent.dispose();
    });
  });
});
