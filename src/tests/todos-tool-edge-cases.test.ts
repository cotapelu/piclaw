import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeParams, applyOp, getLatestTodoPhasesFromEntries, TodoState, formatSummary, registerTodosTool } from '../extensions/tools/todos-tool.js';
import { existsSync, mkdirSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

describe('TodosTool Edge Cases', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join('/tmp', 'todos-test-' + Date.now());
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('normalizeParams', () => {
    it('should throw on invalid JSON string', () => {
      expect(() => normalizeParams('{invalid}')).toThrow('Invalid JSON string');
    });
    it('should throw when add_phase string is invalid JSON', () => {
      expect(() => normalizeParams({ add_phase: '{invalid}' })).toThrow('add_phase must be an object');
    });
    it('should throw when delete string is invalid JSON', () => {
      expect(() => normalizeParams({ delete: '{invalid}' })).toThrow('delete must be an object');
    });
  });

  describe('applyOp', () => {
    it('should return error when no operation specified', () => {
      const result = applyOp([], 1, 1, {});
      expect(result.errors).toContain('No operation specified');
    });

    it('should error when add_phase name is empty', () => {
      const result = applyOp([], 1, 1, { add_phase: { name: '' } });
      expect(result.errors).toContain('add_phase.name must be a string (not an object or array)');
      expect(result.phases.length).toBe(0);
    });

    it('should error add_task when phase not found', () => {
      const result = applyOp([], 1, 1, { add_task: { phase: 'phase-1', content: 'task' } });
      expect(result.errors).toContain('Phase "phase-1" not found');
    });

    it('should error remove_task when task id not found', () => {
      const phases = [{ id: 'phase-1', name: 'P', tasks: [] }];
      const result = applyOp(phases, 1, 1, { remove_task: { id: 'task-999' } });
      expect(result.errors).toContain('Task "task-999" not found');
    });

    it('should clear all phases when delete specified', () => {
      const phases = [{ id: 'phase-1', name: 'P', tasks: [{ id: 't1', content: 'c', status: 'pending' }] }];
      const result = applyOp(phases, 1, 1, { delete: true });
      expect(result.phases.length).toBe(0);
    });

    it('should list phases and return them unchanged', () => {
      const phases = [{ id: 'phase-1', name: 'P', tasks: [{ id: 't1', content: 'c', status: 'pending' }] }];
      const result = applyOp(phases, 1, 1, { list: true });
      expect(result.phases.length).toBe(1);
    });

    it('should error update with invalid status', () => {
      const phases = [{ id: 'phase-1', name: 'P', tasks: [{ id: 't1', content: 'c', status: 'pending' }] }];
      const result = applyOp(phases, 1, 1, { update: { id: 't1', status: 'invalid' } });
      expect(result.errors[0]).toContain('Invalid status: invalid');
    });

    it('should update task content successfully', () => {
      const phases = [{ id: 'phase-1', name: 'P', tasks: [{ id: 't1', content: 'c', status: 'pending' }] }];
      const result = applyOp(phases, 1, 1, { update: { id: 't1', content: 'new content' } });
      expect(result.errors).toHaveLength(0);
      expect(result.phases[0].tasks[0].content).toBe('new content');
    });

    // Additional applyOp coverage tests
    it('should handle batch update with ids array', () => {
      const phases = [{ id: 'phase-1', name: 'P', tasks: [
        { id: 't1', content: 'c', status: 'pending' },
        { id: 't2', content: 'c2', status: 'pending' }
      ] }];
      const result = applyOp(phases, 1, 1, { update: { ids: ['t1','t2'], status: 'completed' } });
      expect(result.errors).toHaveLength(0);
      expect(result.phases[0].tasks[0].status).toBe('completed');
      expect(result.phases[0].tasks[1].status).toBe('completed');
    });

    it('should error when update matches no tasks', () => {
      const phases = [{ id: 'phase-1', name: 'P', tasks: [{ id: 't1', content: 'c' }] }];
      const result = applyOp(phases, 1, 1, { update: { ids: ['nonexistent'], status: 'completed' } });
      expect(result.errors).toContain('No valid tasks found to update');
    });

    it('should remove task successfully', () => {
      const phases = [{ id: 'phase-1', name: 'P', tasks: [{ id: 't1', content: 'c' }] }];
      const result = applyOp(phases, 1, 1, { remove_task: { id: 't1' } });
      expect(result.errors).toHaveLength(0);
      expect(result.phases[0].tasks).toHaveLength(0);
    });
  });

  describe('TodoState', () => {
    it('should load from file and return false if not exists', async () => {
      const state = new TodoState();
      const loaded = await state.loadFromFile(tmpDir);
      expect(loaded).toBe(false);
    });

    it('should save and load successfully', async () => {
      const state = new TodoState();
      state.addPhase('Phase 1', [{ content: 'Task 1' }]);
      await state.saveToFile(tmpDir);
      const state2 = new TodoState();
      const loaded = await state2.loadFromFile(tmpDir);
      expect(loaded).toBe(true);
      expect(state2.phases.length).toBe(1);
      expect(state2.phases[0].tasks.length).toBe(1);
    });

    it('should handle file write errors gracefully', async () => {
      const state = new TodoState();
      state.addPhase('Phase 1');
      const writeFileSpy = vi.spyOn(require('node:fs').promises, 'writeFile').mockRejectedValue(new Error('disk full'));
      await expect(state.saveToFile(tmpDir)).rejects.toThrow('disk full');
    });

    it('should reconstruct from valid entries', () => {
      const state = new TodoState();
      const phases = [
        { id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 't1', status: 'pending' }] },
      ];
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases }, isError: false } },
      ];
      const found = state.reconstructFromEntries(entries);
      expect(found).toBe(true);
      expect(state.phases.length).toBe(1);
    });

    it('should not reconstruct from entries without details', () => {
      const state = new TodoState();
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'todos' } }, // no details
      ];
      const found = state.reconstructFromEntries(entries);
      expect(found).toBe(false);
    });
  });

  describe('getLatestTodoPhasesFromEntries', () => {
    it('should return empty when no toolResult entries', () => {
      const entries = [
        { type: 'message', message: { role: 'user', content: 'hi' } },
      ];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });

    it('should extract phases from non-error toolResult', () => {
      const phases = [{ id: 'p1', name: 'P', tasks: [] }];
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases }, isError: false } },
      ];
      const result = getLatestTodoPhasesFromEntries(entries);
      expect(result).toEqual(phases);
    });

    it('should skip error entries', () => {
      const phases = [{ id: 'p1', name: 'P', tasks: [] }];
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases }, isError: true } },
      ];
      const result = getLatestTodoPhasesFromEntries(entries);
      expect(result).toEqual([]);
    });
  });

  describe('formatSummary', () => {
    it('should handle empty phases and errors', () => {
      const summary = formatSummary([], ['Error: something']);
      expect(summary).toContain('Errors: Error: something');
    });

    it('should show remaining tasks correctly', () => {
      const phases = [
        { id: 'phase-1', name: 'P1', tasks: [{ id: 't1', content: 'c1', status: 'pending' }] },
      ];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('remaining');
      expect(summary).toContain('t1');
    });

    it('should show Todo list cleared. when phases empty', () => {
      const summary = formatSummary([], []);
      expect(summary).toBe('Todo list cleared.');
    });
  });

  describe('TodosTool execute integration', () => {
    let capturedTool: any;
    let api: any;
    let tool: any;
    let cwd: string;
    let ctx: any;

    beforeEach(() => {
      cwd = join('/tmp', 'todos-exec-' + Date.now());
      mkdirSync(cwd, { recursive: true });
      ctx = { cwd } as any;
      capturedTool = undefined as any;
      api = {
        registerTool: vi.fn((t: any) => { capturedTool = t; }),
        sendMessage: vi.fn(() => Promise.resolve()),
        on: vi.fn(),
      };
      registerTodosTool(api);
      tool = capturedTool;
    });

    afterEach(() => {
      if (existsSync(cwd)) rmSync(cwd, { recursive: true, force: true });
    });

    it('should add a phase and see it in details', async () => {
      const result = await tool.execute('call1', { add_phase: { name: 'Phase1' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.phases).toHaveLength(1);
      expect(result.details.phases[0].name).toBe('Phase1');
      // No tasks yet => summary says cleared
      expect(result.content[0].text).toBe('Todo list cleared.');
      expect(existsSync(join(cwd, '.piclaw', 'agent', 'todos.json'))).toBe(true);
      expect(api.sendMessage).toHaveBeenCalled();
    });

    it('should add a task to a phase by name', async () => {
      // Create phase
      await tool.execute('create1', { add_phase: { name: 'Phase1' } }, undefined, undefined, ctx);
      // Add task
      const result = await tool.execute('addtask1', { add_task: { phase: 'Phase1', content: 'Task1' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.phases[0].tasks).toHaveLength(1);
      expect(result.details.phases[0].tasks[0].content).toBe('Task1');
      expect(result.content[0].text).toContain('Task1');
      expect(result.content[0].text).toContain('remaining');
    });

    it('should clear all phases on delete', async () => {
      // Add phase with task
      await tool.execute('ph1', { add_phase: { name: 'Phase1', tasks: [{ content: 'Task1' }] } }, undefined, undefined, ctx);
      // Delete
      const result = await tool.execute('del', { delete: true }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.phases).toEqual([]);
      expect(result.content[0].text).toBe('Todo list cleared.');
    });

    it('should list phases', async () => {
      await tool.execute('addlist', { add_phase: { name: 'PhaseL', tasks: [{ content: 'TaskL' }] } }, undefined, undefined, ctx);
      const result = await tool.execute('listop', { list: true }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.phases).toHaveLength(1);
      expect(result.details.phases[0].name).toBe('PhaseL');
    });

    it('should update task status', async () => {
      const addResult = await tool.execute('addu', { add_phase: { name: 'PhaseU', tasks: [{ content: 'TaskU' }] } }, undefined, undefined, ctx);
      const taskId = addResult.details.phases[0].tasks[0].id;
      const updateResult = await tool.execute('upd', { update: { id: taskId, status: 'completed' } }, undefined, undefined, ctx);
      expect(updateResult.isError).toBe(false);
      expect(updateResult.details.phases[0].tasks[0].status).toBe('completed');
    });

    it('should remove a task', async () => {
      const addResult = await tool.execute('addr', { add_phase: { name: 'PhaseR', tasks: [{ content: 'TaskR' }] } }, undefined, undefined, ctx);
      const taskId = addResult.details.phases[0].tasks[0].id;
      const removeResult = await tool.execute('rem', { remove_task: { id: taskId } }, undefined, undefined, ctx);
      expect(removeResult.isError).toBe(false);
      expect(removeResult.details.phases[0].tasks).toHaveLength(0);
    });

    it('should error when multiple operations', async () => {
      const result = await tool.execute('multi', { add_phase: { name: 'P' }, add_task: { phase: 'P', content: 'T' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Multiple operations');
    });

    it('should error when no operation specified', async () => {
      const result = await tool.execute('noop', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No operation');
    });

    it('should error when add_phase name is empty', async () => {
      const result = await tool.execute('badphase', { add_phase: { name: '' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_phase.name must be a string (not an object or array)');
    });

    it('should error when add_task missing phase', async () => {
      const result = await tool.execute('badadd', { add_task: { content: 'T' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_task.phase must be a string');
    });

    it('should error when add_task missing content', async () => {
      const result = await tool.execute('badcontent', { add_task: { phase: 'P' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_task.content must be a string');
    });

  });
});
