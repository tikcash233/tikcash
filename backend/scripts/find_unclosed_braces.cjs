const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '../src/server.js');
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);
let balance = 0;
let maxBalance = 0;
let maxLine = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const ch of line) {
    if (ch === '{') balance++;
    else if (ch === '}') balance--;
  }
  if (balance > maxBalance) { maxBalance = balance; maxLine = i + 1; }
}
console.log('maxBalance (opens minus closes):', maxBalance, 'at line', maxLine);
console.log('\n--- context around max line ---\n');
const start = Math.max(0, maxLine - 10);
const end = Math.min(lines.length, maxLine + 10);
for (let i = start; i < end; i++) {
  console.log((i+1).toString().padStart(5), lines[i]);
}
