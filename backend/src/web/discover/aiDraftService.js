'use strict';

/**
 * Moteur de brouillons IA — iFilino Discover (Discover).
 *
 * Génère un brouillon d'article (status='draft') à partir de données RÉELLES
 * de la marketplace (commerces, produits, promotions, ville). Le modèle ne
 * reçoit que des candidats issus de la base et le serveur revalide toutes les
 * références avant sauvegarde. Le brouillon n'est JAMAIS publié
 * automatiquement : validation humaine obligatoire via le CMS.
 */

const crypto = require('crypto');
const { z } = require('zod');
const { Op } = require('sequelize');
const { Article, City, Coupon } = require('../../../models');
const { generateUniqueSlug } = require('../../shared/utils/slug');
const { createAIProvider, getAiPublicStatus, AIProviderError, aiConfig } = require('../../services/ai/openaiProvider');
const publicDataService = require('../../shared/seo/publicDataService');
const { VERTICALS } = require('../../shared/seo/verticals');
const { RUBRIQUES, RUBRIQUE_KEYS } = require('./rubriques');

const ARTICLE_CATEGORIES = [
  'guide', 'recette', 'promotion', 'conseil', 'actualite',
  'nouveau_commerce', 'nouveau_produit', 'vie_locale', 'portrait',
];

const MAX_TOPIC_LENGTH = 300;
const MAX_EDITORIAL_INSTRUCTIONS_LENGTH = 1200;
const MAX_FACTS_LENGTH = 3000;
const MAX_WORD_COUNT = 2500;
const DEFAULT_WORD_COUNT = 650;

const FAQ_SCHEMA_ITEM = {
  type: 'object',
  properties: { question: { type: 'string' }, answer: { type: 'string' } },
  required: ['question', 'answer'],
  additionalProperties: false,
};

const DRAFT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    slug: { type: 'string' },
    excerpt: { type: 'string' },
    seo_title: { type: 'string' },
    seo_description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    body: { type: 'string' },
    faq: { type: 'array', items: FAQ_SCHEMA_ITEM },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, url: { type: 'string' } },
        required: ['label', 'url'],
        additionalProperties: false,
      },
    },
    related_business_refs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { vertical: { type: 'string' }, slug: { type: 'string' } },
        required: ['vertical', 'slug'],
        additionalProperties: false,
      },
    },
    related_product_refs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { module: { type: 'string' }, slug: { type: 'string' } },
        required: ['module', 'slug'],
        additionalProperties: false,
      },
    },
    recipe_meta: {
      type: ['object', 'null'],
      properties: {
        duration_minutes: { type: 'integer' },
        difficulty: { type: 'string' },
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
    },
    image_prompt: { type: 'string' },
    image_alt_text: { type: 'string' },
    cta: { type: 'string' },
    internal_link_suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, path: { type: 'string' }, reason: { type: 'string' } },
        required: ['label', 'path', 'reason'],
        additionalProperties: false,
      },
    },
    needsFactChecking: { type: 'boolean' },
    factCheckingNotes: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'title', 'slug', 'excerpt', 'seo_title', 'seo_description', 'tags', 'body', 'faq', 'sources',
    'related_business_refs', 'related_product_refs', 'recipe_meta', 'image_prompt',
    'image_alt_text', 'cta', 'internal_link_suggestions', 'needsFactChecking',
    'factCheckingNotes', 'warnings',
  ],
  additionalProperties: false,
};

const RecipeMetaSchema = z.object({
  duration_minutes: z.number().int().min(1).max(600),
  difficulty: z.string().min(1).max(64),
  ingredients: z.array(z.object({ quantity: z.string().max(80), name: z.string().min(1).max(120) })).max(80),
  steps: z.array(z.string().min(1).max(600)).min(1).max(40),
});

