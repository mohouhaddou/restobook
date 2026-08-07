#!/usr/bin/env node
'use strict';

// Codemod Phase 6a (docs/PLATFORM_SPLIT_WEB_MARKET.md) : regroupe
// frontend/src/{modules,pages,shared/components,config}/* vers
// frontend/src/{web,market,shared}/*. Contrairement au backend (Phase 5b),
// modules/ et pages/ ont 6 collisions de noms (gaminghub, hanout,
// marketplace, play, portals, study) — modules/ et pages/ sont donc
// préservés comme sous-niveaux (web/modules/X, web/pages/X) plutôt que
// fusionnés à plat, ce qui ajoute un niveau de profondeur pour ce qui
// était sous modules/ ou pages/ (plus de réécritures que le backend, même
// principe de correction sinon).
//
// Usage :
//   node scripts/migrate-frontend-module-tree.mjs            # dry-run
//   node scripts/migrate-frontend-module-tree.mjs --apply     # écrit + déplace

import { readdirSync, statSync, readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SRC = join(REPO_ROOT, 'frontend', 'src');
const APPLY = process.argv.includes('--apply');

// Chaque entrée : [ancien chemin relatif à frontend/src, nouveau chemin relatif ].
// Peut être un dossier ou un fichier — MOVES doit être trié pour qu'aucune
// entrée ne soit un sous-chemin d'une autre listée avant elle (sinon la
// résolution de remapPath prendrait la mauvaise correspondance en premier) ;
// on trie par longueur décroissante du chemin au chargement pour éviter le
// problème plutôt que de compter sur l'ordre d'écriture ci-dessous.
const MOVES = [
  // ── WEB : modules/ ──────────────────────────────────────────────────────
  ['modules/ai-command-center', 'web/modules/ai-command-center'],
  ['modules/ai-package-import', 'web/modules/ai-package-import'],
  ['modules/comics', 'web/modules/comics'],
  ['modules/comics-dashboard', 'web/modules/comics-dashboard'],
  ['modules/gaminghub', 'web/modules/gaminghub'],
  ['modules/gamification', 'web/modules/gamification'],
  ['modules/kids-profile', 'web/modules/kids-profile'],
  ['modules/kids-taxonomy', 'web/modules/kids-taxonomy'],
  ['modules/media', 'web/modules/media'],
  ['modules/play', 'web/modules/play'],
  ['modules/portals', 'web/modules/portals'],
  ['modules/subscriptions', 'web/modules/subscriptions'],

  // ── MARKET : modules/ (CustomerAuthContext.jsx extrait AVANT, voir plus bas) ──
  ['modules/cantine', 'market/modules/cantine'],
  ['modules/hanout', 'market/modules/hanout'],
  ['modules/marketplace', 'market/modules/marketplace'],
  ['modules/resto', 'market/modules/resto'],

  // ── SHARED : modules/ ────────────────────────────────────────────────────
  ['modules/admin', 'shared/modules/admin'],
  ['modules/auth', 'shared/modules/auth'],
  ['modules/core', 'shared/modules/core'],
  ['modules/notifications', 'shared/modules/notifications'],

  // ── Extraction spéciale AVANT le déplacement de modules/marketplace ─────
  ['modules/marketplace/CustomerAuthContext.jsx', 'shared/context/CustomerAuthContext.jsx'],

  // ── WEB : pages/ (dossiers) ──────────────────────────────────────────────
  ['pages/ads', 'web/pages/ads'],
  ['pages/discover', 'web/pages/discover'],
  ['pages/gaminghub', 'web/pages/gaminghub'],
  ['pages/kids', 'web/pages/kids'],
  ['pages/play', 'web/pages/play'],
  ['pages/portals', 'web/pages/portals'],
  ['pages/study', 'web/pages/study'],

  // ── MARKET : pages/ (dossiers) ───────────────────────────────────────────
  ['pages/dashboard', 'market/pages/dashboard'],
  ['pages/delivery', 'market/pages/delivery'],
  ['pages/hanout', 'market/pages/hanout'],
  ['pages/marketplace', 'market/pages/marketplace'],
  ['pages/marketplaceHero', 'market/pages/marketplaceHero'],
  ['pages/pharmacy', 'market/pages/pharmacy'],
  ['pages/pos', 'market/pages/pos'],
  ['pages/restaurant', 'market/pages/restaurant'],

  // ── pages/seo/ : éclaté fichier par fichier (mélangé, pas un bloc) ───────
  ['pages/seo/BusinessIndexSeoView.jsx', 'market/pages/seo/BusinessIndexSeoView.jsx'],
  ['pages/seo/BusinessSeoView.jsx', 'market/pages/seo/BusinessSeoView.jsx'],
  ['pages/seo/CityCategorySeoView.jsx', 'market/pages/seo/CityCategorySeoView.jsx'],
  ['pages/seo/CitySeoView.jsx', 'market/pages/seo/CitySeoView.jsx'],
  ['pages/seo/ProductSeoView.jsx', 'market/pages/seo/ProductSeoView.jsx'],
  ['pages/seo/RestaurantSeoView.jsx', 'market/pages/seo/RestaurantSeoView.jsx'],
  ['pages/seo/RestaurantsIndexSeoView.jsx', 'market/pages/seo/RestaurantsIndexSeoView.jsx'],
  ['pages/seo/HomeSeoView.jsx', 'market/pages/seo/HomeSeoView.jsx'],
  ['pages/seo/ArticleSeoView.jsx', 'web/pages/seo/ArticleSeoView.jsx'],
  ['pages/seo/DiscoverHomeSeoView.jsx', 'web/pages/seo/DiscoverHomeSeoView.jsx'],
  ['pages/seo/DiscoverRubriqueSeoView.jsx', 'web/pages/seo/DiscoverRubriqueSeoView.jsx'],
  ['pages/seo/GameSeoView.jsx', 'web/pages/seo/GameSeoView.jsx'],
  ['pages/seo/KidsSeoView.jsx', 'web/pages/seo/KidsSeoView.jsx'],
  ['pages/seo/PlayGameSeoView.jsx', 'web/pages/seo/PlayGameSeoView.jsx'],
  ['pages/seo/components/BusinessCard.jsx', 'market/pages/seo/components/BusinessCard.jsx'],
  ['pages/seo/components/BusinessReviewsSection.jsx', 'market/pages/seo/components/BusinessReviewsSection.jsx'],
  ['pages/seo/components/OpeningHours.jsx', 'market/pages/seo/components/OpeningHours.jsx'],
  ['pages/seo/components/Breadcrumbs.jsx', 'shared/seo/components/Breadcrumbs.jsx'],
  ['pages/seo/components/StarRating.jsx', 'shared/seo/components/StarRating.jsx'],

  // ── MARKET : pages/*.jsx à plat ──────────────────────────────────────────
  ...[
    'BusinessDashboardPage', 'CanteenPage', 'CheckoutPage', 'DashboardPage',
    'DeliveryPage', 'DeliveryRegisterPage', 'DeliveryZonesPricingPage',
    'ItemsPage', 'LoyaltyPage', 'LoyaltyProgramPage', 'LoyaltySettingsPage',
    'MarketplacePage', 'NutritionAIPage', 'OrdersPage', 'OrderTrackingPage',
    'PlanningPage', 'PrepPage', 'ProductDetailPage', 'ProRegisterPage',
    'QrScanPage', 'QrTablePage', 'RestaurantConfigPage', 'RestaurantPage',
    'RestaurantSaasPage', 'SatisfactionPage', 'StatsPage', 'TablesPage',
  ].map(name => [`pages/${name}.jsx`, `market/pages/${name}.jsx`]),
  ['pages/TableReservationPage.jsx', 'market/pages/TableReservationPage.jsx'],
  ['pages/TableReservationPage.css', 'market/pages/TableReservationPage.css'],

  // ── SHARED : pages/*.jsx à plat ──────────────────────────────────────────
  ...[
    'CustomerAuthPage', 'LoginPage', 'NotificationPreferencesPage',
    'NotificationsPage', 'OrgsPage', 'ProfilePage', 'SettingsPage',
    'SubscriptionPage', 'UsersPage',
  ].map(name => [`pages/${name}.jsx`, `shared/pages/${name}.jsx`]),
  ['pages/LandingPage.jsx', 'shared/pages/LandingPage.jsx'],
  ['pages/LandingPage.css', 'shared/pages/LandingPage.css'],

  // ── shared/components/* mal classés (zéro consommateur de l'autre domaine) ──
  ['shared/components/portalHero', 'web/components/portalHero'],
  ['shared/markdown', 'web/markdown'],
  ['shared/components/marketplace', 'market/components/marketplace'],
  ['shared/components/storeHero', 'market/components/storeHero'],
  ['shared/components/shopping-list', 'market/components/shopping-list'],
  ['shared/components/catalog', 'market/components/catalog'],
  ['shared/components/dashboard', 'market/components/dashboard'],
  ['shared/components/geo', 'market/components/geo'],

  // ── config/*.js MARKET-only ──────────────────────────────────────────────
  ['config/needCategories.js', 'market/config/needCategories.js'],
  ['config/shoppingCategories.js', 'market/config/shoppingCategories.js'],
  ['config/businessConfig.js', 'market/config/businessConfig.js'],
]
  // Les entrées les plus longues (les plus spécifiques, ex: le fichier
  // CustomerAuthContext.jsx à l'intérieur de modules/marketplace) doivent
  // être vérifiées avant les plus courtes (le dossier modules/marketplace
  // entier) pour que remapPath() trouve la correspondance la plus précise.
  .sort((a, b) => b[0].length - a[0].length)
  .map(([oldRel, newRel]) => ({ oldDir: join(SRC, oldRel), newDir: join(SRC, newRel) }));

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-server']);
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

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

// Les specifiers d'import omettent presque toujours l'extension
// ('./Foo' pour Foo.jsx) — un déplacement de FICHIER (pas dossier) doit
// donc matcher même quand le chemin résolu n'a pas l'extension du fichier
// réel. Testé : sans ceci, un import extension-less vers un fichier déplacé
// retombait sur le match suivant (souvent le dossier parent, encore non
// déplacé), donnant un mauvais chemin de réécriture — piège trouvé en
// dry-run sur contexts/CustomerAuthContext.jsx avant application.
const EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

function findContainingMove(absPath) {
  for (const m of MOVES) {
    if (absPath === m.oldDir || absPath.startsWith(m.oldDir + sep)) return m;
    for (const ext of EXTS) {
      if (absPath + ext === m.oldDir) return m;
    }
  }
  return null;
}

function remapPath(absPath) {
  const m = findContainingMove(absPath);
  if (!m) return absPath;
  if (absPath === m.oldDir || absPath.startsWith(m.oldDir + sep)) {
    return m.newDir + absPath.slice(m.oldDir.length);
  }
  // Match par extension implicite (voir findContainingMove) : absPath n'a
  // pas de suffixe à préserver, c'est le fichier entier qui correspond.
  return m.newDir;
}

function toImportString(relPath) {
  if (!relPath.startsWith('.')) relPath = './' + relPath;
  // Convention du repo : jamais d'extension explicite sur un import relatif
  // JS/JSX/TS. Ne touche que les extensions JS-like connues (un vrai
  // ./Foo.css ne doit jamais perdre son extension).
  relPath = relPath.replace(/\.(jsx|tsx|ts|mjs|cjs|js)$/, '');
  return relPath;
}

// require('...') / from '...' / import('...') / import '...' (effet de
// bord, sans `from` — ex: `import "./shared/markdown/registerThemes";`
// dans main.jsx, cas réel manqué par une première version de cette regex
// qui n'avait que require(/from /import( — trouvé en testant vite dev en
// conditions réelles, pas au simple parse). Chemins relatifs uniquement.
// Les imports de fichiers non-JS (.css/.scss/.png/...) accolés à un
// composant bougent AVEC leur dossier via renameSync, pas besoin de
// réécrire leur chemin, sauf s'ils sont eux-mêmes listés dans MOVES
// (LandingPage.css, TableReservationPage.css).
// \s* (pas \s+) après from/import : plusieurs fichiers de ce repo sont
// minifiés en une ligne sans espace (`from'../../shared/services/api'`) —
// bug réel trouvé au `npm run build` (Rollup), pas au dry-run ni à vite dev
// sur d'autres pages : ce fichier précis (ComicsAccount.jsx) n'était
// simplement jamais passé dans les pages testées manuellement avant.
const IMPORT_RE = /(?:require\(\s*|from\s*|import\s*\(\s*|import\s*)(['"])(\.\.?\/[^'"]+)\1/g;

// Le nouveau dossier d'un fichier n'est PAS toujours remapPath(dirname(file)) :
// pour un déplacement de DOSSIER, oui (le dossier parent est dans MOVES).
// Mais pour un déplacement de FICHIER ISOLÉ (ex: pages/RestaurantPage.jsx →
// market/pages/RestaurantPage.jsx), c'est le FICHIER qui est dans MOVES, pas
// son dossier — remapPath(dirname(file)) ne trouve rien et retourne le
// dossier inchangé, donc les imports SORTANTS du fichier (../api,
// ../hooks/useApi...) ne sont jamais recalculés pour la nouvelle profondeur.
// Bug réel trouvé en testant vite dev en conditions réelles (~56 fichiers
// avec des imports cassés d'un cran) — un simple parse ne l'aurait pas vu.
function getFileNewDir(file) {
  const exactMove = MOVES.find(m => m.oldDir === file);
  if (exactMove) return dirname(exactMove.newDir);
  return remapPath(dirname(file));
}

const allFiles = listFilesRecursive(SRC);
let filesChanged = 0;
let importsChanged = 0;
const report = [];

for (const file of allFiles) {
  const content = readFileSync(file, 'utf8');
  const fileOldDir = dirname(file);
  const fileNewDir = getFileNewDir(file);

  const edits = [];
  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(content))) {
    const importPath = match[2];
    const pathStart = match.index + match[0].length - 1 - importPath.length;
    const pathEnd = pathStart + importPath.length;

    const targetOldAbs = resolve(fileOldDir, importPath);
    const targetNewAbs = remapPath(targetOldAbs);
    if (targetNewAbs === targetOldAbs && fileNewDir === fileOldDir) continue;

    const newRelRaw = relative(fileNewDir, targetNewAbs);
    const newImportPath = toImportString(newRelRaw);
    if (newImportPath === importPath) continue;

    edits.push({ start: pathStart, end: pathEnd, oldStr: importPath, newStr: newImportPath });
  }

  if (edits.length === 0) continue;
  filesChanged++;
  importsChanged += edits.length;
  const fileMove = findContainingMove(file);
  const newFile = fileMove ? fileNewDir + file.slice(fileOldDir.length) : file;
  report.push({ file: relative(REPO_ROOT, file), newFile: relative(REPO_ROOT, newFile), edits });

  if (APPLY) {
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
  console.log('\n--- déplacement physique ---');
  // Trier par longueur d'ancien chemin décroissante : déplacer d'abord
  // modules/marketplace/CustomerAuthContext.jsx AVANT modules/marketplace
  // lui-même (déjà garanti par le tri MOVES, mais on refiltre ici les
  // dossiers/fichiers qui existent encore — un déplacement précédent peut
  // avoir déjà consommé un sous-chemin).
  for (const { oldDir, newDir } of MOVES) {
    if (!existsSync(oldDir)) { console.log(`  (absent, ignoré) ${relative(SRC, oldDir)}`); continue; }
    mkdirSync(dirname(newDir), { recursive: true });
    renameSync(oldDir, newDir);
    console.log(`  ${relative(SRC, oldDir)} → ${relative(SRC, newDir)}`);
  }
}
