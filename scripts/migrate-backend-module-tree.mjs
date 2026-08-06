#!/usr/bin/env node
'use strict';

// Codemod Phase 5b (docs/PLATFORM_SPLIT_WEB_MARKET.md) : déplace
// backend/src/modules/<X> vers backend/src/{web,market,shared}/<X> (même
// profondeur, pas de niveau supplémentaire — voir le plan pour pourquoi ça
// préserve la quasi-totalité des imports existants) et réécrit les seuls
// imports relatifs qui référencent effectivement un autre module par son nom.
//
// Usage :
//   node scripts/migrate-backend-module-tree.mjs            # dry-run (rien n'est écrit)
//   node scripts/migrate-backend-module-tree.mjs --apply     # réécrit les fichiers + déplace les dossiers (fs, pas git mv — le commit se charge de git add -A ensuite)

import { readdirSync, statSync, readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const BACKEND_ROOT = join(REPO_ROOT, 'backend');
const OLD_MODULES_ROOT = join(BACKEND_ROOT, 'src', 'modules');

const APPLY = process.argv.includes('--apply');

const MODULE_GROUPS = {
  web: [
    'discover', 'comics', 'gaminghub', 'play', 'portals', 'study',
    'digitalProducts', 'narration', 'ai-import', 'ai-publisher', 'ads', 'portalHero',
  ],
  market: [
    'resto', 'cantine', 'hanout', 'pharmacy', 'pos', 'delivery', 'loyalty',
    'orders', 'catalog', 'businesses', 'marketplaceHero', 'storeHero',
    'reviews', 'dashboard', 'acquisition', 'marketplace', 'reservations',
  ],
  shared: [
    'auth', 'users', 'organizations', 'notifications', 'media', 'seo',
    'payments', 'admin', 'infra',
  ],
};

// name -> { oldDir, newDir }
const MODULE_MAP = new Map();
for (const [group, names] of Object.entries(MODULE_GROUPS)) {
  for (const name of names) {
    MODULE_MAP.set(name, {
      oldDir: join(OLD_MODULES_ROOT, name),
      newDir: join(BACKEND_ROOT, 'src', group, name),
    });
  }
}

const IGNORE_DIRS = new Set(['node_modules', '.git', 'uploads', 'dist', 'dist-server', 'ssr-dist', 'storage', 'backups']);
const CODE_EXT = new Set(['.js', '.ts', '.mjs', '.cjs']);

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFilesRecursive(full));
    else if (CODE_EXT.has(entry.slice(entry.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

// Retourne { oldDir, newDir } du module dont `absPath` (fichier ou dossier)
// est sous-chemin, ou null si absPath n'est sous aucun des 38 modules.
function findContainingModule(absPath) {
  for (const { oldDir, newDir } of MODULE_MAP.values()) {
    if (absPath === oldDir || absPath.startsWith(oldDir + sep)) {
      return { oldDir, newDir };
    }
  }
  return null;
}

function remapPath(absPath) {
  const mod = findContainingModule(absPath);
  if (!mod) return absPath; // ne bouge pas
  return mod.newDir + absPath.slice(mod.oldDir.length);
}

function toImportString(relPath) {
  // path.relative() ne préfixe pas par "./" — les imports relatifs du repo
  // le font systématiquement pour le même dossier (jamais de "foo" nu).
  if (!relPath.startsWith('.')) relPath = './' + relPath;
  return relPath;
}

const IMPORT_RE = /(?:require\(\s*|from\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\1/g;

const allFiles = listFilesRecursive(BACKEND_ROOT);
let filesChanged = 0;
let importsChanged = 0;
const report = [];

for (const file of allFiles) {
  const content = readFileSync(file, 'utf8');
  const fileOldDir = dirname(file);
  const fileNewDir = remapPath(fileOldDir);

  const edits = []; // { start, end, oldStr, newStr }
  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(content))) {
    const importPath = match[2];
    const pathStart = match.index + match[0].length - 1 - importPath.length;
    const pathEnd = pathStart + importPath.length;

    const targetOldAbs = resolve(fileOldDir, importPath);
    const targetNewAbs = remapPath(targetOldAbs);
    if (targetNewAbs === targetOldAbs && fileNewDir === fileOldDir) continue; // rien ne bouge pour cet import

    const newRelRaw = relative(fileNewDir, targetNewAbs);
    const newImportPath = toImportString(newRelRaw);
    if (newImportPath === importPath) continue;

    edits.push({ start: pathStart, end: pathEnd, oldStr: importPath, newStr: newImportPath });
  }

  if (edits.length === 0) continue;

  filesChanged++;
  importsChanged += edits.length;
  report.push({ file: relative(REPO_ROOT, file), newFile: relative(REPO_ROOT, join(fileNewDir, file.slice(fileOldDir.length + 1))), edits });

  if (APPLY) {
    // Appliquer en partant de la fin pour ne pas invalider les offsets précédents.
    let newContent = content;
    for (const e of [...edits].sort((a, b) => b.start - a.start)) {
      newContent = newContent.slice(0, e.start) + e.newStr + newContent.slice(e.end);
    }
    writeFileSync(file, newContent, 'utf8');
  }
}

console.log(`${APPLY ? 'APPLIQUÉ' : 'DRY-RUN'} — ${filesChanged} fichier(s), ${importsChanged} import(s) réécrit(s).\n`);
for (const r of report) {
  console.log(`${r.file}${r.file !== r.newFile ? ' → ' + r.newFile : ''}`);
  for (const e of r.edits) console.log(`    ${e.oldStr}  →  ${e.newStr}`);
}

if (APPLY) {
  console.log('\n--- déplacement physique des dossiers de module ---');
  for (const [name, { oldDir, newDir }] of MODULE_MAP.entries()) {
    if (!existsSync(oldDir)) { console.log(`  (absent, ignoré) ${name}`); continue; }
    mkdirSync(dirname(newDir), { recursive: true });
    renameSync(oldDir, newDir);
    console.log(`  ${name}: ${relative(REPO_ROOT, oldDir)} → ${relative(REPO_ROOT, newDir)}`);
  }
}
