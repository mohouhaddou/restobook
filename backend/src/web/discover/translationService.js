'use strict';

const { createAIProvider, AIProviderError } = require('../../services/ai/openaiProvider');
const { SUPPORTED_LANGUAGES, normalizeLanguage } = require('./i18n');

const LANGUAGE_LABELS = {
  ar: 'Arabic (Moroccan/Modern Standard Arabic, natural RTL editorial style)',
  fr: 'French (Moroccan francophone editorial style)',
  en: 'English (clear editorial style)',
};

const MAX_SEGMENTS = 120;
const MAX_MARKDOWN_LENGTH = 30000;
const MARKDOWN_IMAGE_RE = /!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

const FAQ_SCHEMA_ITEM = {
  type: 'object',
  properties: { question: { type: 'string' }, answer: { type: 'string' } },
  required: ['question', 'answer'],
  additionalProperties: false,
};

const SOURCE_SCHEMA_ITEM = {
  type: 'object',
  properties: { label: { type: 'string' }, url: { type: 'string' } },
  required: ['label', 'url'],
  additionalProperties: false,
};

const IMAGE_LABEL_SCHEMA_ITEM = {
  type: 'object',
  properties: { path: { type: 'string' }, title: { type: 'string' }, alt_text: { type: 'string' } },
  required: ['path', 'title', 'alt_text'],
  additionalProperties: false,
};

const RECIPE_META_SCHEMA = {
  type: ['object', 'null'],
  properties: {
    duration_minutes: { type: ['integer', 'null'] },
    difficulty: { type: ['string', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: { quantity: { type: 'string' }, name: { type: 'string' } },
        required: ['quantity', 'name'],
        additionalProperties: false,
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
  },
  required: ['duration_minutes', 'difficulty', 'ingredients', 'steps'],
  additionalProperties: false,
};

const TRANSLATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    slug: { type: 'string' },
    excerpt: { type: 'string' },
    seo_title: { type: 'string' },
    seo_description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    content_segments: { type: 'array', items: { type: 'string' } },
    markdown_image_alts: { type: 'array', items: { type: 'string' } },
    image_alt_text: { type: 'string' },
    image_labels: { type: 'array', items: IMAGE_LABEL_SCHEMA_ITEM },
    faq: { type: 'array', items: FAQ_SCHEMA_ITEM },
    recipe_meta: RECIPE_META_SCHEMA,
    sources: { type: 'array', items: SOURCE_SCHEMA_ITEM },
  },
  required: ['title', 'slug', 'excerpt', 'seo_title', 'seo_description', 'tags', 'content_segments', 'markdown_image_alts', 'image_alt_text', 'image_labels', 'faq', 'recipe_meta', 'sources'],
  additionalProperties: false,
};

class ArticleTranslationError extends Error {
  constructor(message, { code = 'AI_TRANSLATION_ERROR', status = 400, retryable = false, details = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

function normalizeProviderError(error) {
  if (error instanceof ArticleTranslationError) return error;
  if (error instanceof AIProviderError) {
    return new ArticleTranslationError(error.message, {
      code: error.code,
      status: error.status,
      retryable: error.retryable,
    });
  }
  return error;
}

function makeSlug(value, language) {
  const source = String(value || `article-${language}`).trim().toLowerCase();
  const normalized = language === 'ar'
    ? source.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-')
    : source.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  const slug = normalized.replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 191);
  return slug || `article-${language}`;
}

function truncateText(value, max) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function normalizeStringArray(value, { max = 16, itemMax = 50 } = {}) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map(item => truncateText(item, itemMax)).filter(Boolean))].slice(0, max);
}

function normalizeFaq(value, sourceFaq) {
  const list = Array.isArray(value) ? value : [];
  const fallback = Array.isArray(sourceFaq) ? sourceFaq : [];
  const normalized = list.map(item => ({
    question: truncateText(item?.question, 240),
    answer: truncateText(item?.answer, 800),
  })).filter(item => item.question && item.answer);
  return normalized.length ? normalized : fallback;
}

