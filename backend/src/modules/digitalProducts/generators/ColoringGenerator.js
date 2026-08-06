'use strict';

const { parseMarkdown } = require('../../../shared/markdown/markdownEngine');
const { renderMarkdownToPdf } = require('./MarkdownPdfRenderer');

/**
 * Génère un cahier de coloriage — compile les planches fournies par l'admin
 * (digital_product.content_markdown, une image par planche à colorier) en PDF imprimable, via le
 * même moteur de mise en page que PdfGenerator (MarkdownPdfRenderer), jamais dupliqué.
 * Contrairement au PDF du livre, pas de repli sur le corps de la Story : un coloriage a besoin de
 * ses propres planches, pas du texte narratif — génération refusée explicitement si absentes,
 * jamais un PDF vide silencieux.
 */
async function generate({ digitalProduct }) {
  if (!digitalProduct.content_markdown?.trim()) {
    throw new Error('Aucune planche fournie pour ce coloriage — ajoutez des images dans le contenu du produit (admin)');
  }
  const title = digitalProduct.title;
  const { blocks, toc } = parseMarkdown(digitalProduct.content_markdown, { title });
  const buffer = await renderMarkdownToPdf({ title, coverImageUrl: digitalProduct.cover_image_url, blocks, toc });
  return { buffer, mimeType: 'application/pdf', extension: 'pdf' };
}

module.exports = { generate };
