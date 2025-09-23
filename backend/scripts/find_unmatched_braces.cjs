const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '../src/server.js');
const s = fs.readFileSync(p, 'utf8');
let balance = 0;
let maxBalance = 0;
let maxPos = 0;
for (let i=0;i<s.length;i++){
  const ch = s[i];
  if (ch === '{') balance++;
  else if (ch === '}') balance--;
  if (balance > maxBalance) { maxBalance = balance; maxPos = i; }
}
console.log('final balance:', balance, 'maxBalance:', maxBalance, 'maxPos:', maxPos);
// print context around maxPos
const start = Math.max(0, maxPos-200);
const end = Math.min(s.length, maxPos+200);
console.log('\n--- context around maxBalance pos ---\n');
console.log(s.slice(start,end));
// print last 400 chars
console.log('\n--- tail ---\n');
console.log(s.slice(-400));
