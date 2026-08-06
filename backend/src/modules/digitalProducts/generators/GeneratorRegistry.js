'use strict';

const PdfGenerator = require('./PdfGenerator');
const AudiobookGenerator = require('./AudiobookGenerator');
const ColoringGenerator = require('./ColoringGenerator');
const ActivityGenerator = require('./ActivityGenerator');

// Un générateur par type de produit — chacun indépendant, même contrat `generate({digitalProduct,
// story}) -> {buffer, mimeType, extension}`. Ajouter un type (Phase 3 : stickers/wallpapers/
// bundle) = une ligne ici, jamais un changement de generationService.js/routes.js.
const GENERATORS = {
  pdf: PdfGenerator,
  audiobook: AudiobookGenerator,
  coloring: ColoringGenerator,
  activity_pack: ActivityGenerator,
};

function getGenerator(type) {
  const generator = GENERATORS[type];
  if (!generator) throw new Error(`Aucun générateur enregistré pour le type de produit "${type}"`);
  return generator;
}

module.exports = { getGenerator };
