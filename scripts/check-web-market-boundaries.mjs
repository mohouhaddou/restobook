#!/usr/bin/env node
'use strict';

// Garde-fou anti-dérive Web/Market (docs/PLATFORM_SPLIT_WEB_MARKET.md).
// Depuis la Phase 5b, backend/src/{web,market,shared}/ sont trois arbres
// physiquement séparés (plus un seul src/modules/ avec deux listes de noms)
// — un simple `require('../../market/...')` depuis src/web/ est directement
// une violation, plus besoin de mapper des noms de dossier à un groupe.
// N'importe quel import vers src/shared/ reste autorisé des deux côtés.
//
// Usage : node scripts/check-web-market-boundaries.mjs
// Exit 0 si aucune violation, exit 1 sinon (liste fichier:ligne + cible).

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SRC_ROOT = join(REPO_ROOT, 'backend', 'src');
const WEB_ROOT = join(SRC_ROOT, 'web');
const MARKET_ROOT = join(SRC_ROOT, 'market');

// Exceptions connues et documentées — pas des bugs de ce script. Trouvée en
// Phase 5b (invisible à l'ancienne version du script, qui avait oublié
// "marketplace" et "reservations" dans sa liste MARKET_MODULES) :
// discover/articleService.js (WEB, magazine éditorial) consomme la vraie
// logique métier marketplace (recherche produits, détail produit) pour
// permettre aux articles de référencer/afficher des produits réels — un
// couplage produit intentionnel, pas un utilitaire homeless comme l'était
// le moteur hero. Décider de le découpler (ex: appel API interne plutôt que
// require direct) est une décision produit, pas prise ici. Voir
// docs/PLATFORM_SPLIT_WEB_MARKET.md.
const KNOWN_EXCEPTIONS = new Set([
  'backend/src/web/discover/articleService.js:../../market/marketplace/productDetailService',
  'backend/src/web/discover/articleService.js:../../market/marketplace/productSearchService',
]);

const CODE_EXT = new Set(['.js', '.ts', '.mjs', '.cjs']);
// require('...') ou import/export ... from '...' — capture uniquement les
// chemins relatifs (../ ou ./), les seuls susceptibles de traverser un autre
// arbre backend. Les imports par paquet npm (@ifilino/shared, express, ...)
// sont ignorés, hors de portée de ce garde-fou.
const IMPORT_RE = /(?:require\(\s*|from\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\1/g;

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

function isUnder(root, absPath) {
  return absPath === root || absPath.startsWith(root + '/');
}

function scanTree(sourceRoot, forbiddenRoot, forbiddenLabel) {
  const violations = [];
  if (!existsSync(sourceRoot)) return violations;
  for (const file of listFilesRecursive(sourceRoot)) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let match;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(content))) {
      const importPath = match[2];
      const resolved = resolve(dirname(file), importPath);
      if (!isUnder(forbiddenRoot, resolved)) continue;

      const fileRel = relative(REPO_ROOT, file);
      if (KNOWN_EXCEPTIONS.has(`${fileRel}:${importPath}`)) continue;
      const lineNo = content.slice(0, match.index).split('\n').length;
      violations.push({
        file: fileRel,
        line: lineNo,
        code: lines[lineNo - 1]?.trim(),
        forbiddenLabel,
      });
    }
  }
  return violations;
}

const webToMarket = scanTree(WEB_ROOT, MARKET_ROOT, 'market');
const marketToWeb = scanTree(MARKET_ROOT, WEB_ROOT, 'web');
const violations = [...webToMarket, ...marketToWeb];

if (violations.length === 0) {
  console.log('✓ Aucun import croisé src/web ↔ src/market.');
  process.exit(0);
}

console.error(`✗ ${violations.length} import(s) croisé(s) Web↔Market détecté(s) :\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} → arbre "${v.forbiddenLabel}"`);
  console.error(`    ${v.code}\n`);
}
process.exit(1);
