const fs = require('fs');
const buf = fs.readFileSync('C:\\Users\\Dell\\Desktop\\SchoolERP\\artifacts\\school-erp\\src\\App.tsx');

const DOTS = Buffer.from('...', 'utf8');
const EM_DASH = Buffer.from('\u2014', 'utf8');
const RS0 = Buffer.from('Rs. 0', 'utf8');
const APOSTROPHE = Buffer.from("'", 'utf8');

const replacements = [
  { start: 373899, len: 19124, replace: DOTS },
  { start: 350900, len: 19124, replace: DOTS },
  { start: 323344, len: 22336, replace: EM_DASH },
  { start: 300430, len: 22336, replace: APOSTROPHE },
  { start: 280613, len: 19124, replace: DOTS },
  { start: 255158, len: 19124, replace: DOTS },
  { start: 235736, len: 19124, replace: DOTS },
  { start: 216065, len: 19124, replace: DOTS },
  { start: 203852, len: 11976, replace: EM_DASH },
  { start: 190719, len: 11976, replace: EM_DASH },
  { start: 178509, len: 11976, replace: EM_DASH },
  { start: 166101, len: 11976, replace: EM_DASH },
  { start: 153997, len: 11976, replace: EM_DASH },
  { start: 133172, len: 19124, replace: DOTS },
  { start: 106471, len: 19124, replace: DOTS },
  { start: 74218, len: 22336, replace: EM_DASH },
  { start: 51786, len: 22336, replace: EM_DASH },
  { start: 29027, len: 22336, replace: APOSTROPHE },
  { start: 1728, len: 22336, replace: RS0 }
];

let chunks = [];
let pos = 0;

for (const r of replacements) {
  chunks.push(buf.slice(pos, r.start));
  chunks.push(r.replace);
  pos = r.start + r.len;
}
chunks.push(buf.slice(pos));

const result = Buffer.concat(chunks);
fs.writeFileSync('C:\\Users\\Dell\\Desktop\\SchoolERP\\artifacts\\school-erp\\src\\App.tsx', result);
console.log('Old:', buf.length, 'New:', result.length, 'Removed:', buf.length - result.length, 'bytes');
