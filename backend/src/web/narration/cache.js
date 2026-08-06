'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Cache disque des clips audio de narration — un clip par PHRASE (unité de synthèse), donc
 * "par paragraphe"/"par chapitre" sont couverts de fait (union de leurs phrases), sans fichier
 * séparé à gérer. Réutilise le mount statique /uploads déjà existant (backend/index.js). */
const CACHE_DIR = path.resolve(__dirname, '../../../uploads/narration-cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

/** Bump obligatoire à chaque fois qu'un changement de provider/voix rendrait un fichier déjà en
 * cache incorrect pour la même clé logique (texte+voix+langue) — ex. le remplacement de Piper par
 * Kokoro comme moteur principal (v2) : un ancien clip Piper ne doit jamais être resservi comme
 * s'il venait de Kokoro. Changer ce numéro invalide silencieusement tout le cache existant (les
 * anciens fichiers restent sur disque, orphelins, mais ne sont plus jamais recherchés ni servis) —
 * plus sûr qu'une suppression physique, qui risquerait un fichier encore lu ailleurs. */
const CACHE_VERSION = 'v3-piper-only';

function keyFor(text, voice, lang) {
  return crypto.createHash('sha256').update(`${CACHE_VERSION}::${lang || 'fr'}::${voice || 'default'}::${text}`).digest('hex');
}

function pathFor(key) {
  return path.join(CACHE_DIR, `${key}.wav`);
}

function has(key) {
  return fs.existsSync(pathFor(key));
}

module.exports = { CACHE_DIR, keyFor, pathFor, has };
