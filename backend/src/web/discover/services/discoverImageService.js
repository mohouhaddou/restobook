'use strict';

const sharp = require('sharp');

// Même logique que shared/services/heroImageService.js — conversion
// systématique en WebP, pas de conservation de l'original.
async function toCoverWebp(buffer) {
  return sharp(buffer).resize(1200, 630, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
}
async function toGalleryWebp(buffer) {
  return sharp(buffer).resize(1000, 1000, { fit: 'inside' }).webp({ quality: 82 }).toBuffer();
}
async function toHeroWebp(buffer) {
  return sharp(buffer).resize(1600, 900, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
}
async function toThumbnailWebp(buffer) {
  return sharp(buffer).resize(900, 900, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
}
async function toOpenGraphWebp(buffer) {
  return sharp(buffer).resize(1200, 630, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
}
async function toIllustrationWebp(buffer) {
  return sharp(buffer).resize(1200, 800, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
}

module.exports = {
  toCoverWebp,
  toGalleryWebp,
  toHeroWebp,
  toThumbnailWebp,
  toOpenGraphWebp,
  toIllustrationWebp,
};
