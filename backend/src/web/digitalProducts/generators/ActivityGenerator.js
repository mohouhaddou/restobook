'use strict';

const { parseMarkdown } = require('../../../shared/markdown/markdownEngine');
const { renderMarkdownToPdf } = require('./MarkdownPdfRenderer');

/**
 * Génère un cahier d'activités — compile le contenu propre au produit
 * (digital_product.content_markdown : jeux, exercices, quiz papier...) en PDF imprimable, via le
 * même moteur de mise en page que PdfGenerator (MarkdownPdfRenderer), jamais dupliqué. Pas de
 * repli sur le corps de la Story : refusé explicitement si le contenu est absent, jamais un PDF
 * vide silencieux.
 */
async function generate({ digitalProduct }) {
  if (!digitalProduct.content_markdown?.trim()) {
    throw new Error('Aucun contenu fourni pour ce cahier d\'activités — ajoutez du contenu dans le produit (admin)');
  }
  const title = digitalProduct.title;
  const { blocks, toc } = parseMarkdown(digitalProduct.content_markdown, { title });
  const buffer = await renderMarkdownToPdf({ title, coverImageUrl: digitalProduct.cover_image_url, blocks, toc });
  return { buffer, mimeType: 'application/pdf', extension: 'pdf' };
}

module.exports = { generate };