function normalizeSources(value, sourceSources) {
  const list = Array.isArray(value) ? value : [];
  const fallback = Array.isArray(sourceSources) ? sourceSources : [];
  const normalized = list.map((item, index) => ({
    label: truncateText(item?.label || fallback[index]?.label, 160),
    url: String(item?.url || fallback[index]?.url || '').trim(),
  })).filter(item => item.label && item.url);
  return normalized.length ? normalized : fallback;
}

function normalizeRecipeMeta(value, sourceRecipeMeta) {
  if (!sourceRecipeMeta) return null;
  if (!value || typeof value !== 'object') return sourceRecipeMeta;
  return {
    duration_minutes: value.duration_minutes ?? sourceRecipeMeta.duration_minutes ?? null,
    difficulty: truncateText(value.difficulty || sourceRecipeMeta.difficulty || '', 64),
    ingredients: (Array.isArray(value.ingredients) && value.ingredients.length ? value.ingredients : sourceRecipeMeta.ingredients || []).map(item => ({
      quantity: truncateText(item?.quantity || '', 80),
      name: truncateText(item?.name || '', 120),
    })).filter(item => item.name),
    steps: (Array.isArray(value.steps) && value.steps.length ? value.steps : sourceRecipeMeta.steps || []).map(step => truncateText(step, 600)).filter(Boolean),
  };
}

function collectImageLabels(imageAssets) {
  const labels = [];
  if (!imageAssets || typeof imageAssets !== 'object') return labels;
  ['hero', 'thumbnail', 'og'].forEach(key => {
    const asset = imageAssets[key];
    if (asset && typeof asset === 'object') labels.push({ path: key, title: asset.title || '', alt_text: asset.alt_text || '' });
  });
  (imageAssets.illustrations || []).forEach((asset, index) => {
    if (asset && typeof asset === 'object') labels.push({ path: 'illustrations.' + index, title: asset.title || '', alt_text: asset.alt_text || '' });
  });
  return labels;
}

function applyImageLabels(imageAssets, translatedLabels) {
  if (!imageAssets || typeof imageAssets !== 'object') return imageAssets || null;
  const next = JSON.parse(JSON.stringify(imageAssets));
  const byPath = new Map((Array.isArray(translatedLabels) ? translatedLabels : []).map(item => [item.path, item]));
  ['hero', 'thumbnail', 'og'].forEach(key => {
    const translated = byPath.get(key);
    if (!next[key] || !translated) return;
    if (translated.title) next[key].title = translated.title;
    if (translated.alt_text) next[key].alt_text = translated.alt_text;
  });
  (next.illustrations || []).forEach((asset, index) => {
    const translated = byPath.get('illustrations.' + index);
    if (!translated) return;
    if (translated.title) asset.title = translated.title;
    if (translated.alt_text) asset.alt_text = translated.alt_text;
  });
  return next;
}

function splitMarkdownAroundImages(markdown) {
  const text = String(markdown || '');
  const parts = [];
  const textSegments = [];
  const imageAlts = [];
  let lastIndex = 0;
  let match;

  while ((match = MARKDOWN_IMAGE_RE.exec(text))) {
    const before = text.slice(lastIndex, match.index);
    parts.push({ type: 'text', index: textSegments.length });
    textSegments.push(before);
    parts.push({ type: 'image', index: imageAlts.length, alt: match[1] || '', src: match[2] || '' });
    imageAlts.push(match[1] || '');
    lastIndex = match.index + match[0].length;
  }

  parts.push({ type: 'text', index: textSegments.length });
  textSegments.push(text.slice(lastIndex));

  return { parts, textSegments, imageAlts };
}