const DraftResultSchema = z.object({
  title: z.string().min(10).max(191),
  slug: z.string().min(3).max(191),
  excerpt: z.string().min(20).max(500),
  seo_title: z.string().min(10).max(191),
  seo_description: z.string().min(40).max(500),
  tags: z.array(z.string().min(1).max(50)).max(16),
  body: z.string().min(400),
  faq: z.array(z.object({ question: z.string().min(8).max(240), answer: z.string().min(12).max(800) })).min(2).max(10),
  sources: z.array(z.object({ label: z.string().min(2).max(160), url: z.string().url().max(300) })).max(8),
  related_business_refs: z.array(z.object({ vertical: z.string().min(1).max(40), slug: z.string().min(1).max(191) })).max(12),
  related_product_refs: z.array(z.object({ module: z.string().min(1).max(40), slug: z.string().min(1).max(191) })).max(20),
  recipe_meta: RecipeMetaSchema.nullable(),
  image_prompt: z.string().max(1200),
  image_alt_text: z.string().max(191),
  cta: z.string().max(300),
  internal_link_suggestions: z.array(z.object({ label: z.string().min(1).max(120), path: z.string().min(1).max(300), reason: z.string().min(1).max(240) })).max(12),
  needsFactChecking: z.boolean(),
  factCheckingNotes: z.array(z.string().min(1).max(400)).max(12),
  warnings: z.array(z.string().min(1).max(400)).max(12),
});

class AIDraftError extends Error {
  constructor(message, { code = 'AI_DRAFT_ERROR', status = 400, retryable = false, details = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

function normalizeProviderError(error) {
  if (error instanceof AIDraftError) return error;
  if (error instanceof AIProviderError) return new AIDraftError(error.message, { code: error.code, status: error.status, retryable: error.retryable });
  return error;
}

function assertLength(value, max, label) {
  if (value && String(value).length > max) throw new AIDraftError(`${label} est trop long.`, { code: 'AI_INPUT_TOO_LONG', status: 400 });
}

function clampWordCount(wordCount, longForm) {
  const requested = Number(wordCount || (longForm ? 1800 : DEFAULT_WORD_COUNT));
  if (!Number.isFinite(requested) || requested <= 0) return longForm ? 1800 : DEFAULT_WORD_COUNT;
  return Math.min(Math.max(Math.round(requested), longForm ? 1200 : 400), MAX_WORD_COUNT);
}

function truncateText(value, max) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function textFrom(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(textFrom).filter(Boolean).join('\n\n');
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.body === 'string') return value.body;
    return '';
  }
  return String(value).trim();
}

function stringArrayFrom(value, { max = 12, itemMax = 80 } = {}) {
  const list = Array.isArray(value) ? value : textFrom(value).split(',');
  return [...new Set(list.map(item => truncateText(item, itemMax)).filter(Boolean))].slice(0, max);
}

function makeSlug(value, fallback = 'article-ifilino') {
  const slug = textFrom(value || fallback)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 191);
  return slug.length >= 3 ? slug : 'article-ifilino';
}

function stripMarkdown(value) {
  return textFrom(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveExcerpt(body, topic) {
  const clean = stripMarkdown(body);
  const firstSentence = clean.split(/(?<=[.!?])\s+/).find(part => part.length >= 35) || clean;
  return truncateText(firstSentence || `Un guide iFilino pour mieux préparer ${topic}.`, 500);
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function normalizeFaq(value, topic) {
  const rawItems = Array.isArray(value) ? value : [];
  const faq = rawItems.map(item => ({
    question: truncateText(textFrom(item?.question || item?.q), 240),
    answer: truncateText(textFrom(item?.answer || item?.a || item?.response), 800),
  })).filter(item => item.question.length >= 8 && item.answer.length >= 12).slice(0, 10);
  while (faq.length < 2) {
    if (!faq.some(item => item.question === 'Que faut-il vérifier avant de publier cet article ?')) {
      faq.push({
        question: 'Que faut-il vérifier avant de publier cet article ?',
        answer: 'Vérifiez les noms, prix, disponibilités, horaires et liens avant publication dans iFilino Discover.',
      });
    } else {
      faq.push({
        question: `Comment utiliser ce guide sur ${truncateText(topic, 90)} ?`,
        answer: 'Servez-vous du brouillon comme base éditoriale, puis ajoutez les informations locales confirmées dans le CMS.',
      });
    }
  }
  return faq;
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    label: truncateText(textFrom(item?.label || item?.title || item?.name), 160),
    url: textFrom(item?.url || item?.href || item?.link),
  })).filter(item => item.label.length >= 2 && isValidUrl(item.url)).slice(0, 8);
}

function normalizeRefs(value, keys) {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const normalized = {};
    for (const key of keys) normalized[key] = truncateText(textFrom(item?.[key]), key === 'slug' ? 191 : 40);
    return normalized;
  }).filter(item => keys.every(key => item[key])).slice(0, 20);
}

