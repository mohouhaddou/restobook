'use strict';

/**
 * Moteur images IA pour iFilino Discover.
 * Génère d'abord un prompt éditorial professionnel, puis produit les assets
 * WebP stockés sous /uploads/magazine/:articleId/.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { Article } = require('../../../models');
const { createAIProvider, AIProviderError, aiConfig } = require('../../services/ai/openaiProvider');
const { RUBRIQUES } = require('./rubriques');
const {
  toHeroWebp,
  toThumbnailWebp,
  toOpenGraphWebp,
  toIllustrationWebp,
} = require('./services/discoverImageService');

const MAX_IMAGE_PROMPT_LENGTH = 1400;
const MAX_SECTION_ILLUSTRATIONS = 4;

const RUBRIQUE_STYLES = {
  restaurants_food: 'premium culinary photography, gourmet restaurant atmosphere, appetizing plated food, warm natural light',
  courses_epiceries: 'fresh grocery shopping photography, abundant produce, clean modern market shelves, natural colors',
  boucheries: 'premium butcher display photography, immaculate counter, artisanal meat preparation, refined commercial lighting',
  boulangeries: 'artisan bakery photography, golden bread, flour texture, warm morning light, authentic craft atmosphere',
  patisseries: 'luxury pastry editorial photography, refined desserts, elegant plating, soft natural light',
  cafes: 'specialty coffee shop photography, espresso, latte art, modern cafe interior, cozy premium mood',
  sante_pharmacies: 'clean modern pharmacy photography, bright shelves, wellness products, clinical yet welcoming atmosphere',
  beaute_bien_etre: 'editorial beauty photography, skincare ritual, elegant wellness atmosphere, luminous natural skin tones',
  sport_forme: 'modern fitness editorial photography, active lifestyle, clean studio light, premium wellness energy',
  famille_enfants: 'bright family lifestyle photography, warm everyday moment, natural expressions, modern home atmosphere',
  maison_deco: 'interior design editorial photography, elegant home decor, natural materials, refined daylight composition',
  sorties_loisirs: 'urban lifestyle editorial photography, lively leisure scene, elegant city mood, realistic documentary feel',
  shopping: 'commercial lifestyle photography, elegant shopping moment, premium retail atmosphere, natural colors',
  evenements: 'event editorial photography, festive city atmosphere, elegant lighting, realistic crowd energy',
  villes: 'travel editorial photography, Moroccan city scene, elegant architecture, natural daylight, premium magazine style',
  maroc: 'travel editorial photography, landscapes and local culture, elegant realistic composition, natural light',
  conseils_astuces: 'minimal editorial illustration, realistic objects, clean composition, modern magazine layout mood',
  promotions: 'commercial lifestyle photography, attractive product moment, premium retail atmosphere, no sale text',
};

const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    base_prompt: { type: 'string' },
    alt_text: { type: 'string' },
    section_prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, prompt: { type: 'string' }, alt_text: { type: 'string' } },
        required: ['title', 'prompt', 'alt_text'],
        additionalProperties: false,
      },
    },
  },
  required: ['base_prompt', 'alt_text', 'section_prompts'],
  additionalProperties: false,
};

const PromptResultSchema = z.object({
  base_prompt: z.string().min(80).max(MAX_IMAGE_PROMPT_LENGTH),
  alt_text: z.string().min(8).max(191),
  section_prompts: z.array(z.object({
    title: z.string().min(1).max(160),
    prompt: z.string().min(80).max(MAX_IMAGE_PROMPT_LENGTH),
    alt_text: z.string().min(8).max(191),
  })).max(MAX_SECTION_ILLUSTRATIONS),
});

class AIImageError extends Error {
  constructor(message, { code = 'AI_IMAGE_ERROR', status = 400, retryable = false, details = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

function normalizeProviderError(error) {
  if (error instanceof AIImageError) return error;
  if (error instanceof AIProviderError) return new AIImageError(error.message, { code: error.code, status: error.status, retryable: error.retryable });
  return error;
}

function clampSectionCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  return Math.min(Math.max(Math.round(n), 0), MAX_SECTION_ILLUSTRATIONS);
}

function extractHeadings(markdown, max = MAX_SECTION_ILLUSTRATIONS) {
  return String(markdown || '')
    .split('\n')
    .map(line => line.match(/^##+\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean)
    .slice(0, max);
}

function truncateText(value, max) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function padToMin(value, min, filler) {
  let out = String(value || '').trim();
  while (out.length < min) out = out ? `${out} ${filler}` : filler;
  return out;
}

// Le modèle respecte le schéma la plupart du temps mais pas toujours à la
// lettre (ex: alt_text trop court, base_prompt tronqué) — constaté en prod
// (échec intermittent, pas systématique). Même stratégie que
// aiDraftService.normalizeDraft() : on coerce/complète AVANT la validation
// stricte plutôt que de jeter tout le résultat sur un écart mineur.
function normalizePromptResult(raw, article) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackBase = `Editorial photograph representing "${article.title || 'iFilino Discover'}", realistic composition, natural light, premium magazine quality.`;
  const fallbackAlt = truncateText(article.title || 'Image iFilino Discover', 191);

  const sectionPrompts = (Array.isArray(source.section_prompts) ? source.section_prompts : [])
    .slice(0, MAX_SECTION_ILLUSTRATIONS)
    .map(item => ({
      title: truncateText(String(item?.title || '').trim() || 'Section', 160),
      prompt: truncateText(padToMin(item?.prompt, 80, fallbackBase), MAX_IMAGE_PROMPT_LENGTH),
      alt_text: truncateText(padToMin(item?.alt_text, 8, fallbackAlt), 191),
    }));

  return {
    base_prompt: truncateText(padToMin(source.base_prompt, 80, fallbackBase), MAX_IMAGE_PROMPT_LENGTH),
    alt_text: truncateText(padToMin(source.alt_text, 8, fallbackAlt), 191),
    section_prompts: sectionPrompts,
  };
}

function hardenPrompt(prompt) {
  const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
  const required = 'No text, no typography, no watermark, no logo, no brand names, no labels, no signage, no trademarked products. Bright, premium, realistic, elegant, modern, magazine quality, high resolution, professional composition, shallow depth of field, natural colors.';
  return `${clean}. ${required}`.slice(0, MAX_IMAGE_PROMPT_LENGTH + 260);
}

function buildPromptInstructions(article, sectionCount) {
  const rubriqueLabel = RUBRIQUES[article.rubrique]?.label || article.rubrique || 'Conseils';
  const style = RUBRIQUE_STYLES[article.rubrique] || RUBRIQUE_STYLES.conseils_astuces;
  return [
    'Tu es directeur artistique pour iFilino Discover, un média premium universel.',
    'Ta tâche est de transformer un sujet d article en prompts image professionnels, jamais de reprendre seulement le sujet brut.',
    `Rubrique: ${rubriqueLabel}. Direction visuelle: ${style}.`,
    'Les prompts doivent être en anglais, précis, visuels, réalistes sauf pour conseils_astuces où une illustration éditoriale minimale est acceptable.',
    'Règles absolues pour chaque prompt: aucune lettre, aucun texte, aucun logo, aucune marque, aucun watermark, aucun packaging identifiable.',
    'Identité commune: lumineux, premium, réaliste, élégant, moderne, qualité magazine, haute résolution, composition professionnelle, profondeur de champ, couleurs naturelles.',
    `Retourne ${sectionCount} prompts de section maximum, uniquement si les sections s y prêtent.`,
  ].join('\n');
}

function buildPromptInput(article, sectionHeadings) {
  return [
    `Titre: ${article.title}`,
    article.excerpt ? `Extrait: ${article.excerpt}` : null,
    `Catégorie: ${article.category}`,
    `Rubrique: ${RUBRIQUES[article.rubrique]?.label || article.rubrique}`,
    article.tags?.length ? `Tags: ${article.tags.join(', ')}` : null,
    sectionHeadings.length ? `Sections candidates: ${sectionHeadings.join(' | ')}` : null,
    'Créer un prompt Hero premium, puis des prompts d illustrations si utile.',
  ].filter(Boolean).join('\n');
}

async function generateImagePrompt({ article, sectionCount = 2, aiProvider = null } = {}) {
  if (!article) throw new AIImageError('Article introuvable.', { code: 'ARTICLE_NOT_FOUND', status: 404 });
  const provider = aiProvider || createAIProvider();
  const requestId = crypto.randomUUID();
  const headings = extractHeadings(article.body, sectionCount);

  try {
    const raw = await provider.generateStructuredData({
      instructions: buildPromptInstructions(article, sectionCount),
      input: buildPromptInput(article, headings),
      jsonSchema: PROMPT_SCHEMA,
      schemaName: 'ifilino_magazine_image_prompt',
      maxOutputTokens: 2600,
      requestId,
    });
    const parsed = PromptResultSchema.parse(normalizePromptResult(raw, article));
    return {
      requestId,
      basePrompt: hardenPrompt(parsed.base_prompt),
      altText: parsed.alt_text,
      sectionPrompts: parsed.section_prompts.slice(0, sectionCount).map((item, index) => ({
        key: `section-${String(index + 1).padStart(2, '0')}`,
        title: item.title,
        prompt: hardenPrompt(item.prompt),
        alt_text: item.alt_text,
      })),
    };
  } catch (error) {
    if (error?.issues) {
      throw new AIImageError('Le prompt image généré ne respecte pas le format attendu.', {
        code: 'AI_VALIDATION_ERROR',
        status: 502,
        details: error.issues,
      });
    }
    throw normalizeProviderError(error);
  }
}

function getArticleDir(articleId) {
  return path.join(__dirname, '../../../uploads', 'magazine', String(articleId));
}

function publicPath(articleId, filename) {
  return `/uploads/magazine/${articleId}/${filename}`;
}

async function writeVariant({ articleId, filename, sourceBuffer, converter }) {
  const dir = getArticleDir(articleId);
  fs.mkdirSync(dir, { recursive: true });
  const output = await converter(sourceBuffer);
  fs.writeFileSync(path.join(dir, filename), output);
  return publicPath(articleId, filename);
}

function variantPrompt(basePrompt, label) {
  const additions = {
    hero: 'Wide cinematic editorial hero image, strong central subject, clean negative space suitable for a premium magazine article header.',
    thumbnail: 'Square magazine thumbnail composition, subject clearly readable at small size, balanced crop, premium editorial look.',
    og: 'Social sharing Open Graph image composition, 1200 by 630 crop friendly, no text overlays, clear focal point.',
    illustration: 'Editorial in-article illustration image, supports the section topic, cohesive with the hero visual identity.',
  };
  return hardenPrompt(`${basePrompt}. ${additions[label] || ''}`);
}

async function generateMagazineImages({ articleId, includeSections = true, sectionCount = 2, forcePrompt = false, only = null, aiProvider = null } = {}) {
  const article = await Article.findByPk(articleId);
  if (!article) throw new AIImageError('Article introuvable.', { code: 'ARTICLE_NOT_FOUND', status: 404 });
  const provider = aiProvider || createAIProvider();
  const finalSectionCount = includeSections ? clampSectionCount(sectionCount) : 0;

  const selected = only ? new Set(Array.isArray(only) ? only : [only]) : null;
  const should = key => !selected || selected.has(key) || (key === 'illustrations' && selected.has('section'));
  const existing = article.image_assets || {};
  const needsSectionPrompts = should('illustrations') && finalSectionCount > 0;
  const existingSectionPrompts = Array.isArray(existing.illustrations) ? existing.illustrations : [];

  let promptData = null;
  if (!forcePrompt && article.image_prompt && (!needsSectionPrompts || existingSectionPrompts.length > 0)) {
    promptData = {
      requestId: crypto.randomUUID(),
      basePrompt: hardenPrompt(article.image_prompt),
      altText: article.image_alt_text || article.title,
      sectionPrompts: existingSectionPrompts.slice(0, finalSectionCount).map((asset, index) => ({
        key: asset.key || `section-${String(index + 1).padStart(2, '0')}`,
        title: asset.title || `Section ${index + 1}`,
        prompt: hardenPrompt(asset.prompt || article.image_prompt),
        alt_text: asset.alt_text || article.image_alt_text || article.title,
      })),
    };
  }
  if (!promptData) promptData = await generateImagePrompt({ article, sectionCount: finalSectionCount, aiProvider: provider });

  const assets = { ...existing, illustrations: Array.isArray(existing.illustrations) ? [...existing.illustrations] : [] };
  const generated = [];

  async function generateBaseVariant(key, filename, converter, promptLabel) {
    if (!should(key)) return;
    const image = await provider.generateImage({
      prompt: variantPrompt(promptData.basePrompt, promptLabel),
      size: key === 'thumbnail' ? '1024x1024' : '1536x1024',
      quality: 'high',
      requestId: `${promptData.requestId}-${key}`,
    });
    const url = await writeVariant({ articleId: article.id, filename, sourceBuffer: image.buffer, converter });
    assets[key] = { url, prompt: promptData.basePrompt, revised_prompt: image.revisedPrompt, alt_text: promptData.altText, generated_at: new Date().toISOString() };
    generated.push(key);
  }

  // Les variantes de base et les illustrations sont des appels OpenAI
  // indépendants (prompts/tailles distincts, aucun état partagé sauf des
  // clés distinctes de `assets`/`generated`, sûr à paralléliser en JS
  // single-thread) — en série, 5 images à ~45-90s chacune en quality "high"
  // dépassaient largement le proxy_read_timeout nginx (120s), d'où les 502
  // observés en prod sur /ai/generate-draft-with-images et .../ai/generate-images.
  await Promise.all([
    generateBaseVariant('hero', 'hero.webp', toHeroWebp, 'hero'),
    generateBaseVariant('thumbnail', 'thumbnail.webp', toThumbnailWebp, 'thumbnail'),
    generateBaseVariant('og', 'og.webp', toOpenGraphWebp, 'og'),
  ]);

  if (should('illustrations') && finalSectionCount > 0) {
    const sections = promptData.sectionPrompts.slice(0, finalSectionCount);
    assets.illustrations = await Promise.all(sections.map(async (section, index) => {
      const image = await provider.generateImage({
        prompt: variantPrompt(section.prompt, 'illustration'),
        size: '1536x1024',
        quality: 'high',
        requestId: `${promptData.requestId}-${section.key}`,
      });
      const filename = `${section.key}.webp`;
      const url = await writeVariant({ articleId: article.id, filename, sourceBuffer: image.buffer, converter: toIllustrationWebp });
      generated.push(section.key);
      return {
        key: section.key,
        title: section.title || `Section ${index + 1}`,
        url,
        prompt: section.prompt,
        revised_prompt: image.revisedPrompt,
        alt_text: section.alt_text,
        generated_at: new Date().toISOString(),
      };
    }));
  }

  article.image_prompt = promptData.basePrompt;
  article.image_alt_text = promptData.altText;
  article.image_assets = assets;
  if (assets.hero?.url) article.cover_image_url = assets.hero.url;
  if (assets.illustrations?.length) article.gallery = assets.illustrations.map(item => item.url);
  article.status = 'draft';
  await article.save();

  return { article, image_assets: assets, image_prompt: promptData.basePrompt, image_alt_text: promptData.altText, generated };
}

async function removeImageAsset({ articleId, key } = {}) {
  const article = await Article.findByPk(articleId);
  if (!article) throw new AIImageError('Article introuvable.', { code: 'ARTICLE_NOT_FOUND', status: 404 });
  const assets = article.image_assets || {};
  if (key === 'illustrations') assets.illustrations = [];
  else if (key?.startsWith('section-')) assets.illustrations = (assets.illustrations || []).filter(item => item.key !== key);
  else delete assets[key];
  article.image_assets = assets;
  if (key === 'hero') article.cover_image_url = null;
  else if (assets.hero?.url) article.cover_image_url = assets.hero.url;
  article.gallery = (assets.illustrations || []).map(item => item.url);
  await article.save();
  return { article, image_assets: assets };
}

module.exports = {
  AIImageError,
  generateImagePrompt,
  generateMagazineImages,
  removeImageAsset,
  RUBRIQUE_STYLES,
};
