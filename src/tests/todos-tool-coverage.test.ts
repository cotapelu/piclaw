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
  normalizeParams,
  formatSummary,
  getLatestTodoPhasesFromEntries,
  registerTodosTool,
} from '../extensions/tools/todos-tool.js';
import { existsSync, mkdirSync, rmSync, writeFileSync, promises } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Use the captured real functions for cleanup
const realFs = { realRmSync, realMkdirSync, realExistsSync };

describe('TodosTool Coverage Gaps', () => {
  let tempHome: string;
  let cwd: string;

  beforeEach(() => {
    const originalHome = homedir();
    tempHome = join(originalHome, '.todos-test-coverage');
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
    } catch (e) {
      // ignore cleanup errors
    }
  });

  describe('applyOp validation errors', () => {
    it('add_phase: errors when name is empty string', () => {
      const phases: any[] = [];
      const result = applyOp(phases, 1, 1, { add_phase: { name: '', tasks: [] } });
      expect(result.errors).toContain('add_phase.name must be a string (not an object or array)');
    });

    it('add_phase: errors when tasks is not array', () => {
      const phases: any[] = [];
      const result = applyOp(phases, 1, 1, { add_phase: { name: 'P', tasks: 'not array' } });
      expect(result.errors).toContain('add_phase.tasks must be an array');
    });

    it('add_task: errors when phase not found', () => {
      const phases: any[] = [];
      const result = applyOp(phases, 1, 1, { add_task: { phase: 'missing', content: 'T' } });
      expect(result.errors).toContain('Phase "missing" not found');
    });

    it('add_task: errors when content missing', () => {
      const phases: any[] = [];
      const result = applyOp(phases, 1, 1, { add_task: { phase: 'phase-1', content: '' } });
      expect(result.errors).toContain('add_task.content must be a string');
    });

    it('update: errors when both id and ids missing', () => {
      const phases: any[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T', status: 'pending' }] }];
      const result = applyOp(phases, 1, 1, { update: {} });
      expect(result.errors).toContain("update must have either 'id' (string) or 'ids' (array of strings)");
    });

    it('update: errors when ids is not array', () => {
      const phases: any[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T', status: 'pending' }] }];
      const result = applyOp(phases, 1, 1, { update: { ids: 'not array' } });
      expect(result.errors).toContain("update must have either 'id' (string) or 'ids' (array of strings)");
    });

    it('update: errors when status is invalid type', () => {
      const phases: any[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T', status: 'pending' }] }];
      const result = applyOp(phases, 1, 1, { update: { id: 'task-1', status: 123 as any } });
      expect(result.errors).toContain('Invalid status: 123. Must be pending, in_progress, completed, or abandoned.');
    });

    it('update: no error when ids array empty (noop)', () => {
      const phases: any[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T', status: 'pending' }] }];
      const result = applyOp(phases, 1, 1, { update: { ids: [] } });
      expect(result.errors).toHaveLength(0);
      expect(result.phases[0].tasks).toHaveLength(1);
    });

    it('remove_task: errors when id missing', () => {
      const phases: any[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T' }] }];
      const result = applyOp(phases, 1, 1, { remove_task: {} });
      expect(result.errors).toContain('remove_task.id must be a string (e.g., \'task-1\')');
    });

    it('remove_task: errors when task not found', () => {
      const phases: any[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'T' }] }];
      const result = applyOp(phases, 1, 1, { remove_task: { id: 'missing' } });
      expect(result.errors).toContain('Task "missing" not found');
    });
  });

  describe('formatSummary errors', () => {
    it('shows errors at top when present', () => {
      const phases: any[] = [];
      const summary = formatSummary(phases, ['Something failed']);
      expect(summary).toContain('Errors: Something failed');
    });
  });

  describe('getLatestTodoPhasesFromEntries edge cases', () => {
    it('ignores entries with null message', () => {
      const entries = [
        { type: 'message', message: null },
      ] as any;
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });

    it('ignores entries with missing details', () => {
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'todos' } },
      ];
      const phases = getLatestTodoPhasesFromEntries(entries);
      expect(phases).toEqual([]);
    });
  });

  describe('TodoState file operations', () => {
    it('loadFromFile returns false on JSON parse error', async () => {
      existsSync.mockReturnValue(true);
      promises.readFile.mockResolvedValue('invalid json');
      const state = new TodoState();
      const loaded = await state.loadFromFile(cwd);
      expect(loaded).toBe(false);
      expect(state.getPhases()).toEqual([]);
    });

    it('saveToFile propagates write error', async () => {
      promises.mkdir.mockResolvedValue({});
      promises.writeFile.mockRejectedValue(new Error('disk full'));
      const state = new TodoState();
      state.addPhase('P1', [{ content: 'T' }]);
      await expect(state.saveToFile(cwd)).rejects.toThrow('disk full');
    });

    it('saveToFile propagates rename error', async () => {
      promises.mkdir.mockResolvedValue({});
      promises.writeFile.mockResolvedValue({});
      promises.rename.mockRejectedValue(new Error('rename failed'));
      const state = new TodoState();
      state.addPhase('P1', [{ content: 'T' }]);
      await expect(state.saveToFile(cwd)).rejects.toThrow('rename failed');
    });
  });

  describe('Tool execution error handling', () => {
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

    it('execute: error when add_phase name missing', async () => {
      const result = await capturedTool.execute('err', { add_phase: { name: '' } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_phase.name must be a string');
    });

    it('execute: error when add_task content missing', async () => {
      const result = await capturedTool.execute('err', { add_task: { phase: 'phase-1', content: '' as any } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_task.content must be a string');
    });

    it('execute: error when update status invalid type', async () => {
      await capturedTool.execute('p1', { add_phase: { name: 'P', tasks: [{ content: 'T' }] } }, undefined, undefined, mockCtx);
      const listResult = await capturedTool.execute('list', { list: {} }, undefined, undefined, mockCtx);
      const taskId = listResult.details.phases[0].tasks[0].id;
      const result = await capturedTool.execute('upd', { update: { id: taskId, status: 123 as any } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid status');
    });

    it('execute: error when remove_task id missing', async () => {
      const result = await capturedTool.execute('rem', { remove_task: {} } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('remove_task.id must be a string');
    });
  });
});
