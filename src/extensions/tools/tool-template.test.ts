import { describe, it, expect } from 'vitest';
import { createYourTool } from './tool-template.ts';

describe('tool-template (basic)', () => {
  it('should create tool definition with correct name and label', () => {
    const tool = createYourTool();
    expect(tool.name).toBe('tool_template');
    expect(tool.label).toBe('Tool Template');
  });

  it('should have correct description and parameters', () => {
    const tool = createYourTool();
    expect(tool.description).toContain('Multi-command tool');
    expect(tool.parameters).toEqual({
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: ['example_command', 'another_command'],
          description: 'Tên sub-command để thực thi'
        },
        args: {
          type: 'object',
          description: 'Arguments cho command cụ thể (xem schema của từng command)'
        }
      },
      required: ['command', 'args']
    });
  });

  it('should include commandMeta with example_command metadata', () => {
    const tool = createYourTool();
    expect(tool.commandMeta).toBeDefined();
    expect(tool.commandMeta.example_command).toBeDefined();
    expect(tool.commandMeta.example_command.description).toBe('Mô tả ngắn về command này');
    expect(tool.commandMeta.example_command.schema).toBeDefined();
    expect(tool.commandMeta.example_command.examples).toContain('your_tool_name({ command: \'example_command\', args: { input: \'data.txt\' } })');
  });

  it('should include commandMeta with another_command metadata', () => {
    const tool = createYourTool();
    expect(tool.commandMeta.another_command).toBeDefined();
    expect(tool.commandMeta.another_command.description).toBe('Một command khác');
    expect(tool.commandMeta.another_command.schema).toBeDefined();
    expect(tool.commandMeta.another_command.examples).toContain('your_tool_name({ command: \'another_command\', args: { files: [\'a.txt\', \'b.txt\'] } })');
  });

  it('execute should return error for unknown command', async () => {
    const tool = createYourTool();
    const result = await tool.execute('id', { command: 'unknown', args: {} }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown command');
    expect(result.content[0].text).toContain('example_command, another_command');
  });

  it('execute with empty args should return discovery help', async () => {
    const tool = createYourTool();
    const result = await tool.execute('id', { command: 'example_command', args: {} }, undefined, undefined, {});
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('example_command');
    expect(text).toContain('Description');
    expect(text).toContain('Arguments:');
    expect(text).toContain('input* (string): Đường dẫn file đầu vào');
  });
});
