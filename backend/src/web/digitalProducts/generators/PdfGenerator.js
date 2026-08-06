'use strict';

const { chromium } = require('playwright');
const PDFDocument = require('pdfkit');

const INTERNAL_BASE_URL = `http://127.0.0.1:${process.env.PORT || 3001}`;
// Largeur >= 900px + paysage => StoryLayoutEngine choisit le mode "spread" (StoryLayoutEngine.ts,
// SPREAD_MIN_WIDTH) — le rendu desktop complet (illustration + texte côte à côte par scène).
const VIEWPORT = { width: 1280, height: 800 };
const READY_TIMEOUT_MS = 30000;
// Laisse l'animation de tournage de page (framer-motion, BookRenderer.tsx) se terminer avant de
// capturer — sans quoi la page serait figée à mi-transition.
const PAGE_TURN_SETTLE_MS = 500;
// JPEG plutôt que PNG : les illustrations sont photo-réalistes (bien plus lourdes à compresser en
// PNG sans perte), et ce serveur (1.9 Go RAM) n'a pas la marge pour accumuler des PNG volumineux
// pendant la capture — un livre de 20 pages a fait chuter la mémoire disponible à ~230 Mo en PNG.
const SCREENSHOT_QUALITY = 88;

/**
 * Génère le PDF du livre en capturant EXACTEMENT le rendu de /kids/story/:slug, plutôt que de
 * réimplémenter sa mise en page côté serveur : cette page pagine en MESURANT du texte réel dans
 * le navigateur (StoryLayoutEngine.ts/StoryPaginator.ts, voir leurs commentaires) — un rendu
 * qu'aucun moteur PDF serveur ne peut reproduire fidèlement sans dupliquer cette logique de
 * mesure. Un Chromium headless (Playwright) navigue donc sur la page réelle du site et avance
 * page par page comme un vrai lecteur (mêmes touches clavier que BookRenderer.tsx, voir
 * RTLLayoutManager.keyToActionFor).
 *
 * Capture en SCREENSHOT (rendu écran normal), jamais via page.pdf() : `page.pdf()` force un
 * re-layout complet sous CSS `@media print`, et cette page (nombreux conteneurs flex imbriqués en
 * hauteurs relatives — storybook-viewport/storybook-frame/scene-image) s'effondre sous ce
 * re-layout (constaté : illustrations absentes du PDF alors qu'identiques à l'écran, malgré un
 * `@page`/hauteurs fixes ajoutés en tentative de correction). Le screenshot capture le DOM déjà
 * mesuré par React/StoryLayoutEngine pour l'ÉCRAN — strictement le rendu déjà validé visuellement.
 * Chaque page est écrite dans le PDF au fur et à mesure de sa capture (jamais toutes les captures
 * accumulées en mémoire avant assemblage) pour limiter le pic mémoire sur ce serveur contraint.
 * Contrepartie assumée : texte non sélectionnable dans le PDF final (image rasterisée), au
 * bénéfice d'une fidélité visuelle garantie.
 *
 * Contrainte mémoire (ce serveur : 1.9 Go RAM, déjà vu un OOM sur un simple build) : un seul
 * navigateur ouvert à la fois pour toute l'application, jamais deux en parallèle (voir la file
 * d'attente process-wide dans generationService.js#enqueue), et toujours fermé immédiatement
 * après usage — jamais gardé ouvert entre deux générations.
 *
 * Note : contrairement à Coloring/ActivityGenerator, ce générateur ignore
 * `digital_product.content_markdown` — il capture la page publique de LA Story elle-même, qui
 * n'a pas d'équivalent pour un contenu personnalisé par produit.
 */
async function generate({ story }) {
  const url = `${INTERNAL_BASE_URL}/kids/story/${story.slug}`;
  let browser = null;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: VIEWPORT });
    // Pré-remplit le consentement cookies (ConsentContext.jsx, clé 'ifilino_consent') AVANT que le
    // JS de l'app ne s'exécute — sans ça, la bannière globale (CookieConsentBanner.jsx, position
    // fixed, z-index 3000) recouvre le bas de chaque page capturée. Rejet par défaut : cette
    // capture est un robot de génération, pas un vrai visiteur donnant son consentement.
    await page.addInitScript(() => {
      try { window.localStorage.setItem('ifilino_consent', JSON.stringify({ analytics: false, advertising: false })); } catch { /* noop */ }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT_MS });

    await page.waitForFunction(
      () => {
        const root = document.querySelector('.storybook-root');
        return !!root && root.getAttribute('data-storybook-ready') === '1'
          && Number(root.getAttribute('data-storybook-total')) > 0;
      },
      undefined,
      { timeout: READY_TIMEOUT_MS }
    );

    const { total, direction } = await page.evaluate(() => {
      const root = document.querySelector('.storybook-root');
      return { total: Number(root.getAttribute('data-storybook-total')), direction: root.getAttribute('data-storybook-direction') };
    });
    if (!total) throw new Error('Livre vide — aucune page à générer');

    // Touche physique "suivant" — dépend du sens de lecture (RTLLayoutManager.keyToActionFor) :
    // en arabe (RTL), la flèche gauche avance, jamais codé en dur pour toutes les langues.
    const nextKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';

    const doc = new PDFDocument({ size: [VIEWPORT.width, VIEWPORT.height], margin: 0, autoFirstPage: false });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    const pdfReady = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    for (let index = 0; index < total; index += 1) {
      if (index > 0) {
        await page.keyboard.press(nextKey);
        await page.waitForFunction(
          expected => document.querySelector('.storybook-root')?.getAttribute('data-storybook-page-index') === String(expected),
          index,
          { timeout: READY_TIMEOUT_MS }
        );
        await page.waitForTimeout(PAGE_TURN_SETTLE_MS);
      }
      // Masque le chrome interactif (barre de narration, flèches) juste pour la capture — jamais
      // persisté, jamais visible par un vrai visiteur : un livre imprimé n'a pas de contrôles de
      // lecture superposés à l'image.
      await page.evaluate(() => {
        document.querySelectorAll('.storybook-chrome-bottom, .storybook-nav').forEach(el => { el.style.display = 'none'; });
      });
      const shot = await page.screenshot({ type: 'jpeg', quality: SCREENSHOT_QUALITY });
      doc.addPage({ size: [VIEWPORT.width, VIEWPORT.height], margin: 0 });
      doc.image(shot, 0, 0, { width: VIEWPORT.width, height: VIEWPORT.height });
      // `shot` n'est référencé nulle part ailleurs après doc.image() (pdfkit copie les données
      // dans son propre flux) — éligible au ramasse-miettes immédiatement, jamais accumulé.
    }
    doc.end();

    const buffer = await pdfReady;
    return { buffer, mimeType: 'application/pdf', extension: 'pdf' };
  } finally {
    if (browser) await browser.close(); // jamais gardé ouvert, même en cas d'erreur
  }
}

module.exports = { generate };