function normalizeRecipeMeta(value, category) {
  if (category !== 'recette') return null;
  const ingredients = Array.isArray(value?.ingredients) ? value.ingredients.map(item => ({
    quantity: truncateText(textFrom(item?.quantity || item?.qty || ''), 80),
    name: truncateText(textFrom(item?.name || item), 120),
  })).filter(item => item.name).slice(0, 80) : [];
  const steps = stringArrayFrom(value?.steps, { max: 40, itemMax: 600 });
  return {
    duration_minutes: Math.min(Math.max(Number.parseInt(value?.duration_minutes || value?.duration || 30, 10) || 30, 1), 600),
    difficulty: truncateText(textFrom(value?.difficulty || 'Facile'), 64),
    ingredients: ingredients.length ? ingredients : [{ quantity: 'À ajuster', name: 'Ingrédients à confirmer' }],
    steps: steps.length ? steps : ['Compléter les étapes de préparation après validation éditoriale.'],
  };
}

function buildFallbackBody({ topic, title, excerpt }) {
  const heading = title || `Guide iFilino : ${topic}`;
  return [
    `## ${heading}`,
    excerpt || `Ce brouillon présente les points essentiels à vérifier autour de ${topic}.`,
    '',
    `## Points à retenir`,
    `- Vérifier les informations locales avant publication.`,
    `- Garder uniquement les commerces, produits et promotions confirmés dans iFilino.`,
    `- Ajouter des détails pratiques utiles au lecteur lorsque les données sont disponibles.`,
    '',
    `> 💡 Astuce iFilino : utilisez ce brouillon comme base, puis enrichissez-le avec des informations validées depuis le CMS.`,
    '',
    `## Avant publication`,
    `Relisez les prix, horaires, disponibilités et liens internes. Si une information manque, indiquez clairement qu'elle doit être complétée par l'équipe éditoriale.`,
  ].join('\n');
}

function normalizeDraft(raw, { topic, requestedTitle, category }) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackTitle = truncateText(textFrom(requestedTitle || source.title || `Guide iFilino : ${topic}`), 191);
  const title = fallbackTitle.length >= 10 ? fallbackTitle : truncateText(`Guide iFilino : ${topic}`, 191);
  let body = textFrom(source.body || source.content || source.markdown || source.article || source.article_body);
  const excerpt = truncateText(textFrom(source.excerpt || source.summary || source.description) || deriveExcerpt(body, topic), 500);
  if (body.length < 400) body = buildFallbackBody({ topic, title, excerpt });
  const faq = normalizeFaq(source.faq || source.faqs || source.questions, topic);
  const tags = stringArrayFrom(source.tags || source.keywords, { max: 16, itemMax: 50 });
  if (!tags.length) tags.push('iFilino', 'guide local');
  const seoDescription = truncateText(textFrom(source.seo_description || source.meta_description) || excerpt, 500);

  return {
    title,
    slug: makeSlug(source.slug || title),
    excerpt,
    seo_title: truncateText(textFrom(source.seo_title) || title, 191),
    seo_description: seoDescription.length >= 40 ? seoDescription : truncateText(`${seoDescription} Guide pratique proposé par iFilino.`, 500),
    tags,
    body,
    faq,
    sources: normalizeSources(source.sources),
    related_business_refs: normalizeRefs(source.related_business_refs || source.business_refs, ['vertical', 'slug']).slice(0, 12),
    related_product_refs: normalizeRefs(source.related_product_refs || source.product_refs, ['module', 'slug']).slice(0, 20),
    recipe_meta: normalizeRecipeMeta(source.recipe_meta, category),
    image_prompt: truncateText(textFrom(source.image_prompt || source.hero_image_prompt) || `Photo éditoriale réaliste pour un article iFilino sur ${topic}, ambiance locale chaleureuse, sans texte incrusté.`, 1200),
    image_alt_text: truncateText(textFrom(source.image_alt_text || source.image_alt) || title, 191),
    cta: truncateText(textFrom(source.cta) || 'Découvrez les commerces et produits disponibles sur iFilino.', 300),
    internal_link_suggestions: normalizeRefs(source.internal_link_suggestions || source.links, ['label', 'path', 'reason']).slice(0, 12),
    needsFactChecking: Boolean(source.needsFactChecking || source.needs_fact_checking),
    factCheckingNotes: stringArrayFrom(source.factCheckingNotes || source.fact_checking_notes, { max: 12, itemMax: 400 }),
    warnings: stringArrayFrom(source.warnings, { max: 12, itemMax: 400 }),
  };
}

