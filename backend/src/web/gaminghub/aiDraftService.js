'use strict';

/**
 * Moteur de brouillons IA — iFilino Gaming Hub. Clone du pattern éprouvé de
 * discover/aiDraftService.js, adapté à des fiches sur des jeux tiers célèbres
 * (Dofus, Minecraft...) plutôt qu'à des commerces marketplace.
 *
 * Garde-fou légal (respect §10 du besoin) : contrairement à Discover où l'IA
 * peut citer des commerces réels de la base, ici il n'existe AUCUNE source de
 * vérité interne sur un jeu tiers. L'IA ne doit donc JAMAIS inventer une date
 * de sortie, une configuration système ou un lien officiel — ces trois champs
 * sont structurellement exclus du schéma IA (jamais demandés au modèle) et
 * restent réservés à la saisie manuelle d'un admin. L'IA ne produit que du
 * contenu narratif/éditorial (description, gameplay, FAQ, SEO), et les
 * `sources` renvoyées sont filtrées pour ne garder que celles effectivement
 * fournies par l'admin (jamais une URL inventée par le modèle).
 *
 * Le brouillon n'est JAMAIS publié automatiquement (status='draft') :
 * validation humaine obligatoire via l'admin avant mise en ligne.
 */

const crypto = require('crypto');
const { z } = require('zod');
const { GamingGame, GamingArticle } = require('../../../models');
const { generateUniqueSlug } = require('../../shared/utils/slug');
const { createAIProvider, getAiPublicStatus, AIProviderError, aiConfig } = require('../../services/ai/openaiProvider');

const ARTICLE_TYPES = ['actualite', 'guide', 'astuce', 'test', 'classement', 'comparatif', 'top', 'collection'];

const MAX_FACTS_LENGTH = 3000;
const MAX_EDITORIAL_INSTRUCTIONS_LENGTH = 1200;

const FAQ_SCHEMA_ITEM = {
  type: 'object',
  properties: { question: { type: 'string' }, answer: { type: 'string' } },
  required: ['question', 'answer'],
  additionalProperties: false,
};

// Volontairement SANS release_date/configuration/official_links — voir note
// en tête de fichier : ces champs ne sont jamais confiés à l'IA.
const DRAFT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    seo_title: { type: 'string' },
    seo_description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    presentation: { type: 'string' },
    why_popular: { type: 'string' },
    gameplay: { type: 'string' },
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
    needsFactChecking: { type: 'boolean' },
    factCheckingNotes: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'seo_title', 'seo_description', 'tags', 'description', 'presentation', 'why_popular',
    'gameplay', 'faq', 'sources', 'needsFactChecking', 'factCheckingNotes', 'warnings',
  ],
  additionalProperties: false,
};

