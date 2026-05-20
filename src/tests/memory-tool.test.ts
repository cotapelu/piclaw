import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerMemoryTool } from '../extensions/tools/memory-tool.js';
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
});