function validateDraft(raw, options = {}) {
  const normalized = normalizeDraft(raw, options);
  const parsed = DraftResultSchema.safeParse(normalized);
  if (parsed.success) return parsed.data;
  throw new AIDraftError('La réponse IA ne respecte pas le format attendu.', {
    code: 'AI_VALIDATION_ERROR', status: 502,
    details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
  });
}

async function gatherContext({ vertical = null, cityId = null } = {}) {
  const context = { city: null, businesses: [], promotions: [] };
  if (cityId) {
    const city = await City.findByPk(cityId);
    if (city) context.city = { name: city.name, slug: city.slug, region: city.region };
  }
  const verticalsToScan = vertical && VERTICALS[vertical] ? [vertical] : Object.keys(VERTICALS);
  for (const v of verticalsToScan) {
    const listing = v === 'restaurant' ? await publicDataService.listRestaurants({ cityId, limit: 6 }) : await publicDataService.listBusinesses({ vertical: v, cityId, limit: 6 });
    const rows = listing.restaurants || listing.businesses || [];
    for (const biz of rows) {
      const detail = v === 'restaurant' ? await publicDataService.getRestaurantBySlug(biz.slug) : await publicDataService.getBusinessBySlug(v, biz.slug);
      if (!detail) continue;
      const products = (detail.menu_items || detail.products || []).filter(p => p.slug).slice(0, 5).map(p => ({ module: VERTICALS[v].productModule, slug: p.slug, name: p.name, price: p.price }));
      context.businesses.push({
        id: detail.id, vertical: v, slug: detail.slug, name: detail.name,
        city: detail.city, description: detail.description, rating: detail.avg_rating,
        cover_url: detail.cover_url || null, logo_url: detail.logo_url || null, products,
      });
    }
    if (context.businesses.length >= 10) break;
  }
  const orgIds = context.businesses.map(b => b.id).filter(Boolean);
  if (orgIds.length) {
    const now = new Date();
    const coupons = await Coupon.findAll({ where: { active: true, organization_id: { [Op.in]: orgIds }, [Op.or]: [{ valid_until: null }, { valid_until: { [Op.gte]: now } }] }, limit: 10 });
    context.promotions = coupons.map(c => {
      const biz = context.businesses.find(b => b.id === c.organization_id);
      return { code: c.code, type: c.type, value: Number(c.value), business_slug: biz ? biz.slug : null, business_name: biz ? biz.name : null, valid_until: c.valid_until };
    }).filter(p => p.business_slug);
  }
  return context;
}

