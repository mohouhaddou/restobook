'use strict';

/**
 * Moteur Markdown partagé — point d'entrée unique pour convertir du Markdown
 * en HTML (compat body_html) ET en blocs structurés (blocks[]) consommés par
 * le MarkdownRenderer React partagé (Discover/Sports/Kids/Stories).
 *
 * Toute la logique de normalisation/heading-splitting ci-dessous provient
 * telle quelle de backend/src/modules/discover/articleService.js — déplacée
 * ici pour être réutilisée par Portals (Kids/Sports) sans duplication.
 */

const { marked } = require('marked');
const { slugify } = require('../utils/slug');

function computeReadingTime(markdown) {
  if (!markdown) return 1;
  const words = String(markdown).replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`~\-\[\]()!]/g, ' ').split(/\s+/).filter(Boolean);
  return Math.max(1, Math.round(words.length / 200));
}

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function splitLongHeadingLine(prefix, value) {
  const heading = String(value || '').trim();
  if (heading.length < 70) return `${prefix}${heading}`;

  const cues = [
    'Le ', 'La ', 'Les ', "L'", 'Un ', 'Une ', 'Des ', 'Du ', 'De ',
    'Il ', 'Elle ', 'Ils ', 'Elles ', 'Ce ', 'Cet ', 'Cette ', 'Chaque ', 'Certaines ',
    'Notre ', 'Nos ', 'Nous ', 'En ', 'Dans ', 'Lorsque ', 'Quand ', 'Avec ', 'Sans ',
    'Pour ', 'Avant ', 'Quelques ', 'Résultat ', 'Resultat ', 'Évitez ', 'Evitez ',
    'Privilégiez ', 'Privilegiez ', 'Pensez ', 'Vous ', 'Cela ', 'Cette méthode ', 'Cette methode ',
  ];

  let best = -1;
  for (const cue of cues) {
    const idx = heading.indexOf(' ' + cue, 8);
    if (idx > 0 && idx <= 110 && (best === -1 || idx < best)) best = idx;
  }

  if (best > 0) {
    const title = heading.slice(0, best).trim().replace(/[.:;,-]+$/, '');
    const rest = heading.slice(best).trim();
    if (title.length >= 8 && rest.length >= 12) return `${prefix}${title}\n\n${rest}`;
  }

  const sentenceBreak = heading.match(/^(.{12,95}?[.!?])\s+([\p{Lu}ÉÈÀÂÊÎÔÛÇA-Z].+)$/u);
  if (sentenceBreak) return `${prefix}${sentenceBreak[1].trim()}\n\n${sentenceBreak[2].trim()}`;

  return `${prefix}${heading}`;
}

function splitFlattenedH1(markdown, title = '') {
  const match = String(markdown || '').match(/^#\s+([^\n]+)/);
  if (!match) return markdown;

  const line = match[1].trim();
  if (line.length < 140 && (!title || line.length <= String(title).length + 40)) return markdown;

  const titleTokens = String(title || '').split(/\s+/).map(normalizeToken).filter(Boolean);
  const lineWords = line.split(/\s+/);
  let common = 0;
  while (common < titleTokens.length && common < lineWords.length && normalizeToken(lineWords[common]) === titleTokens[common]) common += 1;

  if (common >= 4 && common < lineWords.length) {
    const rest = lineWords.slice(common).join(' ').trim();
    return markdown.replace(/^#\s+[^\n]+/, `# ${title || lineWords.slice(0, common).join(' ')}${rest ? `\n\n${rest}` : ''}`);
  }

  const firstSentence = line.match(/^(.{24,120}?[.!?])\s+(.+)$/);
  if (firstSentence) {
    return markdown.replace(/^#\s+[^\n]+/, `# ${firstSentence[1]}\n\n${firstSentence[2]}`);
  }

  return markdown;
}

const FRONTMATTER_BLOCK = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** Retire un bloc frontmatter YAML (`---\ntitle: ...\n---`) éventuel en tête du Markdown.
 * `marked` ne le comprend pas et le restituerait tel quel comme texte brut. */
function stripFrontmatter(markdown) {
  return markdown.replace(FRONTMATTER_BLOCK, '');
}

