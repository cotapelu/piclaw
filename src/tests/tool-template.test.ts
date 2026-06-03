import { describe, it, expect } from 'vitest';
import { createYourTool } from '../extensions/tools/tool-template.js';

describe('tool-template', () => {
  it('should create tool definition with required fields', () => {
    const tool = createYourTool();
    expect(tool).toHaveProperty('name');
    expect(tool).toHaveProperty('label');
    expect(tool).toHaveProperty('description');
    expect(tool).toHaveProperty('promptGuidelines');
    expect(tool).toHaveProperty('parameters');
    // Check default name/label from template
    expect(tool.name).toBe('tool_template');
    expect(tool.label).toBe('Tool Template');
    // promptGuidelines should include example_command and another_command
    const guidelines = tool.promptGuidelines as string[];
    expect(Array.isArray(guidelines)).toBe(true);
    expect(guidelines.some(g => g.includes('example_command'))).toBe(true);
    expect(guidelines.some(g => g.includes('another_command'))).toBe(true);
  });
});
