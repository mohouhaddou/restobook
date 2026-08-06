'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { stripHtml } = require('./textUtils');

// Racine des fichiers déjà uploadés (voir backend/index.js: express.static('/uploads')) — les
// `src`/`image_url` du contenu pointent vers ce dossier en chemin relatif public
// (`/uploads/xxx.webp`), jamais un chemin disque : on les résout ici pour les embarquer dans le
// PDF (pdfkit a besoin d'un chemin fichier ou d'un buffer, pas d'une URL).
const UPLOADS_ROOT = path.join(__dirname, '../../../../uploads');

function resolveLocalImagePath(src) {
  if (!src || /^https?:\/\//i.test(src)) return null; // image externe — hors scope Phase 1
  const relative = src.replace(/^\/?uploads\//, '');
  const abs = path.join(UPLOADS_ROOT, relative);
  return fs.existsSync(abs) ? abs : null;
}

const MARGIN = 56;

function addCoverPage(doc, { title, coverImageUrl }) {
  const imgPath = resolveLocalImagePath(coverImageUrl);
  if (imgPath) {
    try {
      doc.image(imgPath, MARGIN, MARGIN, { fit: [doc.page.width - MARGIN * 2, 360], align: 'center' });
    } catch { /* image illisible — on continue sans, jamais d'échec total pour ça */ }
  }
  doc.moveDown(imgPath ? 4 : 2);
  doc.font('Helvetica-Bold').fontSize(28).text(title, { align: 'center' });
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(11).fillColor('#666666')
    .text('Généré par iFilino Kids', { align: 'center' });
  doc.fillColor('#000000');
}

function addTocPage(doc, toc) {
  if (!toc?.length) return;
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(20).text('Sommaire');
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(13);
  for (const entry of toc) {
    doc.text(`${'  '.repeat((entry.level || 2) - 2)}• ${entry.text}`);
    doc.moveDown(0.3);
  }
}

function renderBlock(doc, block) {
  switch (block.type) {
    case 'heading': {
      const size = block.depth <= 2 ? 20 : block.depth === 3 ? 16 : 13;
      doc.moveDown(0.8).font('Helvetica-Bold').fontSize(size).text(stripHtml(block.html));
      doc.moveDown(0.3);
      break;
    }
    case 'paragraph':
      doc.font('Helvetica').fontSize(11.5).text(stripHtml(block.html), { align: 'justify' });
      doc.moveDown(0.5);
      break;
    case 'image': {
      const imgPath = resolveLocalImagePath(block.src);
      if (imgPath) {
        try {
          doc.moveDown(0.3);
          doc.image(imgPath, { fit: [doc.page.width - MARGIN * 2, 320], align: 'center' });
          doc.moveDown(0.5);
        } catch { /* image illisible — ignorée, jamais d'échec de génération pour ça */ }
      }
      break;
    }
    case 'quote':
    case 'callout': {
      const y = doc.y;
      doc.font('Helvetica-Oblique').fontSize(11)
        .fillColor('#555555')
        .text(stripHtml(block.html), MARGIN + 14, y, { width: doc.page.width - MARGIN * 2 - 14 });
      doc.rect(MARGIN, y - 2, 3, doc.y - y + 4).fill('#cccccc');
      doc.fillColor('#000000');
      doc.moveDown(0.5);
      break;
    }
    case 'list': {
      doc.font('Helvetica').fontSize(11.5);
      block.items.forEach((itemHtml, i) => {
        const bullet = block.ordered ? `${i + 1}.` : '•';
        doc.text(`${bullet} ${stripHtml(itemHtml)}`, { indent: 14 });
      });
      doc.moveDown(0.5);
      break;
    }
    case 'table': {
      doc.font('Helvetica-Bold').fontSize(10.5).text(block.header.map(stripHtml).join('   |   '));
      doc.font('Helvetica').fontSize(10.5);
      for (const row of block.rows) doc.text(row.map(stripHtml).join('   |   '));
      doc.moveDown(0.5);
      break;
    }
    case 'code':
      doc.font('Courier').fontSize(9.5).fillColor('#333333').text(block.text);
      doc.fillColor('#000000').font('Helvetica');
      doc.moveDown(0.5);
      break;
    case 'hr':
      doc.moveDown(0.3);
      doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor('#dddddd').stroke();
      doc.moveDown(0.5);
      break;
    default:
      break;
  }
}

/**
 * Rend un livre (couverture + sommaire + contenu) en PDF à partir de la sortie déjà parsée de
 * markdownEngine.parseMarkdown() — jamais de re-parsing du markdown, une seule source de vérité
 * pour le contenu (cf. section "aucun contenu dupliqué" du cahier des charges).
 *
 * Limite connue Phase 1 : pdfkit (polices Helvetica standard) ne fait pas de shaping arabe/RTL —
 * la génération PDF pour du contenu `body_ar` produira un rendu dégradé (glyphes non liés, ordre
 * de lecture LTR). Le reste de l'expérience (UI, i18n, RTL) n'est pas concerné, seul le texte du
 * PDF lui-même. À revisiter avec une police arabe + bibliothèque bidi si besoin.
 *
 * @param {{title:string, coverImageUrl?:string, blocks:object[], toc?:object[]}} params
 * @returns {Promise<Buffer>}
 */
function renderMarkdownToPdf({ title, coverImageUrl, blocks, toc }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      addCoverPage(doc, { title, coverImageUrl });
      addTocPage(doc, toc);
      doc.addPage();
      for (const block of blocks || []) renderBlock(doc, block);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { renderMarkdownToPdf };
