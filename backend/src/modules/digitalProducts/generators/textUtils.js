'use strict';

// Réduit le HTML inline produit par markdownEngine.js en texte brut — partagé par PdfGenerator
// (mise en page pdfkit, qui n'interprète pas le HTML) et AudiobookGenerator (texte à synthétiser),
// jamais dupliqué entre les deux.
function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

module.exports = { stripHtml };