function sanitizeMarkdownAlt(value, fallback = 'Image') {
  return String(value || fallback).replace(/[\[\]\n\r]/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}

function rebuildMarkdown(parts, translatedSegments, translatedImageAlts = []) {
  return parts.map(part => {
    if (part.type === 'image') return '![' + sanitizeMarkdownAlt(translatedImageAlts[part.index] || part.alt) + '](' + part.src + ')';
    return translatedSegments[part.index] ?? '';
  }).join('').replace(/\n{4,}/g, '\n\n\n').trim();
}

function alignTranslatedSegments(translatedSegments, sourceSegments) {
  const raw = Array.isArray(translatedSegments) ? translatedSegments.map(item => String(item ?? '')) : [];
  if (raw.length === sourceSegments.length) return raw;

  const aligned = sourceSegments.map((source, index) => raw[index] ?? source);
  if (raw.length > sourceSegments.length && aligned.length) {
    aligned[aligned.length - 1] = `${aligned[aligned.length - 1] || ''}\n\n${raw.slice(sourceSegments.length).join('\n\n')}`.trimEnd();
  }
  return aligned;
}

function normalizeTranslationResult(parsed, { sourceTitle, sourceExcerpt, sourceSeoTitle, sourceSeoDescription, sourceTags, sourceImageAltText = '', sourceImageAssets = null, sourceFaq = [], sourceRecipeMeta = null, sourceSources = [], textSegments, imageAlts = [], target }) {
  if (!parsed || typeof parsed !== 'object') {
    throw new ArticleTranslationError('La traduction IA est vide ou invalide.', {
      code: 'AI_TRANSLATION_VALIDATION_ERROR',
      status: 502,
      retryable: false,
    });
  }

  const contentSegments = alignTranslatedSegments(parsed.content_segments, textSegments);
  const markdownImageAlts = alignTranslatedSegments(parsed.markdown_image_alts, imageAlts);
  return {
    title: truncateText(parsed.title || sourceTitle || `Article ${target.toUpperCase()}`, 191),
    slug: makeSlug(parsed.slug || parsed.title || sourceTitle, target),
    excerpt: truncateText(parsed.excerpt || sourceExcerpt || '', 500),
    seo_title: truncateText(parsed.seo_title || parsed.title || sourceSeoTitle || sourceTitle || '', 191),
    seo_description: truncateText(parsed.seo_description || parsed.excerpt || sourceSeoDescription || sourceExcerpt || '', 500),
    tags: normalizeStringArray(parsed.tags?.length ? parsed.tags : sourceTags),
    content_segments: contentSegments,
    markdown_image_alts: markdownImageAlts,
    image_alt_text: truncateText(parsed.image_alt_text || sourceImageAltText || '', 191),
    image_assets: applyImageLabels(sourceImageAssets, parsed.image_labels),
    faq: normalizeFaq(parsed.faq, sourceFaq),
    recipe_meta: normalizeRecipeMeta(parsed.recipe_meta, sourceRecipeMeta),
    sources: normalizeSources(parsed.sources, sourceSources),
  };
}

function validateInput({ sourceLanguage, targetLanguage, contentMd }) {
  const rawSource = String(sourceLanguage || '').toLowerCase().split('-')[0];
  const rawTarget = String(targetLanguage || '').toLowerCase().split('-')[0];
  if (!SUPPORTED_LANGUAGES.includes(rawSource) || !SUPPORTED_LANGUAGES.includes(rawTarget)) {
    throw new ArticleTranslationError('Langue non supportée.', { code: 'AI_INVALID_INPUT', status: 400 });
  }
  const source = normalizeLanguage(rawSource);
  const target = normalizeLanguage(rawTarget);
  if (source === target) {
    throw new ArticleTranslationError('Choisissez une langue cible différente.', { code: 'AI_INVALID_INPUT', status: 400 });
  }
  if (!String(contentMd || '').trim()) {
    throw new ArticleTranslationError('Le contenu Markdown source est requis.', { code: 'AI_INVALID_INPUT', status: 400 });
  }
  if (String(contentMd || '').length > MAX_MARKDOWN_LENGTH) {
    throw new ArticleTranslationError('Le contenu Markdown est trop long pour une traduction automatique.', { code: 'AI_INPUT_TOO_LONG', status: 400 });
  }
  return { source, target };
}

async function translateArticle({ sourceLanguage, targetLanguage, title, excerpt = '', contentMd, seoTitle = '', seoDescription = '', tags = [], imageAltText = '', imageAssets = null, faq = [], recipeMeta = null, sources = [], aiProvider = null } = {}) {
  const { source, target } = validateInput({ sourceLanguage, targetLanguage, contentMd });
  const { parts, textSegments, imageAlts } = splitMarkdownAroundImages(contentMd);
  if (textSegments.length > MAX_SEGMENTS) {
    throw new ArticleTranslationError("L'article contient trop de blocs pour une traduction automatique.", { code: 'AI_INPUT_TOO_LONG', status: 400 });
  }

  const imageLabels = collectImageLabels(imageAssets);
  const provider = aiProvider || createAIProvider();
  try {
    const parsed = await provider.generateStructuredData({
      schemaName: 'discover_article_translation',
      jsonSchema: TRANSLATION_JSON_SCHEMA,
      maxOutputTokens: 12000,
      requestId: `discover-translate-${Date.now()}`,
      instructions: [
        'You translate iFilino Discover editorial articles for publication.',
        `Source language: ${LANGUAGE_LABELS[source] || source}. Target language: ${LANGUAGE_LABELS[target] || target}.`,
        'Translate every human-readable editorial field: title, excerpt, SEO, tags, Markdown text, Markdown image alt texts, image titles/alt texts, FAQ, recipe ingredients/steps, and source labels.',
        'Preserve Markdown syntax, heading levels, list structure, links, tables, emphasis, and code fences.',
        'Do not translate URLs, file paths, product slugs, business slugs, or technical keys.',
        'Do not add new facts, products, prices, claims, images, or links.',
        'The article images have been removed from content_segments and will be reinserted by the server in their original positions. Return exactly one translated content segment for each input segment, in the same order.',
        'Keep SEO fields natural and concise. Generate a URL-safe slug for the target language.',
      ].join('\n'),
      input: JSON.stringify({
        source_language: source,
        target_language: target,
        title: String(title || ''),
        excerpt: String(excerpt || ''),
        seo_title: String(seoTitle || ''),
        seo_description: String(seoDescription || ''),
        tags: Array.isArray(tags) ? tags : [],
        content_segments: textSegments,
        markdown_image_alts: imageAlts,
        image_alt_text: String(imageAltText || ''),
        image_labels: imageLabels,
        faq: Array.isArray(faq) ? faq : [],
        recipe_meta: recipeMeta || null,
        sources: Array.isArray(sources) ? sources : [],
      }),
    });

    const result = normalizeTranslationResult(parsed, {
      sourceTitle: title,
      sourceExcerpt: excerpt,
      sourceSeoTitle: seoTitle,
      sourceSeoDescription: seoDescription,
      sourceTags: tags,
      sourceImageAltText: imageAltText,
      sourceImageAssets: imageAssets,
      sourceFaq: faq,
      sourceRecipeMeta: recipeMeta,
      sourceSources: sources,
      textSegments,
      imageAlts,
      target,
    });

    return {
      language: target,
      title: result.title,
      slug: result.slug,
      excerpt: result.excerpt,
      content_md: rebuildMarkdown(parts, result.content_segments, result.markdown_image_alts),
      seo_title: result.seo_title || result.title,
      seo_description: result.seo_description || result.excerpt,
      tags: result.tags,
      image_alt_text: result.image_alt_text,
      image_assets: result.image_assets,
      faq: result.faq,
      recipe_meta: result.recipe_meta,
      sources: result.sources,
    };
  } catch (error) {
    throw normalizeProviderError(error);
  }
}

module.exports = {
  translateArticle,
  splitMarkdownAroundImages,
  rebuildMarkdown,
  collectImageLabels,
  applyImageLabels,
  ArticleTranslationError,
};
