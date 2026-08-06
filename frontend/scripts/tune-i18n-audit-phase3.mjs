import fs from 'node:fs';

const file = 'scripts/audit-i18n-hardcoded.mjs';
let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  "  /API\\(|fetch\\(|URLSearchParams|new\\s+RegExp/,\n];",
  "  /API\\(|fetch\\(|URLSearchParams|new\\s+RegExp/,\n  /\\bt\\(/,\n  /<path\\s+d=|<circle|<line|<svg/,\n  /var\\(--/,\n];"
);

source = source.replace(
  "  if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return false;\n",
  "  if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return false;\n  if (/^var\\(--[\\w-]+\\)$/.test(trimmed)) return false;\n  if (/^[Mm]\\d/.test(trimmed) && /\\d/.test(trimmed) && /[A-Za-z]/.test(trimmed)) return false;\n"
);

fs.writeFileSync(file, source);
console.log('i18n audit heuristics tuned');
