const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '../src/server.js');
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\n/);
let bal = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const ch of line) {
    if (ch === '{') bal++;
    if (ch === '}') bal--;
  }
  if (i < 80 || i > lines.length - 80) {
    console.log(String(i+1).padStart(4), 'bal=', String(bal).padStart(3), line);
  } else if (i % 100 === 0) {
    console.log(String(i+1).padStart(4), 'bal=', String(bal).padStart(3), '...');
  }
}
console.log('\nFINAL BALANCE:', bal, ' (expected 0)');