function buildCandidatesText(context) {
  const lines = [];
  lines.push(context.city ? `Ville ciblée : ${context.city.name}${context.city.region ? ` (${context.city.region})` : ''}.` : 'Aucune ville spécifique — portée nationale.');
  if (!context.businesses.length) {
    lines.push('\nAucun commerce candidat disponible pour ce filtre — écrire un article général sans lien commerce/produit. Ajouter needsFactChecking=true si des informations factuelles restent à compléter.');
    return lines.join('\n');
  }
  lines.push('\nCommerces disponibles (slugs exacts, à utiliser tels quels — ne jamais en inventer d\'autres) :');
  for (const b of context.businesses) {
    lines.push(`- [vertical=${b.vertical}] "${b.name}" — slug="${b.slug}" — ${b.city || ''} — note ${b.rating ?? '?'}/5${b.description ? ` — ${String(b.description).slice(0, 140)}` : ''}`);
    for (const p of b.products) lines.push(`    · produit [module=${p.module}] "${p.name}" — slug="${p.slug}"${p.price != null ? ` — ${p.price} MAD` : ''}`);
  }
  if (context.promotions.length) {
    lines.push('\nPromotions actives (peuvent être mentionnées si pertinentes, sans extrapoler) :');
    for (const p of context.promotions) {
      const remise = p.type === 'percent' ? `${p.value}%` : `${p.value} MAD`;
      lines.push(`- Code "${p.code}" (${remise} de réduction) chez "${p.business_name}" (slug="${p.business_slug}")${p.valid_until ? `, valable jusqu'au ${p.valid_until}` : ''}`);
    }
  }
  return lines.join('\n');
}

function buildSystemPrompt({ longForm, wordCount }) {
  const lines = [
    "Tu es rédacteur éditorial pour iFilino Discover, le magazine intégré à la marketplace iFilino (restaurants, épiceries/hanouts, pharmacies).",
    "Tu écris en français par défaut, avec un ton chaleureux, concret et local — jamais promotionnel à l'excès, jamais générique.",
    "RÈGLE ABSOLUE : tu ne dois citer QUE les commerces et produits listés dans la section CANDIDATS du message utilisateur, avec leurs slugs EXACTS. N'invente jamais un nom de commerce, un produit, un prix, un délai, une note, une adresse, une promotion, un horaire ou un slug qui n'y figure pas.",
    "Si aucune donnée réelle ne permet d'affirmer un point commercial, utilise un contenu générique et ajoute une note dans factCheckingNotes. Utilise 'À compléter' dans le brouillon si une donnée éditoriale doit être vérifiée.",
    "related_business_refs et related_product_refs doivent être un sous-ensemble EXACT des candidats fournis (mêmes vertical/module et slug, caractère pour caractère).",
    "Si la catégorie est 'recette', remplis recipe_meta avec une recette cohérente avec le sujet ; sinon renvoie recipe_meta à null.",
    "Insère naturellement dans body 1 à 3 encadrés éditoriaux en citation Markdown, parmi : 💡 Astuce iFilino, ⚠ À éviter, ⭐ Bon à savoir, ✔ Conseil d'expert, 🎯 Recommandation.",
    "Si le sujet touche santé, nutrition, beauté ou sécurité, remplis sources uniquement avec des organismes reconnus et des URLs réelles dont tu es sûr. Si tu n'es pas sûr, sources doit être []. N'invente jamais une source.",
    "image_prompt décrit une image hero réaliste à générer ou préparer, sans marque inventée ni promesse commerciale non sourcée. image_alt_text doit être court et accessible.",
    "internal_link_suggestions peut proposer des chemins publics iFilino pertinents (/marketplace, /discover, ou les slugs fournis), sans inventer d'URL.",
    `Nombre de mots cible pour body : environ ${wordCount} mots.`,
  ];
  if (longForm) lines.push("Le corps (body) est en Markdown, structuré avec une introduction engageante, 4 à 7 sous-titres ## (et quelques ### si utile), des listes à puces, au moins un encadré conseil en citation Markdown (commence par '> 💡 Astuce iFilino :'), et une conclusion avec un appel à l'action vers iFilino. Pas de titre H1.", "faq contient 5 à 8 questions/réponses réalistes et utiles pour le lecteur, en lien direct avec le sujet.");
  else lines.push("Le corps (body) est en Markdown : 2 à 4 sous-titres avec ##, pas de titre H1.", "faq contient 3 à 4 questions/réponses courtes et utiles.");
  return lines.join('\n');
}

function resolveHeroImage(context, relatedBusinessRefs) {
  const bySlug = new Map(context.businesses.map(b => [`${b.vertical}:${b.slug}`, b]));
  for (const ref of relatedBusinessRefs) {
    const biz = bySlug.get(`${ref.vertical}:${ref.slug}`);
    if (biz?.cover_url) return biz.cover_url;
  }
  const fallback = context.businesses.find(b => b.cover_url);
  return fallback ? fallback.cover_url : null;
}

function sanitizeRefs(parsed, context) {
  const validBusinessKeys = new Set(context.businesses.map(b => `${b.vertical}:${b.slug}`));
  const validProductKeys = new Set(context.businesses.flatMap(b => b.products.map(p => `${p.module}:${p.slug}`)));
  return {
    related_business_refs: (parsed.related_business_refs || []).filter(r => validBusinessKeys.has(`${r.vertical}:${r.slug}`)),
    related_product_refs: (parsed.related_product_refs || []).filter(r => validProductKeys.has(`${r.module}:${r.slug}`)),
  };
}

async function generateDraft({ topic, title = null, language = 'fr', category, rubrique = null, cityId = null, vertical = null, tone = 'chaleureux, concret et local', wordCount = null, keywords = [], businesses = [], products = [], factualInfo = '', editorialInstructions = '', authorId = null, longForm = false, aiProvider = null } = {}) {
  const cleanTopic = String(topic || '').trim();
  assertLength(cleanTopic, MAX_TOPIC_LENGTH, 'Le sujet');
  assertLength(editorialInstructions, MAX_EDITORIAL_INSTRUCTIONS_LENGTH, 'Les consignes éditoriales');
  assertLength(factualInfo, MAX_FACTS_LENGTH, 'Les informations factuelles');
  if (!cleanTopic) throw new AIDraftError('Le sujet est requis.', { code: 'AI_INVALID_INPUT', status: 400 });
  if (!ARTICLE_CATEGORIES.includes(category)) throw new AIDraftError(`Catégorie invalide : ${category}`, { code: 'INVALID_CATEGORY', status: 400 });
  if (rubrique && !RUBRIQUE_KEYS.includes(rubrique)) throw new AIDraftError(`Rubrique invalide : ${rubrique}`, { code: 'INVALID_RUBRIQUE', status: 400 });

  const requestId = crypto.randomUUID();
  const finalWordCount = clampWordCount(wordCount, longForm);
  const provider = aiProvider || createAIProvider();
  const context = await gatherContext({ vertical, cityId });
  const candidatesText = buildCandidatesText(context);
  const input = [
    `Sujet de l'article : ${cleanTopic}`,
    title ? `Titre souhaité : ${title}` : null,
    `Langue demandée : ${language || 'fr'}`,
    `Catégorie : ${category}`,
    rubrique ? `Rubrique magazine : ${RUBRIQUES[rubrique].label}` : null,
    `Ton : ${tone}`,
    keywords?.length ? `Mots-clés à intégrer naturellement : ${keywords.join(', ')}` : null,
    businesses?.length ? `Commerces fournis par l'éditeur : ${JSON.stringify(businesses).slice(0, 1500)}` : null,
    products?.length ? `Produits fournis par l'éditeur : ${JSON.stringify(products).slice(0, 1500)}` : null,
    factualInfo ? `Informations factuelles fournies par l'éditeur :\n${factualInfo}` : null,
    editorialInstructions ? `Consignes éditoriales supplémentaires :\n${editorialInstructions}` : null,
    '',
    'CANDIDATS (seules sources autorisées pour les liens produits/commerces) :',
    candidatesText,
  ].filter(Boolean).join('\n');

  let parsed;
  try {
    parsed = await provider.generateStructuredData({
      instructions: buildSystemPrompt({ longForm, wordCount: finalWordCount }),
      input,
      jsonSchema: DRAFT_JSON_SCHEMA,
      schemaName: 'ifilino_magazine_draft',
      maxOutputTokens: longForm ? 16000 : 8000,
      requestId,
    });
    parsed = validateDraft(parsed, { topic: cleanTopic, requestedTitle: title, category });
  } catch (error) {
    throw normalizeProviderError(error);
  }

  const { related_business_refs, related_product_refs } = sanitizeRefs(parsed, context);
  const droppedBusinessRefs = (parsed.related_business_refs || []).length - related_business_refs.length;
  const droppedProductRefs = (parsed.related_product_refs || []).length - related_product_refs.length;
  const factCheckingNotes = [...(parsed.factCheckingNotes || [])];
  if (droppedBusinessRefs || droppedProductRefs) factCheckingNotes.push('Certaines références IA ont été retirées car elles ne correspondaient pas aux données iFilino disponibles.');
  if (!context.businesses.length) factCheckingNotes.push('Aucun commerce réel disponible pour ce filtre : vérifier et compléter les éventuelles données locales avant publication.');

  const slug = await generateUniqueSlug(Article, parsed.title);
  const article = await Article.create({
    slug, title: parsed.title, excerpt: parsed.excerpt, category, rubrique: rubrique || undefined,
    body: parsed.body, tags: parsed.tags || [], faq: parsed.faq || [], sources: parsed.sources || [],
    related_product_refs, related_business_refs, city_id: cityId || null,
    recipe_meta: category === 'recette' ? parsed.recipe_meta : null,
    cover_image_url: resolveHeroImage(context, related_business_refs),
    image_prompt: parsed.image_prompt || null, image_alt_text: parsed.image_alt_text || null,
    status: 'draft', author_id: authorId,
    seo_title: parsed.seo_title || null, seo_description: parsed.seo_description || null,
    generated_by_ai: true,
  });
  article.setDataValue('ai_metadata', {
    provider: aiConfig.provider, model: aiConfig.model, requestId,
    imagePrompt: parsed.image_prompt, imageAltText: parsed.image_alt_text, cta: parsed.cta,
    internalLinkSuggestions: parsed.internal_link_suggestions,
    needsFactChecking: parsed.needsFactChecking || factCheckingNotes.length > 0,
    factCheckingNotes, warnings: parsed.warnings || [],
  });
  return article;
}

async function testConnection() {
  const provider = createAIProvider();
  await provider.testConnection();
  return getAiPublicStatus();
}

module.exports = { generateDraft, gatherContext, testConnection, getAiPublicStatus, DRAFT_JSON_SCHEMA, DraftResultSchema, AIDraftError };
