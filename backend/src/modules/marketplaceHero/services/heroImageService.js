'use strict';

const sharp = require('sharp');

// Convertit systématiquement en WebP — ne conserve pas l'original pré-conversion
// (décision Phase 1 : évite le double stockage). Le fit:'cover' fait un centre-crop
// automatique côté serveur — aucun outil de recadrage interactif en Phase 1
// (aucune librairie de crop dans ce codebase).
async function toDesktopWebp(buffer) {
  return sharp(buffer).resize(1920, 1080, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
}
async function toMobileWebp(buffer) {
  return sharp(buffer).resize(828, 1200, { fit: 'cover' }).webp({ quality: 78 }).toBuffer();
}
async function toIllustrationWebp(buffer) {
  // fit:'inside' préserve les proportions + la transparence (overlay produit détouré)
  return sharp(buffer).resize(800, 800, { fit: 'inside' }).webp({ quality: 85 }).toBuffer();
}

module.exports = { toDesktopWebp, toMobileWebp, toIllustrationWebp };
