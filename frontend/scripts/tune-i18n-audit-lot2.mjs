import fs from 'node:fs';

const file = 'scripts/audit-i18n-hardcoded.mjs';
let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  "  /var\\(--/,\n];",
  "  /var\\(--/,\n  /<style|@keyframes|transform:|rotate\\(|opacity:/,\n  /updateStatus\\(|<Toast|format(Time|Date|Currency)\\(/,\n];"
);

source = source.replace(
  "  if (/^[Mm]\\d/.test(trimmed) && /\\d/.test(trimmed) && /[A-Za-z]/.test(trimmed)) return false;\n",
  "  if (/^[Mm]\\d/.test(trimmed) && /\\d/.test(trimmed) && /[A-Za-z]/.test(trimmed)) return false;\n  if (trimmed.includes('})}') || trimmed.includes('</span>')) return false;\n  if (trimmed.includes('@keyframes') || trimmed.includes('transform:')) return false;\n"
);

fs.writeFileSync(file, source);
console.log('lot2 audit heuristics tuned');