const DraftResultSchema = z.object({
  seo_title: z.string().min(10).max(191),
  seo_description: z.string().min(40).max(500),
  tags: z.array(z.string().min(1).max(50)).max(16),
  description: z.string().min(80).max(3000),
  presentation: z.string().max(3000),
  why_popular: z.string().min(40).max(3000),
  gameplay: z.string().min(40).max(3000),
  faq: z.array(z.object({ question: z.string().min(8).max(240), answer: z.string().min(12).max(800) })).min(2).max(10),
  sources: z.array(z.object({ label: z.string().min(2).max(160), url: z.string().url().max(300) })).max(8),
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

function truncateText(value, max) {
  const text = String(value == null ? '' : value).trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function normalizeFaq(value) {
  const rawItems = Array.isArray(value) ? value : [];
  return rawItems.map(item => ({
    question: truncateText(item?.question, 240),
    answer: truncateText(item?.answer, 800),
  })).filter(item => item.question.length >= 8 && item.answer.length >= 12).slice(0, 10);
}

// Ne garde que les sources effectivement fournies par l'admin (même label+url) —
// une URL que le modèle aurait reformulée ou inventée est silencieusement
// écartée, jamais affichée comme "source" d'une fiche jeu tiers.
function sanitizeSources(parsedSources, adminSources) {
  const allowed = new Set((adminSources || []).map(s => String(s.url || '').trim()));
  return (Array.isArray(parsedSources) ? parsedSources : [])
    .filter(s => isValidUrl(s.url) && allowed.has(String(s.url).trim()))
    .slice(0, 8);
}

function buildSystemPrompt() {
  return [
    "Tu es rédacteur éditorial pour iFilino Gaming Hub, un portail de type magazine (comparable à IGN/GameSpot) qui publie des fiches sur des jeux vidéo tiers célèbres.",
    "IMPORTANT — tu écris à propos d'un jeu qui NE t'appartient PAS et n'est PAS distribué par iFilino. N'affirme jamais qu'iFilino édite, distribue ou est affilié à ce jeu.",
    "RÈGLE ABSOLUE : ne mentionne AUCUNE date de sortie précise, configuration système, prix ou lien officiel — ces informations sont gérées séparément par l'équipe éditoriale à partir de sources vérifiées. Reste sur la description, l'univers, le gameplay et pourquoi le jeu est populaire.",
    "N'invente jamais un fait vérifiable (chiffres de ventes, récompenses, citations) que tu ne peux pas sourcer avec certitude. En cas de doute, reste général et ajoute une note dans factCheckingNotes.",
    "sources : ne renvoie QUE des entrées reprenant exactement une URL fournie dans 'Sources fournies par l'éditeur' ci-dessous (même label si possible). Si aucune source n'est fournie, renvoie un tableau vide — n'invente jamais une URL.",
    "Ton neutre, informatif, orienté joueur curieux — jamais promotionnel envers un concurrent, jamais dénigrant.",
    "Rappelle implicitement (sans lourdeur juridique) que la marque appartient à son éditeur.",
  ].join('\n');
}

async function generateGameDraft({
  name, publisherName = null, genre = null, universe = null,
  factualInfo = '', sources = [], editorialInstructions = '', authorId = null,
  publisherId = null, categoryId = null, aiProvider = null,
} = {}) {
  const cleanName = String(name || '').trim();
  assertLength(editorialInstructions, MAX_EDITORIAL_INSTRUCTIONS_LENGTH, 'Les consignes éditoriales');
  assertLength(factualInfo, MAX_FACTS_LENGTH, 'Les informations factuelles');
  if (!cleanName) throw new AIDraftError('Le nom du jeu est requis.', { code: 'AI_INVALID_INPUT', status: 400 });

  const cleanSources = Array.isArray(sources)
    ? sources.map(s => ({ label: truncateText(s?.label, 160), url: truncateText(s?.url, 300) })).filter(s => s.label && isValidUrl(s.url)).slice(0, 8)
    : [];

  const requestId = crypto.randomUUID();
  const provider = aiProvider || createAIProvider();

  const input = [
    `Jeu : ${cleanName}`,
    publisherName ? `Éditeur/studio : ${publisherName}` : null,
    genre ? `Genre : ${genre}` : null,
    universe ? `Univers : ${universe}` : null,
    factualInfo ? `Informations factuelles fournies par l'éditeur (à utiliser en priorité) :\n${factualInfo}` : "Aucune information factuelle fournie — reste général sur la description/gameplay et signale needsFactChecking=true.",
    editorialInstructions ? `Consignes éditoriales supplémentaires :\n${editorialInstructions}` : null,
    '',
    cleanSources.length
      ? `Sources fournies par l'éditeur (seules URLs autorisées dans "sources") :\n${cleanSources.map(s => `- ${s.label} : ${s.url}`).join('\n')}`
      : 'Aucune source fournie — le champ "sources" doit rester vide.',
  ].filter(Boolean).join('\n');

  let parsed;
  try {
    const raw = await provider.generateStructuredData({
      instructions: buildSystemPrompt(),
      input,
      jsonSchema: DRAFT_JSON_SCHEMA,
      schemaName: 'ifilino_gaminghub_draft',
      maxOutputTokens: 6000,
      requestId,
    });
    const result = DraftResultSchema.safeParse(raw);
    if (!result.success) {
      throw new AIDraftError('La réponse IA ne respecte pas le format attendu.', {
        code: 'AI_VALIDATION_ERROR', status: 502,
        details: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    parsed = result.data;
  } catch (error) {
    throw normalizeProviderError(error);
  }

  const finalSources = sanitizeSources(parsed.sources, cleanSources);
  const faq = normalizeFaq(parsed.faq);
  const factCheckingNotes = [...(parsed.factCheckingNotes || [])];
  if (!factualInfo && !cleanSources.length) factCheckingNotes.push("Aucune information factuelle ni source fournie par l'éditeur : relire attentivement avant publication.");

  const slug = await generateUniqueSlug(GamingGame, cleanName);
  const game = await GamingGame.create({
    slug,
    name: cleanName,
    publisher_id: publisherId || null,
    category_id: categoryId || null,
    genre: genre || null,
    universe: universe || null,
    tags: parsed.tags || [],
    description: parsed.description,
    presentation: parsed.presentation || null,
    why_popular: parsed.why_popular,
    gameplay: parsed.gameplay,
    sources: finalSources,
    status: 'draft',
    author_id: authorId,
    seo_title: parsed.seo_title || null,
    seo_description: parsed.seo_description || null,
    generated_by_ai: true,
  });
  game.setDataValue('ai_metadata', {
    provider: aiConfig.provider, model: aiConfig.model, requestId,
    needsFactChecking: parsed.needsFactChecking || factCheckingNotes.length > 0,
    factCheckingNotes, warnings: parsed.warnings || [],
    faqSuggested: faq,
  });
  return { game, faq };
}

async function testConnection() {
  const provider = createAIProvider();
  await provider.testConnection();
  return getAiPublicStatus();
}

// ── Brouillons d'articles éditoriaux (Top X, comparatifs, astuces...) ───────
//
// Même garde-fou que Discover : l'IA ne doit citer QUE des jeux qui existent
// réellement dans gaming_games (candidats fournis ci-dessous, avec leur slug
// exact) — jamais un jeu tiers inventé ou sans fiche sur iFilino Gaming Hub.
// Ça garantit que chaque nom de jeu cité dans un article peut être lié en
// interne vers une fiche réelle, et empêche l'IA d'halluciner un jeu qui
// n'existe pas.

const ARTICLE_JSON_SCHEMA = {
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
    related_game_slugs: { type: 'array', items: { type: 'string' } },
    needsFactChecking: { type: 'boolean' },
    factCheckingNotes: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'title', 'slug', 'excerpt', 'seo_title', 'seo_description', 'tags', 'body', 'faq', 'sources',
    'related_game_slugs', 'needsFactChecking', 'factCheckingNotes', 'warnings',
  ],
  additionalProperties: false,
};

const ArticleDraftResultSchema = z.object({
  title: z.string().min(10).max(191),
  slug: z.string().min(3).max(191),
  excerpt: z.string().min(20).max(500),
  seo_title: z.string().min(10).max(191),
  seo_description: z.string().min(40).max(500),
  tags: z.array(z.string().min(1).max(50)).max(16),
  body: z.string().min(400),
  faq: z.array(z.object({ question: z.string().min(8).max(240), answer: z.string().min(12).max(800) })).min(2).max(10),
  sources: z.array(z.object({ label: z.string().min(2).max(160), url: z.string().url().max(300) })).max(8),
  related_game_slugs: z.array(z.string().min(1).max(191)).max(30),
  needsFactChecking: z.boolean(),
  factCheckingNotes: z.array(z.string().min(1).max(400)).max(12),
  warnings: z.array(z.string().min(1).max(400)).max(12),
});

async function gatherGameCandidates({ gameSlugs = [] } = {}) {
  const where = { status: 'published' };
  if (Array.isArray(gameSlugs) && gameSlugs.length) where.slug = gameSlugs;
  const games = await GamingGame.findAll({
    where, attributes: ['id', 'slug', 'name', 'genre', 'universe', 'why_popular'], limit: 40,
  });
  return games;
}

function buildArticleCandidatesText(games) {
  if (!games.length) return "Aucune fiche jeu publiée disponible — écrire un article général sans citer de jeu précis, et ajouter needsFactChecking=true.";
  const lines = ['Jeux disponibles sur iFilino Gaming Hub (slugs exacts, à utiliser tels quels — ne jamais en inventer d\'autres) :'];
  for (const g of games) {
    lines.push(`- "${g.name}" — slug="${g.slug}"${g.genre ? ` — genre: ${g.genre}` : ''}${g.universe ? ` — univers: ${g.universe}` : ''}`);
  }
  return lines.join('\n');
}

function buildArticleSystemPrompt({ articleType, wordCount }) {
  return [
    "Tu es rédacteur éditorial pour iFilino Gaming Hub, un portail de type magazine gaming (comparable à IGN/GameSpot).",
    `Tu rédiges un article de type "${articleType}".`,
    "RÈGLE ABSOLUE : tu ne dois citer QUE les jeux listés dans la section CANDIDATS, avec leurs slugs EXACTS. N'invente jamais un jeu, un slug, un genre ou un fait qui n'y figure pas.",
    "related_game_slugs doit être un sous-ensemble EXACT des slugs candidats fournis.",
    "N'affirme jamais qu'iFilino édite ou distribue les jeux mentionnés — ce sont des marques tierces, propriété de leurs éditeurs respectifs.",
    "Ne mentionne aucune date de sortie précise ni configuration système que tu ne peux pas sourcer avec certitude — reste général si besoin et signale needsFactChecking=true.",
    "sources : ne renvoie QUE des entrées reprenant exactement une URL fournie par l'éditeur (voir message utilisateur). Si aucune n'est fournie, renvoie un tableau vide.",
    `Corps (body) en Markdown, ~${wordCount} mots, structuré avec des sous-titres ##, pas de titre H1. Pour un article de type "top"/"classement", utilise une liste numérotée claire.`,
    "faq contient 2 à 5 questions/réponses utiles au lecteur.",
  ].join('\n');
}

async function generateArticleDraft({
  topic, articleType, gameSlugs = [], factualInfo = '', sources = [],
  editorialInstructions = '', wordCount = 800, authorId = null, aiProvider = null,
} = {}) {
  const cleanTopic = String(topic || '').trim();
  assertLength(editorialInstructions, MAX_EDITORIAL_INSTRUCTIONS_LENGTH, 'Les consignes éditoriales');
  assertLength(factualInfo, MAX_FACTS_LENGTH, 'Les informations factuelles');
  if (!cleanTopic) throw new AIDraftError('Le sujet est requis.', { code: 'AI_INVALID_INPUT', status: 400 });
  if (!ARTICLE_TYPES.includes(articleType)) throw new AIDraftError(`Type d'article invalide : ${articleType}`, { code: 'INVALID_CATEGORY', status: 400 });

  const cleanSources = Array.isArray(sources)
    ? sources.map(s => ({ label: truncateText(s?.label, 160), url: truncateText(s?.url, 300) })).filter(s => s.label && isValidUrl(s.url)).slice(0, 8)
    : [];

  const requestId = crypto.randomUUID();
  const provider = aiProvider || createAIProvider();
  const candidates = await gatherGameCandidates({ gameSlugs });
  const candidatesText = buildArticleCandidatesText(candidates);
  const finalWordCount = Math.min(Math.max(Number(wordCount) || 800, 400), 2000);

  const input = [
    `Sujet de l'article : ${cleanTopic}`,
    `Type d'article : ${articleType}`,
    factualInfo ? `Informations factuelles fournies par l'éditeur :\n${factualInfo}` : null,
    editorialInstructions ? `Consignes éditoriales supplémentaires :\n${editorialInstructions}` : null,
    cleanSources.length ? `Sources fournies par l'éditeur (seules URLs autorisées) :\n${cleanSources.map(s => `- ${s.label} : ${s.url}`).join('\n')}` : 'Aucune source fournie — le champ "sources" doit rester vide.',
    '',
    'CANDIDATS (seuls jeux citables) :',
    candidatesText,
  ].filter(Boolean).join('\n');

  let parsed;
  try {
    const raw = await provider.generateStructuredData({
      instructions: buildArticleSystemPrompt({ articleType, wordCount: finalWordCount }),
      input,
      jsonSchema: ARTICLE_JSON_SCHEMA,
      schemaName: 'ifilino_gaminghub_article_draft',
      maxOutputTokens: 8000,
      requestId,
    });
    const result = ArticleDraftResultSchema.safeParse(raw);
    if (!result.success) {
      throw new AIDraftError('La réponse IA ne respecte pas le format attendu.', {
        code: 'AI_VALIDATION_ERROR', status: 502,
        details: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    parsed = result.data;
  } catch (error) {
    throw normalizeProviderError(error);
  }

  const candidateSlugs = new Set(candidates.map(g => g.slug));
  const validRelatedSlugs = (parsed.related_game_slugs || []).filter(s => candidateSlugs.has(s));
  const relatedGameIds = validRelatedSlugs.map(slug => candidates.find(g => g.slug === slug)?.id).filter(Boolean);
  const finalSources = sanitizeSources(parsed.sources, cleanSources);
  const faq = normalizeFaq(parsed.faq);
  const factCheckingNotes = [...(parsed.factCheckingNotes || [])];
  const droppedRefs = (parsed.related_game_slugs || []).length - validRelatedSlugs.length;
  if (droppedRefs > 0) factCheckingNotes.push('Certaines références de jeux IA ont été retirées car elles ne correspondaient pas aux fiches Gaming Hub disponibles.');
  if (!candidates.length) factCheckingNotes.push('Aucune fiche jeu publiée disponible au moment de la génération : vérifier les liens internes avant publication.');

  const slug = await generateUniqueSlug(GamingArticle, parsed.title);
  const article = await GamingArticle.create({
    slug, title: parsed.title, excerpt: parsed.excerpt, article_type: articleType,
    body: parsed.body, tags: parsed.tags || [], faq, sources: finalSources,
    related_game_ids: relatedGameIds, status: 'draft', author_id: authorId,
    seo_title: parsed.seo_title || null, seo_description: parsed.seo_description || null,
    generated_by_ai: true,
  });
  article.setDataValue('ai_metadata', {
    provider: aiConfig.provider, model: aiConfig.model, requestId,
    needsFactChecking: parsed.needsFactChecking || factCheckingNotes.length > 0,
    factCheckingNotes, warnings: parsed.warnings || [],
  });
  return { article };
}

module.exports = {
  generateGameDraft, generateArticleDraft, testConnection, getAiPublicStatus,
  DRAFT_JSON_SCHEMA, DraftResultSchema, ARTICLE_JSON_SCHEMA, ArticleDraftResultSchema, AIDraftError,
};
