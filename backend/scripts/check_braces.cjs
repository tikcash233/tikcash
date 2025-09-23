const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '../src/server.js');
const s = fs.readFileSync(p, 'utf8');
const counts = { '{':0, '}':0, '(':0, ')':0, '[':0, ']':0, '`':0 };
for (const ch of s) { if (counts.hasOwnProperty(ch)) counts[ch]++; }
console.log('counts:', counts);
// find last 400 chars for inspection
console.log('\n--- tail ---\n', s.slice(-400));
