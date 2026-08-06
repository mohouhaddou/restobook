#!/usr/bin/env node
'use strict';

// Garde-fou anti-dérive Web/Market (docs/PLATFORM_SPLIT_WEB_MARKET.md, Phase 5a).
// Interdit structurellement les imports directs entre les modules backend
// classés WEB (portails de contenu) et MARKET (marketplace/commerce) — la
// classification vient du tableau de classification établi en Phase 0.
// N'importe quel import vers un module "shared" (auth, users, media, seo,
// payments, admin, infra, ...) reste autorisé des deux côtés, sans
// restriction : ce sont les seules dépendances communes acceptées.
//
// Usage : node scripts/check-web-market-boundaries.mjs
// Exit 0 si aucune violation, exit 1 sinon (liste fichier:ligne + cible).

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const MODULES_ROOT = join(REPO_ROOT, 'backend', 'src', 'modules');

const WEB_MODULES = [
  'discover', 'comics', 'gaminghub', 'play', 'portals', 'study',
  'digitalProducts', 'narration', 'ai-import', 'ai-publisher', 'ads', 'portalHero',
];

const MARKET_MODULES = [
  'resto', 'cantine', 'hanout', 'pharmacy', 'pos', 'delivery', 'loyalty',
  'orders', 'catalog', 'businesses', 'marketplaceHero', 'storeHero',
  'reviews', 'dashboard', 'acquisition',
];

// Exceptions connues et documentées — pas des bugs de ce script, mais de la
// dette technique déjà identifiée : le moteur de scheduling/traitement
// d'image des hero carousels est volontairement partagé entre marketplace,
// store et portails (voir docs/PLATFORM_SPLIT_WEB_MARKET.md), mais vit
// physiquement dans marketplaceHero/services/ au lieu d'un module partagé
// dédié. À corriger en Phase 5b (extraction physique) ; en attendant, ces
// imports précis sont tolérés pour que ce script reste un vrai signal "0 =
// propre" plutôt qu'un bruit permanent. Toute AUTRE violation continue de
// faire échouer le check.
const KNOWN_EXCEPTIONS = new Set([
  'backend/src/modules/portalHero/adminRoutes.js:../marketplaceHero/services/heroSchedulingService',
  'backend/src/modules/portalHero/adminRoutes.js:../marketplaceHero/services/heroImageService',
  'backend/src/modules/portalHero/publicRoutes.js:../marketplaceHero/services/heroSchedulingService',
]);

const CODE_EXT = new Set(['.js', '.ts', '.mjs', '.cjs']);
// require('...') ou import/export ... from '...' — capture uniquement les
// chemins relatifs (../ ou ./), les seuls susceptibles de traverser un autre
// module backend. Les imports par paquet npm (@ifilino/shared, express, ...)
// sont ignorés, hors de portée de ce garde-fou.
const IMPORT_RE = /(?:require\(\s*|from\s+|import\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g;

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFilesRecursive(full));
    else if (CODE_EXT.has(entry.slice(entry.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

function targetModuleName(resolvedAbsPath) {
  const rel = relative(MODULES_ROOT, resolvedAbsPath);
  if (rel.startsWith('..')) return null; // hors de backend/src/modules
  return rel.split('/')[0];
}

function scanGroup(groupModules, forbiddenModules, forbiddenLabel) {
  const violations = [];
  for (const moduleName of groupModules) {
    const moduleDir = join(MODULES_ROOT, moduleName);
    let files;
    try {
      files = listFilesRecursive(moduleDir);
    } catch {
      continue; // module absent (renommé/déplacé) — pas notre problème ici
    }
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      let match;
      IMPORT_RE.lastIndex = 0;
      while ((match = IMPORT_RE.exec(content))) {
        const importPath = match[1];
        const resolved = resolve(dirname(file), importPath);
        const target = targetModuleName(resolved);
        if (target && forbiddenModules.includes(target)) {
          const fileRel = relative(REPO_ROOT, file);
          if (KNOWN_EXCEPTIONS.has(`${fileRel}:${importPath}`)) continue;
          const lineNo = content.slice(0, match.index).split('\n').length;
          violations.push({
            file: fileRel,
            line: lineNo,
            code: lines[lineNo - 1]?.trim(),
            target,
            forbiddenLabel,
          });
        }
      }
    }
  }
  return violations;
}

const webToMarket = scanGroup(WEB_MODULES, MARKET_MODULES, 'MARKET');
const marketToWeb = scanGroup(MARKET_MODULES, WEB_MODULES, 'WEB');
const violations = [...webToMarket, ...marketToWeb];

if (violations.length === 0) {
  console.log(`✓ Aucun import croisé Web↔Market (${WEB_MODULES.length} modules web, ${MARKET_MODULES.length} modules market scannés).`);
  process.exit(0);
}

console.error(`✗ ${violations.length} import(s) croisé(s) Web↔Market détecté(s) :\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} → module ${v.forbiddenLabel} "${v.target}"`);
  console.error(`    ${v.code}\n`);
}
process.exit(1);
