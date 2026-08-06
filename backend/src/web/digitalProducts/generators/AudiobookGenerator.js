'use strict';

const fs = require('fs');
const { parseMarkdown } = require('../../../shared/markdown/markdownEngine');
const { synthesizeText } = require('../../narration/service');
const { concatWav } = require('../../narration/wav');
const cache = require('../../narration/cache');
const { stripHtml } = require('./textUtils');

// Marge sous la limite de 2000 caractères validée par narration/routes.js (POST /synthesize) —
// jamais un bloc/segment envoyé au moteur TTS existant ne doit s'en approcher.
const MAX_CHUNK_CHARS = 1800;
const SPEAKABLE_BLOCK_TYPES = new Set(['heading', 'paragraph', 'quote', 'callout', 'list']);

// Blocs sans équivalent parlé (image/tableau/code/hr) — silencieusement ignorés, jamais une
// tentative de les "décrire" à voix haute (hors scope, et sans valeur pédagogique ici).
function blockToSpeechText(block) {
  if (block.type === 'list') return block.items.map(stripHtml).join('. ');
  if (SPEAKABLE_BLOCK_TYPES.has(block.type)) return stripHtml(block.html);
  return '';
}

// Découpe par phrase (jamais au milieu d'un mot) pour rester sous MAX_CHUNK_CHARS — un paragraphe
// normal de livre pour enfants tient toujours en un seul segment, ce découpage ne sert qu'aux
// paragraphes inhabituellement longs.
function splitIntoChunks(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxChars && current) { chunks.push(current); current = sentence; }
    else current = candidate;
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Génère un livre audio à partir du markdown de la Story, en réutilisant intégralement le moteur
 * TTS déjà existant (backend/src/modules/narration/) — jamais un second moteur de synthèse.
 * Chaque segment passe par le cache par-phrase déjà en place (narration/cache.js), donc un
 * paragraphe déjà synthétisé pour un autre produit/une autre page n'est jamais resynthétisé.
 * Tous les clips sont ensuite concaténés (narration/wav.js#concatWav) en un seul fichier WAV.
 *
 * Langue/voix : v1 utilise la langue par défaut de la Story (body_fr) avec la voix par défaut du
 * provider actif — plusieurs voix/langues explicitement prévues pour une phase suivante (cahier
 * des charges, section Audio), pas un manque silencieux.
 */
async function generate({ digitalProduct, story }) {
  const markdown = digitalProduct.content_markdown || story.body_fr || '';
  const lang = 'fr';
  const { blocks } = parseMarkdown(markdown, { title: digitalProduct.title });

  const segments = [];
  for (const block of blocks) {
    const text = blockToSpeechText(block).trim();
    if (!text) continue;
    segments.push(...splitIntoChunks(text, MAX_CHUNK_CHARS));
  }
  if (!segments.length) throw new Error('Contenu vide — rien à synthétiser pour ce livre audio');

  // Séquentiel plutôt qu'en parallèle : Piper (le provider fr) tourne en process externe spawné
  // (child_process.spawn par phrase) — un lot de synthèses concurrentes surchargerait inutilement
  // le serveur pour un job qui tourne déjà en arrière-plan (voir generationService.js).
  const buffers = [];
  for (const segment of segments) {
    await synthesizeText({ text: segment, lang });
    const key = cache.keyFor(segment, undefined, lang);
    buffers.push(await fs.promises.readFile(cache.pathFor(key)));
  }

  const buffer = concatWav(buffers);
  return { buffer, mimeType: 'audio/wav', extension: 'wav' };
}

module.exports = { generate };
