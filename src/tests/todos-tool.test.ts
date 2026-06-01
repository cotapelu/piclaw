import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fs and path before importing the module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
  },
}));
vi.mock('node:path', () => ({
  dirname: vi.fn(() => '/dir'),
  join: vi.fn(() => '/path/to/todos.json'),
}));

// Import mocked modules to access mock functions
import * as fs from 'node:fs';
import * as path from 'node:path';

// Now import the module under test
import {
  TodoState,
  applyOp,
  normalizeParams,
  formatSummary,
  TodoPhase,
  TodoItem,
  getLatestTodoPhasesFromEntries,
  registerTodosTool,
} from '../extensions/tools/todos-tool.js';

const { existsSync, mkdirSync, promises } = fs;

describe('todos tool', () => {
  let cwdSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/cwd');
    existsSync.mockReturnValue(false);
  });

  afterEach(() => {
    cwdSpy?.mockRestore();
  });

  describe('TodoState', () => {
    let state: TodoState;

    beforeEach(() => {
      state = new TodoState();
      state.phases = [];
      state.nextTaskId = 1;
      state.nextPhaseId = 1;
    });

    it('should start empty', () => {
      expect(state.getPhases()).toEqual([]);
    });

    it('addPhase creates a new phase with tasks', () => {
      const phase = state.addPhase('Phase 1', [{ content: 'Task 1' }, { content: 'Task 2' }]);
      expect(phase.name).toBe('Phase 1');
      expect(phase.tasks).toHaveLength(2);
      expect(phase.tasks[0].content).toBe('Task 1');
      expect(phase.tasks[1].content).toBe('Task 2');
      expect(state.nextPhaseId).toBe(2);
    });

    it('addTask adds task to existing phase by ID', () => {
      state.addPhase('Phase 1', [{ content: 'Initial' }]);
      const phaseId = state.getPhases()[0].id;
      const task = state.addTask(phaseId, 'New task');
      expect(task).not.toBeNull();
      expect(task?.content).toBe('New task');
      expect(state.getPhases()[0].tasks).toHaveLength(2);
    });

    it('addTask returns null for unknown phase', () => {
      const task = state.addTask('unknown', 'Task');
      expect(task).toBeNull();
    });

    it('updateTask modifies task by ID', () => {
      state.addPhase('Phase 1', [{ content: 'Task' }]);
      const task = state.getPhases()[0].tasks[0];
      const updated = state.updateTask(task.id, { status: 'in_progress' });
      expect(updated?.status).toBe('in_progress');
    });

    it('updateTask returns null for unknown ID', () => {
      const result = state.updateTask('none', { status: 'completed' });
      expect(result).toBeNull();
    });

    it('removeTask deletes task by ID', () => {
      state.addPhase('Phase 1', [{ content: 'Task 1' }, { content: 'Task 2' }]);
      const taskId = state.getPhases()[0].tasks[0].id;
      expect(state.removeTask(taskId)).toBe(true);
      expect(state.getPhases()[0].tasks).toHaveLength(1);
    });

    it('removeTask returns false for unknown ID', () => {
      expect(state.removeTask('none')).toBe(false);
    });

    it('replacePhases replaces all phases', () => {
      state.addPhase('Phase 1', [{ content: 'Task' }]);
      const newPhases: TodoPhase[] = [{ id: 'phase-1', name: 'New Phase', tasks: [{ id: 'task-1', content: 'New Task', status: 'pending' }] }];
      state.replacePhases(newPhases);
      expect(state.getPhases()).toHaveLength(1);
      expect(state.getPhases()[0].name).toBe('New Phase');
    });

    it('getPhases returns a clone', () => {
      state.addPhase('Phase 1', [{ content: 'Task' }]);
      const phases = state.getPhases();
      phases.push({ id: 'phase-2', name: 'Hack', tasks: [] } as TodoPhase);
      expect(state.getPhases()).toHaveLength(1);
    });

    it('loadFromFile loads data from file', async () => {
      const fileData = { phases: [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T1', status: 'pending' }] }], nextTaskId: 2, nextPhaseId: 2, version: 1 };
      existsSync.mockReturnValue(true);
      // readFile with encoding returns a string
      promises.readFile.mockResolvedValue(JSON.stringify(fileData));
      const loaded = await state.loadFromFile();
      expect(loaded).toBe(true);
      expect(state.getPhases()).toHaveLength(1);
      expect(state.getPhases()[0].name).toBe('P1');
      expect(state.storageType).toBe('file');
    });

    it('loadFromFile returns false if no file', async () => {
      existsSync.mockReturnValue(false);
      const loaded = await state.loadFromFile();
      expect(loaded).toBe(false);
    });

    it('saveToFile writes to file', async () => {
      state.addPhase('Phase 1', [{ content: 'Task' }]);
      promises.mkdir.mockResolvedValue({});
      await state.saveToFile();
      expect(promises.writeFile).toHaveBeenCalled();
    });

    it('setStorageType updates storage type', () => {
      state.setStorageType('memory');
      expect(state.storageType).toBe('memory');
    });
  });

  describe('applyOp', () => {
    it('add_phase creates phase', () => {
      const result = applyOp([], 1, 1, { add_phase: { name: 'Phase 1' } });
      expect(result.phases).toHaveLength(1);
      expect(result.phases[0].name).toBe('Phase 1');
      expect(result.nextPhaseId).toBe(2);
    });

    it('add_phase with tasks creates tasks', () => {
      const result = applyOp([], 1, 1, { add_phase: { name: 'Phase 1', tasks: [{ content: 'T1' }, { content: 'T2' }] } });
      expect(result.phases[0].tasks).toHaveLength(2);
      expect(result.nextTaskId).toBe(3);
    });

    it('add_task adds to phase by ID', () => {
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [] }];
      const result = applyOp(phases, 1, 2, { add_task: { phase: 'phase-1', content: 'New task' } });
      expect(result.phases[0].tasks).toHaveLength(1);
      expect(result.phases[0].tasks[0].content).toBe('New task');
    });

    it('add_task supports phase name lookup', () => {
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [] }];
      const result = applyOp(phases, 1, 2, { add_task: { phase: 'P1', content: 'Task' } });
      expect(result.phases[0].tasks).toHaveLength(1);
    });

    it('update modifies task by id', () => {
      const tasks: TodoItem[] = [{ id: 'task-1', content: 'T1', status: 'pending' }];
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks }];
      const result = applyOp(phases, 2, 2, { update: { id: 'task-1', status: 'in_progress' } });
      expect(result.phases[0].tasks[0].status).toBe('in_progress');
    });

    it('update supports batch ids', () => {
      const tasks: TodoItem[] = [
        { id: 'task-1', content: 'T1', status: 'pending' },
        { id: 'task-2', content: 'T2', status: 'pending' },
      ];
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks }];
      const result = applyOp(phases, 3, 2, { update: { ids: ['task-1', 'task-2'], status: 'completed' } });
      expect(result.phases[0].tasks[0].status).toBe('completed');
      expect(result.phases[0].tasks[1].status).toBe('completed');
    });

    it('remove_task deletes task', () => {
      const tasks: TodoItem[] = [{ id: 'task-1', content: 'T1', status: 'pending' }];
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks }];
      const result = applyOp(phases, 2, 2, { remove_task: { id: 'task-1' } });
      expect(result.phases[0].tasks).toHaveLength(0);
    });

    it('delete clears all phases', () => {
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T1', status: 'pending' }] }];
      const result = applyOp(phases, 2, 2, { delete: {} });
      expect(result.phases).toEqual([]);
      expect(result.nextTaskId).toBe(1);
      expect(result.nextPhaseId).toBe(1);
    });

    it('list returns unchanged state', () => {
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T1', status: 'pending' }] }];
      const result = applyOp(phases, 2, 2, { list: {} });
      expect(result.phases).toHaveLength(1);
    });

    it('returns errors for invalid operations', () => {
      const result = applyOp([], 1, 1, { unknown: {} });
      expect(result.errors).toContain('No operation specified');
    });

    it('normalizes in_progress to single task', () => {
      const tasks: TodoItem[] = [
        { id: 'task-1', content: 'T1', status: 'pending' },
        { id: 'task-2', content: 'T2', status: 'in_progress' },
        { id: 'task-3', content: 'T3', status: 'in_progress' },
      ];
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks }];
      applyOp(phases, 4, 2, {}); // initial call does nothing but normalization inside applyOp?
      // Let's just test the result after apply with empty op to trigger normalization
      const result = applyOp(phases, 4, 2, {});
      // After normalization, only one in_progress remains (first one)
      const inProg = result.phases.flatMap(p => p.tasks).filter(t => t.status === 'in_progress');
      expect(inProg).toHaveLength(1);
      expect(inProg[0].id).toBe('task-2'); // The first encountered stays in_progress
    });

    it('enforces single in_progress when adding tasks across phases', () => {
      const phases: TodoPhase[] = [
        { id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T1', status: 'in_progress' }] },
        { id: 'phase-2', name: 'P2', tasks: [{ id: 'task-2', content: 'T2', status: 'in_progress' }] },
      ];
      const result = applyOp(phases, 3, 3, {});
      const inProg = result.phases.flatMap(p => p.tasks).filter(t => t.status === 'in_progress');
      expect(inProg).toHaveLength(1);
    });
  });

  describe('normalizeParams', () => {
    it('parses JSON string to object', () => {
      const result = normalizeParams('{"add_phase":{"name":"P1"}}');
      expect(result.add_phase.name).toBe('P1');
    });

    it('throws on invalid JSON string', () => {
      expect(() => normalizeParams('invalid{')).toThrow('Invalid JSON string');
    });

    it('throws on non-object', () => {
      expect(() => normalizeParams(42 as any)).toThrow('Parameters must be an object');
    });

    it('parses add_phase tasks from comma string', () => {
      const result = normalizeParams({ add_phase: { name: 'P1', tasks: 't1,t2,t3' } });
      expect(result.add_phase.tasks).toEqual([{ content: 't1' }, { content: 't2' }, { content: 't3' }]);
    });

    it('parses nested stringified objects', () => {
      const result = normalizeParams({ add_phase: '{"name":"P1","tasks":[{"content":"T1"}]}' });
      // Debug
      console.log('nested result:', result);
      expect(result.add_phase).toBeDefined();
      expect(result.add_phase.name).toBe('P1');
    });

    it('parses add_task from string', () => {
      const result = normalizeParams({ add_task: '{"phase":"phase-1","content":"Task"}' });
      console.log('add_task result:', result);
      expect(result.add_task).toBeDefined();
      expect(result.add_task.phase).toBe('phase-1');
      expect(result.add_task.content).toBe('Task');
    });
  });

  describe('formatSummary', () => {
    it('shows empty message when no tasks', () => {
      const summary = formatSummary([], []);
      expect(summary).toContain('Todo list cleared.');
    });

    it('shows pending and completed counts', () => {
      const phases: TodoPhase[] = [{
        id: 'phase-1',
        name: 'P1',
        tasks: [
          { id: 'task-1', content: 'T1', status: 'pending' },
          { id: 'task-2', content: 'T2', status: 'completed' },
        ],
      }];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('1 remaining');
      expect(summary).toContain('1 completed');
    });

    it('shows errors at top', () => {
      const summary = formatSummary([], ['Something failed']);
      expect(summary).toContain('Errors: Something failed');
    });

    it('lists remaining tasks', () => {
      const phases: TodoPhase[] = [{
        id: 'phase-1',
        name: 'P1',
        tasks: [
          { id: 'task-1', content: 'T1', status: 'pending' },
          { id: 'task-2', content: 'T2', status: 'in_progress', details: 'Detail line' },
        ],
      }];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('task-1');
      expect(summary).toContain('T1');
      expect(summary).toContain('Detail line');
    });

    it('includes phase progress', () => {
      const phases: TodoPhase[] = [{
        id: 'phase-1',
        name: 'P1',
        tasks: [
          { id: 'task-1', content: 'T1', status: 'completed' },
          { id: 'task-2', content: 'T2', status: 'completed' },
          { id: 'task-3', content: 'T3', status: 'pending' },
        ],
      }];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('2/3 tasks complete');
    });
  });

  describe('getLatestTodoPhasesFromEntries', () => {
    it('extracts phases from last valid todos toolResult', () => {
      const entries = [
        { type: 'message', message: { role: 'user', content: 'Hi' } },
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases: [{ id: 'p1', name: 'Phase', tasks: [{ id: 't1', content: 'Task', status: 'pending' }] }] } } },
        { type: 'message', message: { role: 'assistant', content: 'OK' } },
      ];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toHaveLength(1);
      expect(phases[0].name).toBe('Phase');
    });

    it('returns empty array if no valid entries', () => {
      const phases = getLatestTodoPhasesFromEntries([]);
      expect(phases).toEqual([]);
    });

    it('skips error entries', () => {
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases: [] }, isError: true } },
      ];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });

    it('supports both todos and todo_write tool names', () => {
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'todo_write', details: { phases: [{ id: 'p1', name: 'P', tasks: [{ id: 't1', content: 'T', status: 'pending' }] }] } } },
      ];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toHaveLength(1);
    });
  });

  // -- Integration tests for the tool (execute API) --
  describe('tool execution', () => {
    let mockApi: any;
    let capturedTool: any;
    let mockCtx: any;

    const createMockApi = () => ({
      registerTool: vi.fn((tool: any) => { capturedTool = tool; }),
      sendMessage: vi.fn(),
      on: vi.fn(),
    });

    const createMockCtx = () => ({
      sessionManager: { getBranch: vi.fn().mockReturnValue([]) },
      hasUI: true,
    } as any);

    beforeEach(() => {
      // Reset fs mocks to default successful state
      existsSync.mockReturnValue(false);
      promises.mkdir.mockResolvedValue({});
      promises.writeFile.mockResolvedValue(undefined);
    });

    it('registers session event listeners', () => {
      mockApi = createMockApi();
      registerTodosTool(mockApi);
      expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
      expect(mockApi.on).toHaveBeenCalledWith('session_tree', expect.any(Function));
    });

    it('execute: add_phase creates phase and persists', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      const result = await tool.execute('call1', { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }, undefined, undefined, mockCtx);

      // Check result content and details
      expect(result.content[0].text).toContain('1 remaining');
      expect(result.details.phases).toHaveLength(1);
      expect(result.details.phases[0].name).toBe('Phase 1');
      expect(result.details.phases[0].tasks).toHaveLength(1);
      // Persistence
      expect(promises.writeFile).toHaveBeenCalled();
      // System message sent
      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ customType: 'todo_update' }),
        expect.anything()
      );
    });

    it('execute: add_task adds task to phase by ID', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      // add a phase first
      const phaseResult = await tool.execute('p1', { add_phase: { name: 'P' } }, undefined, undefined, mockCtx);
      const pId = phaseResult.details.phases[0].id;

      const addTaskResult = await tool.execute('t1', { add_task: { phase: pId, content: 'New task' } }, undefined, undefined, mockCtx);
      expect(addTaskResult.details.phases[0].tasks).toHaveLength(1);
      expect(addTaskResult.details.phases[0].tasks[0].content).toBe('New task');
    });

    it('execute: update modifies task status', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      // add_phase with task
      const phaseResult = await tool.execute('p1', { add_phase: { name: 'P', tasks: [{ content: 'T' }] } }, undefined, undefined, mockCtx);
      const taskId = phaseResult.details.phases[0].tasks[0].id;

      const updateResult = await tool.execute('upd', { update: { id: taskId, status: 'in_progress' } }, undefined, undefined, mockCtx);
      expect(updateResult.details.phases[0].tasks[0].status).toBe('in_progress');
    });

    it('execute: remove_task deletes task', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      // add task
      const phaseResult = await tool.execute('p1', { add_phase: { name: 'P', tasks: [{ content: 'T' }] } }, undefined, undefined, mockCtx);
      const taskId = phaseResult.details.phases[0].tasks[0].id;

      const removeResult = await tool.execute('rem', { remove_task: { id: taskId } }, undefined, undefined, mockCtx);
      expect(removeResult.details.phases[0].tasks).toHaveLength(0);
    });

    it('execute: delete clears all', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      await tool.execute('p1', { add_phase: { name: 'P', tasks: [{ content: 'T' }] } }, undefined, undefined, mockCtx);
      const delResult = await tool.execute('del', { delete: {} }, undefined, undefined, mockCtx);
      expect(delResult.details.phases).toEqual([]);
    });

    it('execute: list returns current state', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      await tool.execute('p1', { add_phase: { name: 'P', tasks: [{ content: 'T' }] } }, undefined, undefined, mockCtx);
      const listResult = await tool.execute('list', { list: {} }, undefined, undefined, mockCtx);
      expect(listResult.details.phases).toHaveLength(1);
    });

    it('execute: list shows empty message when no todos', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      const result = await tool.execute('list-empty', { list: {} }, undefined, undefined, mockCtx);
      expect(result.content[0].text).toContain('Todo list cleared.');
    });

    it('execute: errors when no operation', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      const result = await tool.execute('err', {}, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No operation specified');
    });

    it('execute: errors when multiple operations', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      const result = await tool.execute('err', { add_phase: { name: 'P' }, add_task: { phase: 'phase-1', content: 'T' } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Multiple operations');
    });

    it('execute: handles invalid JSON string', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      registerTodosTool(mockApi);
      const tool = capturedTool;

      const result = await tool.execute('bad', 'not a json', undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      // The error message comes from JSON.parse, contains the raw message
      expect(result.content[0].text).toContain('not a json');
    });

    it('execute: handles save failure', async () => {
      mockApi = createMockApi();
      mockCtx = createMockCtx();
      // Simulate writeFile error
      promises.writeFile.mockRejectedValue(new Error('disk full'));
      registerTodosTool(mockApi);
      const tool = capturedTool;

      const result = await tool.execute('savefail', { add_phase: { name: 'P' } }, undefined, undefined, mockCtx);

      expect(result.isError).toBe(true);
      expect(result.details.error).toContain('Save failed');
      expect(result.details.storage).toBe('memory');
      expect(mockApi.sendMessage).not.toHaveBeenCalled();
    });
  });

  // Rendering tests to increase coverage
  describe('tool rendering', () => {
    let mockApi: any;
    let capturedTool: any;
    let mockCtx: any;

    beforeEach(() => {
      mockApi = {
        registerTool: vi.fn((tool: any) => { capturedTool = tool; }),
        sendMessage: vi.fn(),
        on: vi.fn(),
      };
      mockCtx = { sessionManager: { getBranch: vi.fn().mockReturnValue([]) }, hasUI: true } as any;
      registerTodosTool(mockApi);
    });

    it('renderCall executes', () => {
      const theme = { fg: () => '', bold: () => '', muted: () => '', accent: '', text: '', dim: () => '' } as any;
      const rendered = capturedTool.renderCall({ add_phase: { name: 'P' } }, theme, mockCtx);
      expect(rendered).toBeDefined();
    });

    it('renderResult executes', () => {
      const theme = { fg: () => '', dim: () => '', warning: '', success: '', accent: '', text: '' } as any;
      const details = { phases: [], storage: 'file' as const };
      const result = { content: [{ type: 'text', text: 'ok' }], details };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: false }, theme, mockCtx);
      expect(rendered).toBeDefined();
    });

    it('renderResult shows error', () => {
      const theme = { fg: () => '', dim: () => '', error: '' } as any;
      const result = { content: [{ type: 'text', text: '' }], details: { error: 'oops' } };
      const rendered = capturedTool.renderResult(result, { expanded: false, isPartial: false }, theme, mockCtx);
      expect(rendered).toBeDefined();
    });
  });
});
