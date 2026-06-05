import { readFile } from 'node:fs/promises';
const cov = JSON.parse(await readFile('./coverage/coverage-final.json', 'utf8'));
// Find the entry for todos-tool.ts
let entry = null;
for (const [key, val] of Object.entries(cov)) {
  if (key.includes('todos-tool.ts')) {
    entry = val;
    break;
  }
}
if (!entry) {
  console.error('No coverage data for todos-tool.ts');
  process.exit(1);
}
const s = entry.s;
const lines = Object.keys(s).map(Number).sort((a,b)=>a-b);
const total = lines.length;
const hit = lines.filter(l => s[l] > 0).length;
const missed = total - hit;
console.log(`Total executable lines: ${total}`);
console.log(`Hit: ${hit}, Missed: ${missed}, Coverage: ${((hit/total)*100).toFixed(2)}%`);
// Find ranges of missed lines
const missedLines = lines.filter(l => s[l] === 0);
console.log('Missed line numbers (first 50):', missedLines.slice(0, 50).join(', '));