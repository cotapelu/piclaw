// Quick test: Gọi skill_reader từ compiled dist
import { createSkillLoaderTool } from './dist/extensions/tools/skill-reader.js';

const tool = createSkillLoaderTool();

console.log('=== Testing skill_reader ===\n');

// Test 1: list skills
console.log('Test 1: read_skill args:{}');
const result1 = await tool.execute(
  'test-call-1',
  { command: 'read_skill', args: {} },
  undefined,
  undefined,
  { session: { cwd: process.cwd() } }
);
console.log('stdout:\n', result1.content[0].text);
console.log('isError:', result1.isError);
console.log('\n---\n');

// Test 2: get debugger skill
console.log('Test 2: read_skill args:{skill:"debugger"}');
const result2 = await tool.execute(
  'test-call-2',
  { command: 'read_skill', args: { skill: 'debugger' } },
  undefined,
  undefined,
  { session: { cwd: process.cwd() } }
);
console.log('stdout (first 500 chars):\n', result2.content[0].text.substring(0, 500));
console.log('isError:', result2.isError);
console.log('\n---\n');

// Test 3: invalid skill
console.log('Test 3: read_skill args:{skill:"nonexistent"}');
const result3 = await tool.execute(
  'test-call-3',
  { command: 'read_skill', args: { skill: 'nonexistent' } },
  undefined,
  undefined,
  { session: { cwd: process.cwd() } }
);
console.log('stdout:', result3.content[0].text);
console.log('stderr:', result3.details?.error || 'n/a');
console.log('isError:', result3.isError);
