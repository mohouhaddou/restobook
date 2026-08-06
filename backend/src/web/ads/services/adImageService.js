'use strict';
const sharp = require('sharp');

// Même pipeline que heroImageService.js : jamais de stockage du fichier
// original, toujours reconversion WebP (évite le double stockage + normalise
// le format servi au client).
async function toDesktopWebp(buffer) {
  return sharp(buffer).resize(1200, 400, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
}
async function toMobileWebp(buffer) {
  return sharp(buffer).resize(600, 400, { fit: 'cover' }).webp({ quality: 78 }).toBuffer();
}
async function toLogoWebp(buffer) {
  return sharp(buffer).resize(200, 200, { fit: 'inside' }).webp({ quality: 85 }).toBuffer();
}

module.exports = { toDesktopWebp, toMobileWebp, toLogoWebp };
