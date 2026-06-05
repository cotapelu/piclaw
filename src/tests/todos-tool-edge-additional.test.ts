import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Capture real fs functions for cleanup before mocking
import { rmSync as realRmSync, mkdirSync as realMkdirSync, existsSync as realExistsSync } from 'node:fs';

// Mock fs for the module under test, but we keep real functions for cleanup
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
  },
}));

// Now import all modules
import {
  TodoState,
  applyOp,
  formatSummary,
  getLatestTodoPhasesFromEntries,
  registerTodosTool,
} from '../extensions/tools/todos-tool.js';
import { existsSync, mkdirSync, promises } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Use the captured real functions for cleanup
const realFs = { realRmSync, realMkdirSync, realExistsSync };

describe('TodosTool Edge Cases Additional Coverage', () => {
  let tempHome: string;
  let cwd: string;

  beforeEach(() => {
    const originalHome = homedir();
    tempHome = join(originalHome, '.todos-edge-add');
    if (realFs.realExistsSync(tempHome)) {
      realFs.realRmSync(tempHome, { recursive: true, force: true });
    }
    realFs.realMkdirSync(tempHome, { recursive: true });
    cwd = join(tempHome, 'test-project');
    realFs.realMkdirSync(cwd, { recursive: true });
    vi.stubEnv('HOME', tempHome);
    vi.clearAllMocks();
    existsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    try {
      if (realFs.realExistsSync(tempHome)) {
        realFs.realRmSync(tempHome, { recursive: true, force: true });
      }
    } catch (e) {}
  });

  describe('TodoState public methods', () => {
    it('addPhase creates phase with proper structure', () => {
      const state = new TodoState();
      const phase = state.addPhase('My Phase', [{ content: 'Task 1' }]);
      expect(phase.id).toMatch(/^phase-\d+$/);
      expect(phase.name).toBe('My Phase');
      expect(phase.tasks).toHaveLength(1);
      expect(phase.tasks[0].id).toMatch(/^task-\d+$/);
      // After adding a phase with tasks, normalizeInProgress promotes the first pending to in_progress
      expect(phase.tasks[0].status).toBe('in_progress');
      expect(state.nextPhaseId).toBe(2);
      expect(state.nextTaskId).toBe(2);
    });

    it('addPhase with no tasks leaves nextTaskId unchanged', () => {
      const state = new TodoState();
      const phase = state.addPhase('Empty Phase');
      expect(phase.tasks).toEqual([]);
      expect(state.nextPhaseId).toBe(2);
      expect(state.nextTaskId).toBe(1); // unchanged because no tasks
    });

    it('addTask returns null for unknown phase', () => {
      const state = new TodoState();
      const task = state.addTask('unknown-phase', 'Content');
      expect(task).toBeNull();
    });

    it('updateTask returns null for unknown task', () => {
      const state = new TodoState();
      const result = state.updateTask('unknown-task', { status: 'completed' });
      expect(result).toBeNull();
    });

    it('removeTask returns false for unknown task', () => {
      const state = new TodoState();
      const result = state.removeTask('unknown-task');
      expect(result).toBe(false);
    });

    it('replacePhases fully replaces state and recalculates ID counters', () => {
      const state = new TodoState();
      state.addPhase('Original'); // adds phase-1, no tasks -> nextTaskId remains 1, nextPhaseId=2
      expect(state.nextPhaseId).toBe(2);
      expect(state.nextTaskId).toBe(1);

      const newPhases = [
        { id: 'phase-5', name: 'P5', tasks: [
          { id: 'task-10', content: 'T10', status: 'pending' },
          { id: 'task-20', content: 'T20', status: 'pending' }
        ]},
        { id: 'phase-100', name: 'P100', tasks: [] }
      ];
      state.replacePhases(newPhases);
      const phases = state.getPhases();
      expect(phases).toHaveLength(2);
      expect(phases[0].tasks).toHaveLength(2);
      // getNextIds scans the numeric IDs and increments
      expect(state.nextPhaseId).toBe(101); // max phase-100 + 1
      expect(state.nextTaskId).toBe(21);   // max task-20 + 1
    });

    it('getPhases returns deep clone', () => {
      const state = new TodoState();
      state.addPhase('P', [{ content: 'Original' }]);

      const clone = state.getPhases();
      clone[0].tasks[0].content = 'Modified';
      clone[0].tasks.push({ id: 'task-999', content: 'New', status: 'pending' });

      const current = state.getPhases();
      expect(current[0].tasks[0].content).toBe('Original');
      expect(current[0].tasks).toHaveLength(1);
    });

    it('setStorageType updates storage type', () => {
      const state = new TodoState();
      expect(state.storageType).toBe('file');
      state.setStorageType('session');
      expect(state.storageType).toBe('session');
      state.setStorageType('memory');
      expect(state.storageType).toBe('memory');
    });
  });

  describe('applyOp operations', () => {
    it('list returns phases unchanged with empty phases', () => {
      const { phases, errors } = applyOp([], 1, 1, { list: {} });
      expect(phases).toEqual([]);
      expect(errors).toEqual([]);
    });

    it('unknown operation returns error', () => {
      const { errors } = applyOp([], 1, 1, { unknown: {} } as any);
      expect(errors).toContain('No operation specified');
    });

    it('delete operation resets IDs to 1', () => {
      const { phases, nextTaskId, nextPhaseId, errors } = applyOp([{ id: 'p1', name: 'P1', tasks: [] }], 5, 3, { delete: {} });
      expect(phases).toEqual([]);
      // delete uses makeEmptyFile which resets to 1,1
      expect(nextTaskId).toBe(1);
      expect(nextPhaseId).toBe(1);
      expect(errors).toEqual([]);
    });

    it('add_phase with empty tasks is valid', () => {
      const { phases, errors } = applyOp([], 1, 1, { add_phase: { name: 'Empty' } });
      expect(errors).toEqual([]);
      expect(phases[0].name).toBe('Empty');
      expect(phases[0].tasks).toEqual([]);
    });

    it('add_phase preserves notes and details on tasks', () => {
      const { phases } = applyOp([], 1, 1, { add_phase: { name: 'P', tasks: [{ content: 'T', notes: 'n', details: 'd' }] } });
      expect(phases[0].tasks[0].notes).toBe('n');
      expect(phases[0].tasks[0].details).toBe('d');
    });

    it('add_task with notes and details via sequential applyOp', () => {
      let { phases } = applyOp([], 1, 1, { add_phase: { name: 'P', tasks: [{ content: 'T1' }] } });
      ({ phases } = applyOp(phases, 2, 2, { add_task: { phase: 'phase-1', content: 'T2', notes: 'n', details: 'd' } }));
      const task = phases[0].tasks.find((t: any) => t.content === 'T2');
      expect(task?.notes).toBe('n');
      expect(task?.details).toBe('d');
    });

    it('update empty ids is no-op', () => {
      const start = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T', status: 'pending' }] }];
      const { phases, errors } = applyOp(start, 1, 1, { update: { ids: [] } });
      expect(phases[0].tasks[0].content).toBe('T');
      expect(errors).toEqual([]);
    });

    it('update unknown task id records error but continues', () => {
      const start = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T', status: 'pending' }] }];
      const { phases, errors } = applyOp(start, 1, 1, { update: { ids: ['missing'] } });
      expect(errors).toContain('Task "missing" not found');
      expect(phases[0].tasks).toHaveLength(1);
    });
  });

  describe('formatSummary variations', () => {
    it('shows "Todo list cleared." when empty', () => {
      const summary = formatSummary([], []);
      expect(summary).toContain('Todo list cleared.');
    });

    it('shows pending + in_progress counts', () => {
      const phases = [{ id: 'p', name: 'P', tasks: [
        { id: 't1', content: 'T1', status: 'pending' },
        { id: 't2', content: 'T2', status: 'in_progress' },
        { id: 't3', content: 'T3', status: 'completed' }
      ]}];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('2 remaining');
      expect(summary).toContain('1 completed');
    });

    it('shows completed count correctly (abandoned not counted)', () => {
      const phases = [{ id: 'p', name: 'P', tasks: [
        { id: 't1', content: 'T1', status: 'completed' },
        { id: 't2', content: 'T2', status: 'abandoned' }
      ]}];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('0 remaining');
      expect(summary).toContain('1 completed'); // only status === 'completed'
    });

    it('filters empty phases from remaining list', () => {
      const phases = [
        { id: 'p1', name: 'P1', tasks: [] },
        { id: 'p2', name: 'P2', tasks: [{ id: 't', content: 'T', status: 'pending' }] }
      ];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('Remaining items (1)');
      expect(summary).not.toContain('P1');
    });

    it('shows details for in_progress task', () => {
      const phases = [{ id: 'p', name: 'P', tasks: [
        { id: 't', content: 'T', status: 'in_progress', details: 'line1\nline2' }
      ]}];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('line1');
      expect(summary).toContain('line2');
    });
  });

  describe('getLatestTodoPhasesFromEntries scenarios', () => {
    it('returns empty for empty array', () => {
      const phases = getLatestTodoPhasesFromEntries([]);
      expect(phases).toEqual([]);
    });

    it('skips non-message entries', () => {
      const entries = [
        { type: 'event' },
        { type: 'message', message: { role: 'user' } }
      ];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });

    it('skips entries with wrong toolName', () => {
      const entries = [{ type: 'message', message: { role: 'toolResult', toolName: 'other' } }];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });

    it('skips error toolResult entries', () => {
      const entries = [{ type: 'message', message: { role: 'toolResult', toolName: 'todos', isError: true, details: { phases: [] } } }];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });

    it('returns phases from most recent valid entry', () => {
      const phasesData = [{ id: 'phase-1', name: 'P1', tasks: [] }];
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'other' } },
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases: phasesData } } },
      ];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toBe(phasesData);
    });

    it('ignores entry with null message', () => {
      const entries = [{ type: 'message', message: null }] as any;
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });

    it('ignores entry with missing details', () => {
      const entries = [{ type: 'message', message: { role: 'toolResult', toolName: 'todos' } }];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });
  });

  describe('TodoState reconstruction', () => {
    it('reconstructFromEntries returns false when no valid entry', () => {
      const state = new TodoState();
      const found = state.reconstructFromEntries([{ type: 'event' }]);
      expect(found).toBe(false);
      expect(state.getPhases()).toEqual([]);
    });

    it('reconstructFromEntries returns true with empty phases', () => {
      const state = new TodoState();
      const entries = [{ type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases: [] } } }];
      const found = state.reconstructFromEntries(entries);
      expect(found).toBe(true);
      expect(state.getPhases()).toEqual([]);
    });

    it('reconstructFromEntries picks latest valid entry', () => {
      const state = new TodoState();
      const phases1 = [{ id: 'phase-1', name: 'Old', tasks: [] }];
      const phases2 = [{ id: 'phase-2', name: 'New', tasks: [] }];
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases: phases1 } } },
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases: phases2 } } },
      ];
      const found = state.reconstructFromEntries(entries);
      expect(found).toBe(true);
      expect(state.getPhases()[0].name).toBe('New');
    });
  });

  describe('File operations failures', () => {
    it('loadFromFile returns false when file missing', async () => {
      existsSync.mockReturnValue(false);
      const state = new TodoState();
      const loaded = await state.loadFromFile(cwd);
      expect(loaded).toBe(false);
    });

    it('loadFromFile returns false on JSON parse error', async () => {
      existsSync.mockReturnValue(true);
      promises.readFile.mockResolvedValue('invalid json');
      const state = new TodoState();
      const loaded = await state.loadFromFile(cwd);
      expect(loaded).toBe(false);
    });

    it('loadFromFile returns false on invalid version', async () => {
      existsSync.mockReturnValue(true);
      promises.readFile.mockResolvedValue(JSON.stringify({ version: 2, phases: [] }));
      const state = new TodoState();
      const loaded = await state.loadFromFile(cwd);
      expect(loaded).toBe(false);
    });

    it('loadFromFile returns false on read exception', async () => {
      existsSync.mockReturnValue(true);
      promises.readFile.mockRejectedValue(new Error('read failed'));
      const state = new TodoState();
      const loaded = await state.loadFromFile(cwd);
      expect(loaded).toBe(false);
    });

    it('saveToFile propagates mkdir error', async () => {
      const state = new TodoState();
      state.addPhase('P', [{ content: 'T' }]);
      promises.mkdir.mockRejectedValue(new Error('no perms'));
      await expect(state.saveToFile(cwd)).rejects.toThrow('no perms');
    });

    it('saveToFile propagates writeFile error', async () => {
      const state = new TodoState();
      state.addPhase('P', [{ content: 'T' }]);
      promises.mkdir.mockResolvedValue({});
      promises.writeFile.mockRejectedValue(new Error('disk full'));
      await expect(state.saveToFile(cwd)).rejects.toThrow('disk full');
    });

    it('saveToFile propagates rename error', async () => {
      const state = new TodoState();
      state.addPhase('P', [{ content: 'T' }]);
      promises.mkdir.mockResolvedValue({});
      promises.writeFile.mockResolvedValue({});
      promises.rename.mockRejectedValue(new Error('rename failed'));
      await expect(state.saveToFile(cwd)).rejects.toThrow('rename failed');
    });
  });

  describe('Tool execution error cases', () => {
    let mockApi: any;
    let capturedTool: any;
    let mockCtx: any;

    beforeEach(() => {
      mockApi = {
        registerTool: vi.fn((tool: any) => { capturedTool = tool; }),
        sendMessage: vi.fn(),
        on: vi.fn(),
      };
      mockCtx = { sessionManager: { getBranch: vi.fn().mockReturnValue([]) }, hasUI: true, cwd } as any;
      registerTodosTool(mockApi);
    });

    it('handles add_phase JSON parse error', async () => {
      const result = await capturedTool.execute('test', { add_phase: '{"invalid":}' } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error parsing');
    });

    it('handles add_task JSON parse error', async () => {
      const result = await capturedTool.execute('test', { add_task: '{"bad":}' } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('must be an object');
    });

    it('handles update JSON parse error', async () => {
      const result = await capturedTool.execute('test', { update: '{"oops":}' } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
    });

    it('delete then list shows empty', async () => {
      await capturedTool.execute('add', { add_phase: { name: 'P', tasks: [{ content: 'T' }] } }, undefined, undefined, mockCtx);
      await capturedTool.execute('del', { delete: {} }, undefined, undefined, mockCtx);
      const listResult = await capturedTool.execute('list', { list: {} }, undefined, undefined, mockCtx);
      expect(listResult.isError).toBe(false);
      expect(listResult.details.phases).toEqual([]);
    });
  });
});
