#!/usr/bin/env node
'use strict';

// Garde-fou anti-dérive Web/Market — frontend (docs/PLATFORM_SPLIT_WEB_MARKET.md,
// Phase 6a). Même principe que scripts/check-web-market-boundaries.mjs côté
// backend : path-based, pas de liste de noms à maintenir. Un import relatif
// depuis frontend/src/web/ qui résout vers frontend/src/market/ (ou
// l'inverse) est une violation, sauf exception documentée ci-dessous.
//
// Usage : node scripts/check-web-market-boundaries-frontend.mjs
// Exit 0 si aucune violation, exit 1 sinon.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SRC_ROOT = join(REPO_ROOT, 'frontend', 'src');
const WEB_ROOT = join(SRC_ROOT, 'web');
const MARKET_ROOT = join(SRC_ROOT, 'market');

// Exceptions connues et documentées — couplages produit intentionnels,
// trouvés en construisant ce garde-fou (voir docs/PLATFORM_SPLIT_WEB_MARKET.md) :
// - discover/ArticlePage (WEB) affiche des produits marketplace réels liés
//   à l'article (ProductCard, MARKET).
// - MarketplacePage (MARKET) fait une promo croisée vers Gaming Hub (WEB).
// - BusinessSeoView (MARKET, SEO commerce) réutilise un composant de carte
//   d'article du magazine Discover (WEB) pour du contenu éditorial lié.
const KNOWN_EXCEPTIONS = new Set([
  'frontend/src/web/pages/discover/ArticlePage.jsx:../../../market/components/marketplace/ProductCard',
  'frontend/src/market/pages/MarketplacePage.jsx:../../web/modules/gaminghub/components/GamingHubPromoCard',
  'frontend/src/market/pages/seo/BusinessSeoView.jsx:../../../web/pages/discover/magazine/MagazineArticleCard',
  'frontend/src/market/pages/seo/RestaurantSeoView.jsx:../../../web/pages/discover/magazine/MagazineArticleCard',
]);

const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const IMPORT_RE = /(?:require\(\s*|from\s*|import\s*\(\s*|import\s*)(['"])(\.\.?\/[^'"]+)\1/g;

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
  console.log('✓ Aucun import croisé src/web ↔ src/market (frontend).');
  process.exit(0);
}

console.error(`✗ ${violations.length} import(s) croisé(s) Web↔Market détecté(s) :\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} → arbre "${v.forbiddenLabel}"`);
  console.error(`    ${v.code}\n`);
}
process.exit(1);