function normalizeMarkdownForRendering(markdown, title = '') {
  let text = stripFrontmatter(String(markdown || ''))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\n/g, '\n');

  text = text
    .replace(/[ \t]+(---|\*\*\*)[ \t]+/g, '\n\n$1\n\n')
    .replace(/[ \t]+(#{2,6})[ \t]+/g, '\n\n$1 ')
    .replace(/[ \t]+>[ \t]+/g, '\n\n> ')
    .replace(/(:)[ \t]+(-|\d+\.)[ \t]+/g, '$1\n\n$2 ')
    .replace(/([.;!?؟؛])[ \t]+(-|\d+\.)[ \t]+/g, '$1\n$2 ');

  text = splitFlattenedH1(text, title);
  text = text.replace(/^(#{2,6}\s+)([^\n]+)$/gm, (full, prefix, value) => splitLongHeadingLine(prefix, value));
  return text.trim();
}

const CALLOUT_MARKER = /^\[!(TIP|INFO|WARNING|NOTE)\]\s*(.*)$/i;

/** Convertit un token blockquote marked en bloc `quote` ou `callout` (marqueur `> [!TIP] ...`). */
function blockquoteToBlock(token) {
  const raw = String(token.text || '');
  const firstLine = raw.split('\n')[0] || '';
  const match = firstLine.match(CALLOUT_MARKER);
  if (!match) return { type: 'quote', html: marked.parse(raw) };

  const kind = match[1].toLowerCase();
  const titleFromMarker = match[2].trim();
  const rest = raw.slice(firstLine.length).replace(/^\n+/, '');
  return {
    type: 'callout',
    kind,
    title: titleFromMarker || null,
    html: marked.parse(rest || titleFromMarker),
  };
}

/** Une image seule sur sa ligne lexe comme un paragraphe contenant un unique token inline `image` (règle CommonMark). */
function paragraphImageOrNull(token) {
  const inline = token.tokens || [];
  if (inline.length !== 1 || inline[0].type !== 'image') return null;
  const img = inline[0];
  return { type: 'image', src: img.href, alt: img.text || '', title: img.title || null };
}

function tokensToBlocks(tokens) {
  const blocks = [];
  const seenAnchors = new Set();

  const anchorFor = text => {
    const base = slugify(text) || 'section';
    let anchor = base;
    let i = 2;
    while (seenAnchors.has(anchor)) anchor = `${base}-${i++}`;
    seenAnchors.add(anchor);
    return anchor;
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        blocks.push({ type: 'heading', depth: token.depth, text: token.text, html: marked.parseInline(token.text), anchor: anchorFor(token.text) });
        break;
      case 'paragraph': {
        const image = paragraphImageOrNull(token);
        blocks.push(image || { type: 'paragraph', html: marked.parseInline(token.text) });
        break;
      }
      case 'blockquote':
        blocks.push(blockquoteToBlock(token));
        break;
      case 'table':
        blocks.push({
          type: 'table',
          align: token.align,
          header: token.header.map(cell => marked.parseInline(cell.text)),
          rows: token.rows.map(row => row.map(cell => marked.parseInline(cell.text))),
        });
        break;
      case 'list':
        blocks.push({ type: 'list', ordered: Boolean(token.ordered), items: token.items.map(item => marked.parser(item.tokens)) });
        break;
      case 'code':
        blocks.push({ type: 'code', lang: token.lang || null, text: token.text });
        break;
      case 'hr':
        blocks.push({ type: 'hr' });
        break;
      default:
        // space, html, def, etc. — pas de représentation visuelle dédiée nécessaire.
        break;
    }
  }
  return blocks;
}

/**
 * Point d'entrée unique du moteur : Markdown -> { blocks, toc, html, readingTime }.
 * `html`/`toc` restent strictement identiques à l'ancien `renderBodyWithToc` de Discover
 * (compat body_html pour le SEO et les consommateurs existants) ; `blocks` est la
 * nouveauté consommée par le MarkdownRenderer React partagé.
 */
function parseMarkdown(markdown, { title = '' } = {}) {
  if (!markdown) return { html: '', toc: [], blocks: [], readingTime: 1 };
  const normalizedMarkdown = normalizeMarkdownForRendering(markdown, title);
  const tokens = marked.lexer(normalizedMarkdown);

  const seen = new Set();
  const toc = tokens.filter(t => t.type === 'heading' && (t.depth === 2 || t.depth === 3)).map(t => {
    const base = slugify(t.text) || 'section';
    let anchor = base;
    let i = 2;
    while (seen.has(anchor)) anchor = `${base}-${i++}`;
    seen.add(anchor);
    return { level: t.depth, text: t.text, anchor };
  });

  let idx = 0;
  const html = marked.parse(normalizedMarkdown).replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (full, level, inner) => {
    const entry = toc[idx++];
    return entry ? `<h${level} id="${entry.anchor}">${inner}</h${level}>` : full;
  });

  const blocks = tokensToBlocks(tokens);
  const readingTime = computeReadingTime(markdown);

  return { html, toc, blocks, readingTime };
}

module.exports = {
  parseMarkdown,
  computeReadingTime,
  normalizeMarkdownForRendering,
  normalizeToken,
  splitFlattenedH1,
  splitLongHeadingLine,
};
