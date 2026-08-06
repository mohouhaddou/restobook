'use strict';

/**
 * Injecte meta/Schema.org/contenu réel dans le shell HTML déjà buildé
 * (backend/public/index.html — le même fichier servi aujourd'hui pour la SPA)
 * et renvoie la page complète.
 *
 * Rendu réel via le bundle SSR React (frontend/src/entry-server.jsx, buildé
 * par `npm run build:ssr` → frontend/dist-server/ → copié vers
 * backend/ssr-dist/, voir RUNBOOK). Les composants de frontend/src/pages/seo/
 * sont des vues de présentation pures, isolées des pages interactives
 * existantes (RestaurantPage.jsx, MarketplacePage.jsx — qui touchent window/
 * localStorage/leaflet au niveau du corps du composant et ne sont pas SSR-
 * safe). Si le bundle est absent ou plante, on retombe sur les gabarits
 * texte de htmlTemplates.js — jamais de 500 sur une page publique.
 *
 * Le bundle client (main.jsx) boot ensuite normalement par-dessus (pas
 * d'hydratation stricte — juste un nouveau rendu, voir main.jsx).
 */

const fs = require('fs');
const path = require('path');

const SHELL_PATH = path.join(__dirname, '../../../public/index.html');
const SSR_BUNDLE_PATH = process.env.SSR_BUNDLE_PATH
  || path.join(__dirname, '../../../ssr-dist/entry-server.mjs');

let cachedShell = null;
function loadShell() {
  if (cachedShell && process.env.NODE_ENV === 'production') return cachedShell;
  cachedShell = fs.readFileSync(SHELL_PATH, 'utf8');
  return cachedShell;
}

// Le chargement du bundle (import) et son exécution (render) échouent pour
// des raisons différentes : un import raté est permanent (fichier absent,
// tant que le process ne redémarre pas) — on ne le retente pas à chaque
// requête. Un render raté peut être spécifique à une page/des props
// précises — on retente bien à la requête suivante, sans désactiver tout le
// SSR React pour les autres pages.
let bundlePromise = null;
function loadBundle() {
  if (!bundlePromise) bundlePromise = import(SSR_BUNDLE_PATH);
  return bundlePromise;
}

async function renderReactBody(page, props) {
  try {
    const mod = await loadBundle();
    return mod.render(page, props);
  } catch (e) {
    console.error('[SEO SSR] rendu React indisponible, repli sur les gabarits texte:', e.message);
    return null;
  }
}

function replaceTag(html, regex, replacement) {
  return regex.test(html) ? html.replace(regex, replacement) : html;
}

function injectMeta(html, meta) {
  let out = html;
  if (meta.lang || meta.dir) {
    out = out.replace(/<html([^>]*)>/, (tag) => {
      let next = tag.replace(/\s+lang="[^"]*"/, '').replace(/\s+dir="[^"]*"/, '');
      return next.replace('>', ` lang="${escapeAttr(meta.lang || 'fr')}" dir="${escapeAttr(meta.dir || 'ltr')}">`);
    });
  }
  out = replaceTag(out, /<title>[^<]*<\/title>/, `<title>${escapeText(meta.title)}</title>`);
  out = replaceTag(out, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeAttr(meta.description)}" />`);
  out = replaceTag(out, /<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${escapeAttr(meta.robots)}" />`);
  out = replaceTag(out, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`);
  out = replaceTag(out, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeAttr(meta.og.title)}" />`);
  out = replaceTag(out, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeAttr(meta.og.description)}" />`);
  out = replaceTag(out, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeAttr(meta.og.url)}" />`);
  out = replaceTag(out, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${escapeAttr(meta.og.image)}" />`);
  if (meta.og.image) {
    out = out.replace('</head>', `  <meta property="og:image:secure_url" content="${escapeAttr(meta.og.image)}" />\n  <meta property="og:image:type" content="image/jpeg" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />\n</head>`);
  }
  const extraOgImages = (meta.images || []).filter(img => img && img !== meta.og.image).slice(0, 5)
    .map(img => `  <meta property="og:image" content="${escapeAttr(img)}" />`)
    .join('\n');
  if (extraOgImages) out = out.replace('</head>', `${extraOgImages}\n</head>`);
  out = replaceTag(out, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escapeAttr(meta.twitter.title)}" />`);
  out = replaceTag(out, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeAttr(meta.twitter.description)}" />`);
  out = replaceTag(out, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${escapeAttr(meta.twitter.image)}" />`);

  // og:article:* (iFilino Discover) — placeholders présents dans le shell
  // seulement pour published_time/modified_time/section (liste fixe, voir
  // plan Discover Magazine §10) ; article:tag est répété dynamiquement.
  if (meta.article) {
    out = replaceTag(out, /<meta property="article:published_time" content="[^"]*" \/>/, `<meta property="article:published_time" content="${escapeAttr(toIso(meta.article.publishedTime))}" />`);
    out = replaceTag(out, /<meta property="article:modified_time" content="[^"]*" \/>/, `<meta property="article:modified_time" content="${escapeAttr(toIso(meta.article.modifiedTime))}" />`);
    out = replaceTag(out, /<meta property="article:section" content="[^"]*" \/>/, `<meta property="article:section" content="${escapeAttr(meta.article.section || '')}" />`);
    const articleTagTags = (meta.article.tags || [])
      .map(t => `  <meta property="article:tag" content="${escapeAttr(t)}" />`)
      .join('\n');
    if (articleTagTags) out = out.replace('</head>', `${articleTagTags}\n</head>`);
  }

  const hreflangTags = (meta.hreflang || [])
    .map(h => `  <link rel="alternate" hreflang="${escapeAttr(h.lang)}" href="${escapeAttr(h.href)}" />`)
    .join('\n');
  out = out.replace('</head>', `${hreflangTags}\n</head>`);

  return out;
}

// Remplace uniquement la valeur de href (type/sizes préservés) — un module
// (Discover/Play/Gaming/Sports/Kids) sans favicon dédié garde celui du shell
// (favicon marketplace par défaut), voir MODULE_FAVICONS dans metaGenerator.js.
function injectFavicon(html, favicon) {
  if (!favicon) return html;
  let out = html;
  out = out.replace(/(<link rel="icon"[^>]*href=")[^"]*(")/, `$1${escapeAttr(favicon)}$2`);
  out = out.replace(/(<link rel="apple-touch-icon"[^>]*href=")[^"]*(")/, `$1${escapeAttr(favicon)}$2`);
  return out;
}

function injectSchemas(html, schemas) {
  const scripts = (schemas || [])
    .filter(Boolean)
    .map(s => `  <script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n');
  return html.replace('</head>', `${scripts}\n</head>`);
}

function injectBody(html, bodyHtml) {
  return html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
}

function toIso(d) {
  if (!d) return '';
  try { return new Date(d).toISOString(); } catch { return ''; }
}

function escapeText(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

async function renderSeoPage(req, res, { page, meta, schemas, props, favicon }) {
  let bodyHtml = await renderReactBody(page, props);
  if (bodyHtml == null) {
    // Repli gabarits texte — voir htmlTemplates.js. Couvre l'absence du
    // bundle (pas encore buildé/déployé) et toute erreur de rendu React.
    bodyHtml = require('./htmlTemplates').renderBody(page, props);
  }

  let html = loadShell();
  html = injectMeta(html, meta);
  html = injectFavicon(html, favicon);
  html = injectSchemas(html, schemas);
  html = injectBody(html, bodyHtml);
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.send(html);
}

module.exports = { renderSeoPage };
