import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerMemoryTool, MemoryListComponent } from '../extensions/tools/memory-tool.js';
import type { Memory } from '../extensions/tools/memory-tool.js';
import { Text } from '@earendil-works/pi-tui';

const createMockApi = () => ({
  registerTool: vi.fn(),
  appendEntry: vi.fn(),
  on: vi.fn(),
  registerCommand: vi.fn(),
});

const createMockCtx = (entries: any[] = []) => ({
  sessionManager: {
    getEntries: vi.fn().mockReturnValue(entries),
    getBranch: vi.fn().mockReturnValue(entries),
  },
  hasUI: true,
});

describe('memory tool', () => {
  let mockApi: any;
  let mockCtx: any;
  let capturedTool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockApi();
    mockApi.registerTool.mockImplementation((tool: any) => {
      capturedTool = tool;
    });
    mockCtx = createMockCtx();
  });

  it('should register the tool', () => {
    registerMemoryTool(mockApi);
    expect(mockApi.registerTool).toHaveBeenCalledTimes(1);
    expect(capturedTool).toBeDefined();
    expect(capturedTool.name).toBe('memory');
  });

  it('should have promptSnippet and promptGuidelines', () => {
    registerMemoryTool(mockApi);
    expect(capturedTool.promptSnippet).toBe('Proactively store important facts, decisions, code snippets, URLs with tags. Memories persist across sessions and help track project history.');
    expect(capturedTool.promptGuidelines.length).toBeGreaterThan(5);
  });

  it('should add a memory', async () => {
    registerMemoryTool(mockApi);
    const params = { action: 'add', text: 'Important fact' };
    const result = await capturedTool.execute('add1', params, undefined, undefined, mockCtx);

    expect(mockApi.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ text: 'Important fact' }));
    expect(result.content[0].text).toContain('Stored memory #1');
    expect(result.details.action).toBe('add');
    expect((result.details as any).memories.length).toBe(1);
  });

  it('should add memory with tags', async () => {
    registerMemoryTool(mockApi);
    const params = { action: 'add', text: 'Fact with tags', tags: ['project', 'important'] };
    const result = await capturedTool.execute('add2', params, undefined, undefined, mockCtx);

    expect(mockApi.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ tags: ['project', 'important'] }));
    expect(result.content[0].text).toContain('#1');
  });

  it('should error when adding without text', async () => {
    registerMemoryTool(mockApi);
    const params = { action: 'add' };
    const result = await capturedTool.execute('add3', params, undefined, undefined, mockCtx);

    expect(result.content[0].text).toContain('Error: text required');
    expect(result.details.error).toBe('text required');
    expect(mockApi.appendEntry).not.toHaveBeenCalled();
  });

  it('should list memories', async () => {
    registerMemoryTool(mockApi);
    // Add some memories
    await capturedTool.execute('a1', { action: 'add', text: 'Memory 1' }, undefined, undefined, mockCtx);
    await capturedTool.execute('a2', { action: 'add', text: 'Memory 2' }, undefined, undefined, mockCtx);
    expect(mockApi.appendEntry).toHaveBeenCalledTimes(2);

    // List
    const result = await capturedTool.execute('list', { action: 'list' }, undefined, undefined, mockCtx);
    expect(result.content[0].text).toContain('#1');
    expect(result.content[0].text).toContain('#2');
    expect(result.details.action).toBe('list');
    expect((result.details as any).memories.length).toBe(2);
  });

  it('should get a specific memory', async () => {
    registerMemoryTool(mockApi);
    await capturedTool.execute('a1', { action: 'add', text: 'Get this one' }, undefined, undefined, mockCtx);

    const result = await capturedTool.execute('get', { action: 'get', id: 1 }, undefined, undefined, mockCtx);
    expect(result.content[0].text).toContain('Get this one');
    expect(result.details.targetId).toBe(1);
  });

  it('should handle get with non-existent id', async () => {
    registerMemoryTool(mockApi);
    const result = await capturedTool.execute('get', { action: 'get', id: 999 }, undefined, undefined, mockCtx);

    expect(result.details.error).toBe('#999 not found');
    expect(mockApi.appendEntry).not.toHaveBeenCalled();
  });

  it('should delete a memory', async () => {
    registerMemoryTool(mockApi);
    await capturedTool.execute('a1', { action: 'add', text: 'To delete' }, undefined, undefined, mockCtx);
    expect(mockApi.appendEntry).toHaveBeenCalledTimes(1);

    const result = await capturedTool.execute('del', { action: 'delete', id: 1 }, undefined, undefined, mockCtx);
    expect(mockApi.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ id: 1, _deleted: true }));
    expect(result.content[0].text).toContain('Deleted memory #1');
    expect((result.details as any).memories.length).toBe(0);
  });

  it('should clear all memories', async () => {
    registerMemoryTool(mockApi);
    await capturedTool.execute('a1', { action: 'add', text: 'One' }, undefined, undefined, mockCtx);
    await capturedTool.execute('a2', { action: 'add', text: 'Two' }, undefined, undefined, mockCtx);
    expect(mockApi.appendEntry).toHaveBeenCalledTimes(2);

    const result = await capturedTool.execute('clear', { action: 'clear' }, undefined, undefined, mockCtx);
    expect(mockApi.appendEntry).toHaveBeenCalledTimes(4); // 2 more delete markers
    expect(result.content[0].text).toBe('Cleared 2 memories');
    expect((result.details as any).memories).toEqual([]);
  });

  it('should search memories', async () => {
    registerMemoryTool(mockApi);
    await capturedTool.execute('a1', { action: 'add', text: 'The quick brown fox' }, undefined, undefined, mockCtx);
    await capturedTool.execute('a2', { action: 'add', text: 'Lazy dog' }, undefined, undefined, mockCtx);
    await capturedTool.execute('a3', { action: 'add', text: 'Another fox story', tags: ['animal'] }, undefined, undefined, mockCtx);

    const result = await capturedTool.execute('search', { action: 'search', query: 'fox' }, undefined, undefined, mockCtx);
    expect(result.content[0].text).toContain('Found 2 of 3 memories');
    expect((result.details as any).memories.length).toBe(2);
  });

  it('should search by tag', async () => {
    registerMemoryTool(mockApi);
    await capturedTool.execute('a1', { action: 'add', text: 'Important meeting', tags: ['work'] }, undefined, undefined, mockCtx);
    await capturedTool.execute('a2', { action: 'add', text: 'Buy groceries', tags: ['personal'] }, undefined, undefined, mockCtx);

    const result = await capturedTool.execute('searchtag', { action: 'search', query: 'work' }, undefined, undefined, mockCtx);
    expect(result.content[0].text).toContain('Found 1 of 2 memories');
    expect((result.details as any).memories[0].tags).toContain('work');
  });

  it('should register session event listeners', () => {
    registerMemoryTool(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('session_tree', expect.any(Function));
  });

  it('should have custom rendering', () => {
    registerMemoryTool(mockApi);
    expect(typeof capturedTool.renderCall).toBe('function');
    expect(typeof capturedTool.renderResult).toBe('function');
  });

  // -- Additional tests for coverage --

  it('should reconstruct state from session_start event', async () => {
    registerMemoryTool(mockApi);
    // Get the session_start handler
    const startCalls = mockApi.on.mock.calls.filter(c => c[0] === 'session_start');
    expect(startCalls).toHaveLength(1);
    const handler = startCalls[0][1] as Function;

    const entries = [
      { type: 'message', message: { role: 'toolResult', toolName: 'memory', details: { memories: [{ id: 5, text: 'Reconstructed', tags: ['test'] }], nextId: 10 } } }
    ] as any[];
    const ctx = createMockCtx(entries);
    await handler('session_start', ctx);

    // Verify state by listing
    const result = await capturedTool.execute('list', { action: 'list' }, undefined, undefined, mockCtx);
    expect(result.content[0].text).toContain('#5');
    expect(result.details.nextId).toBe(10);
  });

  it('should accept JSON string parameters', async () => {
    registerMemoryTool(mockApi);
    const result = await capturedTool.execute('add', '{"action":"add","text":"From JSON"}', undefined, undefined, mockCtx);
    expect(result.content[0].text).toContain('Stored memory #1');
    expect(mockApi.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ text: 'From JSON' }));
  });

  it('should handle unknown action', async () => {
    registerMemoryTool(mockApi);
    const result = await capturedTool.execute('unknown', { action: 'foo' }, undefined, undefined, mockCtx);
    expect(result.content[0].text).toBe('Unknown action: foo');
  });

  it('should search with no results', async () => {
    registerMemoryTool(mockApi);
    await capturedTool.execute('a1', { action: 'add', text: 'Alpha' }, undefined, undefined, mockCtx);
    const result = await capturedTool.execute('search', { action: 'search', query: 'beta' }, undefined, undefined, mockCtx);
    expect(result.content[0].text).toContain('Found 0 of 1 memories');
  });

  describe('MemoryListComponent', () => {
    let theme: any;
    let onClose: any;

    beforeEach(() => {
      onClose = vi.fn();
      theme = {
        fg: (color: string, text: string) => text, // ignore color
        dim: (text: string) => `dim:${text}`,
        accent: 'accent', // not used directly
        muted: 'muted',
        text: 'text',
        warning: 'warning',
        success: 'success',
      };
    });

    it('should render empty list', () => {
      const comp = new MemoryListComponent([], theme, onClose);
      const lines = comp.render(80);
      expect(lines.some(l => l.includes('No memories stored.'))).toBe(true);
    });

    it('should render memories with truncation', () => {
      const longText = 'A very long text that exceeds the preview limit and should be truncated appropriately.';
      const memories: Memory[] = [
        { id: 1, text: 'Short' },
        { id: 2, text: longText },
      ];
      const comp = new MemoryListComponent(memories, theme, onClose);
      const lines = comp.render(80);
      const joined = lines.join('');
      expect(joined).toContain('#1');
      expect(joined).toContain('Short');
      // The long text should be truncated to 60 chars + '...'
      const truncated = `${longText.substring(0, 60)  }...`;
      expect(joined).toContain(truncated);
    });

    it('should render tags', () => {
      const memories: Memory[] = [
        { id: 1, text: 'Tagged', tags: ['project', 'important'] },
      ];
      const comp = new MemoryListComponent(memories, theme, onClose);
      const lines = comp.render(80);
      expect(lines.join('')).toContain('[project, important]');
    });

    it('should limit to maxShow (50)', () => {
      const memories: Memory[] = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, text: `Mem ${i}` }));
      const comp = new MemoryListComponent(memories, theme, onClose);
      const lines = comp.render(80);
      expect(lines.join('')).toContain('...and 10 more');
    });

    it('should cache renders', () => {
      const comp = new MemoryListComponent([{ id: 1, text: 'Test' }], theme, onClose);
      const lines1 = comp.render(80);
      const lines2 = comp.render(80);
      expect(lines1).toBe(lines2); // same reference
    });

    it('invalidate should clear cache', () => {
      const comp = new MemoryListComponent([{ id: 1, text: 'Test' }], theme, onClose);
      const lines1 = comp.render(80);
      expect(comp['cachedLines']).toBe(lines1);
      comp.invalidate();
      expect(comp['cachedLines']).toBeUndefined();
      const lines2 = comp.render(80);
      expect(comp['cachedLines']).toBe(lines2);
      expect(lines2).not.toBe(lines1); // new render produced new array
    });

    // To access private fields for check, we can use bracket notation
  });

  // Additional tool render tests to increase coverage
  describe('tool renderResult coverage', () => {
    let mockApi: any;
    let capturedTool: any;
    let mockCtx: any;

    beforeEach(() => {
      mockApi = {
        registerTool: vi.fn((tool: any) => { capturedTool = tool; }),
        sendMessage: vi.fn(),
        on: vi.fn(),
      };
      mockCtx = { sessionManager: { getBranch: () => [] }, hasUI: true } as any;
      registerMemoryTool(mockApi);
    });

    it('renderResult covers partial and error branches', () => {
      const theme = { fg: () => '' } as any;
      const resultPartial = { content: [{ type: 'text', text: '' }], details: {} } as any;
      const renderedPartial = capturedTool.renderResult(resultPartial, { expanded: false, isPartial: true }, theme, mockCtx);
      expect(renderedPartial).toBeDefined();

      const resultError = { content: [{ type: 'text', text: '' }], details: { error: 'err' } } as any;
      const renderedError = capturedTool.renderResult(resultError, { expanded: false, isPartial: false }, theme, mockCtx);
      expect(renderedError).toBeDefined();
    });
  });
});
