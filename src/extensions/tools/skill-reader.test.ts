import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSkillLoaderTool, registerSkillReaderExtension } from './skill-reader.ts';

describe('skill-reader tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create tool definition with correct metadata', () => {
    const tool = createSkillLoaderTool();
    expect(tool.name).toBe('skill_reader');
    expect(tool.label).toBe('Skill Reader');
    expect(tool.description).toContain('Retrieve skill .md');
    expect(tool.parameters).toBeDefined();
    expect(tool.parameters.properties.command.enum).toContain('read_skill');
  });

  it('execute with unknown command returns error', async () => {
    const tool = createSkillLoaderTool();
    const result = await tool.execute('test-call', { command: 'unknown', args: {} }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown command');
  });

  it('execute with empty args returns discovery help for read_skill', async () => {
    const tool = createSkillLoaderTool();
    const result = await tool.execute('test-call', { command: 'read_skill', args: {} }, undefined, undefined, {});
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('read_skill');
    expect(text).toContain('Description');
    expect(text).toContain('Arguments');
  });

  it('registerSkillReaderExtension registers tool with API', () => {
    const api = { registerTool: vi.fn() };
    registerSkillReaderExtension(api as any);
    expect(api.registerTool).toHaveBeenCalledTimes(1);
    expect(api.registerTool).toHaveBeenCalledWith(expect.any(Object));
  });

  it('execute with real command loads skill content (integration)', async () => {
    const tool = createSkillLoaderTool();
    // Use the real command module (no mocking)
    const result = await tool.execute('test-call', { command: 'read_skill', args: { skill: 'audit' } }, undefined, undefined, {
      session: { cwd: process.cwd() }
    });

    // If there's an error, print for debugging
    if (result.isError) {
      console.error('Integration error:', result.content[0].text);
    }
    expect(result.isError).toBe(false);
    // Audit skill should contain header
    expect(result.content[0].text).toContain('# Audit');
  });
});
