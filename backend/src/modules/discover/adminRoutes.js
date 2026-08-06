'use strict';

/**
 * iFilino Discover — CRUD admin. Montées sous /api/superadmin/discover
 * (voir backend/routes/index.js), même pattern que
 * backend/src/modules/marketplaceHero/routes.js.
 *
 * GET    /articles              — liste paginée (tous statuts)
 * GET    /articles/:id          — détail pour l'éditeur
 * POST   /articles              — créer (brouillon)
 * PUT    /articles/:id          — mettre à jour
 * DELETE /articles/:id          — supprimer
 * PATCH  /articles/:id/publish  — bascule draft <-> published
 * POST   /articles/upload       — upload cover/gallery (sharp -> WebP)
 * POST   /preview               — rend un corps Markdown en HTML (aperçu éditeur)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { body, param, query } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { Article, ArticleTranslation } = require('../../../models');
const sequelize = require('../../../models/db');
async function rawQuery(sql) { const [rows] = await sequelize.query(sql); return rows; }
const { generateUniqueSlug } = require('../../shared/utils/slug');
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage } = require('./i18n');
const { computeReadingTime, parseMarkdown } = require('../../shared/markdown/markdownEngine');
const { toCoverWebp, toGalleryWebp } = require('./services/discoverImageService');
const aiDraftService = require('./aiDraftService');
const aiImageService = require('./aiImageService');
const translationService = require('./translationService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

const ARTICLE_FIELDS = [
  'title', 'excerpt', 'cover_image_url', 'image_prompt', 'image_alt_text', 'image_assets', 'category', 'rubrique', 'body', 'gallery', 'tags',
  'related_product_refs', 'related_business_refs', 'city_id', 'recipe_meta', 'faq', 'sources',
  'seo_title', 'seo_description',
];
function extractFields(src) {
  const out = {};
  for (const f of ARTICLE_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  return out;
}

function unicodeSlug(value, fallback = 'article') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 191);
  return slug || fallback;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
  return String(tags || '').split(',').map(t => t.trim()).filter(Boolean);
}

function extractTranslations(src) {
  const raw = src.translations || {};
  const translations = {};
  if (Array.isArray(raw)) {
    for (const tr of raw) if (tr?.language) translations[normalizeLanguage(tr.language)] = tr;
  } else {
    for (const [lang, tr] of Object.entries(raw)) translations[normalizeLanguage(lang)] = tr || {};
  }
  if (!Object.keys(translations).length && (src.title || src.body || src.excerpt || src.seo_title || src.seo_description || src.tags)) {
    translations[DEFAULT_LANGUAGE] = {
      title: src.title,
      slug: src.slug,
      excerpt: src.excerpt,
      content_md: src.body,
      seo_title: src.seo_title,
      seo_description: src.seo_description,
      tags: src.tags,
    };
  }
  const cleaned = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    const tr = translations[lang];
    if (!tr) continue;
    const title = String(tr.title || '').trim();
    const content = String(tr.content_md ?? tr.body ?? '').trim();
    const excerpt = String(tr.excerpt || '').trim();
    const seoTitle = String(tr.seo_title || '').trim();
    const seoDescription = String(tr.seo_description || '').trim();
    const slug = String(tr.slug || '').trim();
    const tags = normalizeTags(tr.tags);
    if (!title && !content && !excerpt && !seoTitle && !seoDescription && !slug && !tags.length) continue;
    cleaned[lang] = { title: title || (slug ? slug.replace(/-/g, ' ') : 'Article ' + lang.toUpperCase()), slug, excerpt, content_md: content, seo_title: seoTitle || null, seo_description: seoDescription || null, tags };
  }
  return cleaned;
}

async function uniqueTranslationSlug(articleId, language, base) {
  const root = unicodeSlug(base, 'article-' + articleId + '-' + language);
  let candidate = root;
  let n = 1;
  while (await ArticleTranslation.findOne({ where: { language, slug: candidate } })) {
    const existing = await ArticleTranslation.findOne({ where: { article_id: articleId, language, slug: candidate } });
    if (existing) return candidate;
    candidate = (root + '-' + n++).slice(0, 191);
  }
  return candidate;
}

async function saveTranslations(article, translations) {
  for (const [language, tr] of Object.entries(translations)) {
    const existing = await ArticleTranslation.findOne({ where: { article_id: article.id, language } });
    const requestedSlug = unicodeSlug(tr.slug || tr.title || 'article-' + article.id + '-' + language, 'article-' + article.id + '-' + language);
    let slug = requestedSlug;
    if (!existing || existing.slug !== requestedSlug) slug = await uniqueTranslationSlug(article.id, language, requestedSlug);
    const payload = {
      article_id: article.id,
      language,
      title: tr.title,
      slug,
      excerpt: tr.excerpt || null,
      content_md: tr.content_md || null,
      seo_title: tr.seo_title || null,
      seo_description: tr.seo_description || null,
      tags: tr.tags || [],
      reading_time: computeReadingTime(tr.content_md || ''),
    };
    if (existing) await existing.update(payload);
    else await ArticleTranslation.create(payload);
  }
}

async function loadArticle(id) {
  return Article.findByPk(id, { include: [{ model: ArticleTranslation, as: 'translations' }] });
}

function primaryTranslation(translations) {
  return translations[DEFAULT_LANGUAGE] || translations.fr || translations.ar || translations.en || Object.values(translations)[0] || null;
}

function sendAiError(res, error) {
  const status = error.status || 500;
  const retryable = !!error.retryable;
  const code = error.code || 'AI_PROVIDER_ERROR';
  const publicMessages = {
    AI_NOT_CONFIGURED: "La génération IA n'est pas configurée sur le serveur.",
    AI_MODEL_NOT_CONFIGURED: "Le modèle IA n'est pas configuré.",
    AI_AUTH_ERROR: 'La configuration IA est invalide ou non autorisée.',
    AI_BILLING_ERROR: 'Le service IA est indisponible pour des raisons de quota ou de facturation.',
    AI_RATE_LIMIT: 'Le service IA est temporairement limité. Réessayez dans quelques instants.',
    AI_TIMEOUT: 'La génération a dépassé le délai autorisé.',
    AI_EMPTY_RESPONSE: 'Le service IA a renvoyé une réponse vide.',
    AI_INVALID_JSON: 'Le service IA a renvoyé une réponse invalide.',
    AI_VALIDATION_ERROR: error.message || 'Le résultat IA ne respecte pas le format attendu.',
    AI_TRANSLATION_VALIDATION_ERROR: error.message || 'La traduction IA ne respecte pas le format attendu.',
    INVALID_CATEGORY: error.message,
    INVALID_RUBRIQUE: error.message,
    AI_INPUT_TOO_LONG: error.message,
    AI_INVALID_INPUT: error.message,
    AI_TRANSLATION_ERROR: error.message,
    ARTICLE_NOT_FOUND: 'Article introuvable.',
  };
  console.warn('[discover.ai]', { code, status, retryable });
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    code,
    message: publicMessages[code] || 'Le service de génération est temporairement indisponible.',
    error: publicMessages[code] || 'Le service de génération est temporairement indisponible.',
    retryable,
  });
}

router.get('/articles', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validate, ah(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;
  const { count, rows } = await Article.findAndCountAll({
    attributes: {
      include: [[literal(`(
        SELECT COUNT(DISTINCT te.visitor_hash)
        FROM traffic_events te
        WHERE te.module = 'discover'
          AND te.entity_type = 'article'
          AND te.entity_id = CAST(article.id AS CHAR)
      )`), 'unique_readers_count']],
    },
    include: [{ model: ArticleTranslation, as: 'translations' }],
    order: [['createdAt', 'DESC']],
    distinct: true,
    limit,
    offset,
  });
  res.json({ articles: rows, total: count, page, pages: Math.ceil(count / limit), limit });
}));

router.get('/articles/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const article = await loadArticle(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article introuvable' });
  res.json({ article });
}));

router.post('/articles',
  [body('category').notEmpty()],
  validate,
  ah(async (req, res) => {
    const translations = extractTranslations(req.body);
    const primary = primaryTranslation(translations);
    if (!primary) return res.status(400).json({ error: 'Ajoutez au moins une traduction arabe, française ou anglaise.' });
    const slug = await generateUniqueSlug(Article, primary.title || 'article');
    const article = await Article.create({
      ...extractFields(req.body),
      title: primary.title,
      excerpt: primary.excerpt || null,
      body: primary.content_md || null,
      tags: primary.tags || [],
      seo_title: primary.seo_title || null,
      seo_description: primary.seo_description || null,
      slug,
      author_id: req.user.id,
    });
    await saveTranslations(article, translations);
    const saved = await loadArticle(article.id);
    res.status(201).json({ ok: true, article: saved });
  })
);

router.put('/articles/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  ah(async (req, res) => {
    const article = await Article.findByPk(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article introuvable' });
    const translations = extractTranslations(req.body);
    const primary = primaryTranslation(translations);
    const fields = extractFields(req.body);
    if (primary) {
      fields.title = primary.title;
      fields.excerpt = primary.excerpt || null;
      fields.body = primary.content_md || null;
      fields.tags = primary.tags || [];
      fields.seo_title = primary.seo_title || null;
      fields.seo_description = primary.seo_description || null;
    }
    Object.assign(article, fields);
    await article.save();
    await saveTranslations(article, translations);
    const saved = await loadArticle(article.id);
    res.json({ ok: true, article: saved });
  })
);

router.delete('/articles/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await Article.destroy({ where: { id: req.params.id } });
  if (!n) return res.status(404).json({ error: 'Article introuvable' });
  res.json({ ok: true });
}));

router.patch('/articles/:id/publish', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const article = await Article.findByPk(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article introuvable' });
  const next = article.status === 'published' ? 'draft' : 'published';
  article.status = next;
  article.published_at = next === 'published' ? (article.published_at || new Date()) : article.published_at;
  await article.save();
  res.json({ ok: true, article });
}));

router.post('/preview', [body('body').isString()], validate, ah(async (req, res) => {
  res.json({ html: parseMarkdown(req.body.body || '', { title: req.body.title || '' }).html });
}));

// ── Moteur IA de brouillons ─────────────────────────────────────────────────
router.get('/ai/status', ah(async (req, res) => {
  res.json({ success: true, ...aiDraftService.getAiPublicStatus() });
}));

router.post('/ai/test-connection', ah(async (req, res) => {
  try {
    const status = await aiDraftService.testConnection();
    res.json({ success: true, ...status });
  } catch (e) {
    return sendAiError(res, e);
  }
}));

// Génère un brouillon ancré dans des commerces/produits/promotions réels
// (voir aiDraftService.js) ; ne publie jamais automatiquement — le brouillon
// atterrit dans la liste avec status='draft', à valider/éditer normalement.

router.post('/ai/generate-draft',
  [
    body('topic').trim().notEmpty().isLength({ max: 300 }),
    body('category').notEmpty(),
    body('rubrique').optional({ nullable: true }).isString(),
    body('city_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('vertical').optional({ nullable: true }).isIn(['restaurant', 'hanout', 'pharmacie']),
    body('long_form').optional().isBoolean(),
    body('title').optional({ nullable: true }).trim().isLength({ max: 191 }),
    body('language').optional().trim().isLength({ max: 16 }),
    body('tone').optional().trim().isLength({ max: 120 }),
    body('word_count').optional({ nullable: true }).isInt({ min: 250, max: 2500 }),
    body('keywords').optional().isArray({ max: 16 }),
    body('factual_info').optional({ nullable: true }).isString().isLength({ max: 3000 }),
    body('editorial_instructions').optional({ nullable: true }).isString().isLength({ max: 1200 }),
  ],
  validate,
  ah(async (req, res) => {
    try {
      const article = await aiDraftService.generateDraft({
        topic: req.body.topic,
        title: req.body.title || null,
        language: req.body.language || DEFAULT_LANGUAGE,
        category: req.body.category,
        rubrique: req.body.rubrique || null,
        cityId: req.body.city_id || null,
        vertical: req.body.vertical || null,
        tone: req.body.tone || undefined,
        wordCount: req.body.word_count || null,
        keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
        factualInfo: req.body.factual_info || '',
        editorialInstructions: req.body.editorial_instructions || '',
        authorId: req.user.id,
        longForm: !!req.body.long_form,
      });
      res.status(201).json({ ok: true, success: true, article, ai_metadata: article.getDataValue('ai_metadata') || null });
    } catch (e) {
      return sendAiError(res, e);
    }
  })
);


router.post('/ai/generate-draft-with-images',
  [
    body('topic').trim().notEmpty().isLength({ max: 300 }),
    body('category').notEmpty(),
    body('rubrique').optional({ nullable: true }).isString(),
    body('city_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('vertical').optional({ nullable: true }).isIn(['restaurant', 'hanout', 'pharmacie']),
    body('long_form').optional().isBoolean(),
    body('title').optional({ nullable: true }).trim().isLength({ max: 191 }),
    body('language').optional().trim().isLength({ max: 16 }),
    body('tone').optional().trim().isLength({ max: 120 }),
    body('word_count').optional({ nullable: true }).isInt({ min: 250, max: 2500 }),
    body('keywords').optional().isArray({ max: 16 }),
    body('factual_info').optional({ nullable: true }).isString().isLength({ max: 3000 }),
    body('editorial_instructions').optional({ nullable: true }).isString().isLength({ max: 1200 }),
    body('include_sections').optional().isBoolean(),
    body('section_count').optional({ nullable: true }).isInt({ min: 0, max: 4 }),
  ],
  validate,
  ah(async (req, res) => {
    try {
      const article = await aiDraftService.generateDraft({
        topic: req.body.topic,
        title: req.body.title || null,
        language: req.body.language || DEFAULT_LANGUAGE,
        category: req.body.category,
        rubrique: req.body.rubrique || null,
        cityId: req.body.city_id || null,
        vertical: req.body.vertical || null,
        tone: req.body.tone || undefined,
        wordCount: req.body.word_count || null,
        keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
        factualInfo: req.body.factual_info || '',
        editorialInstructions: req.body.editorial_instructions || '',
        authorId: req.user.id,
        longForm: !!req.body.long_form,
      });
      const result = await aiImageService.generateMagazineImages({
        articleId: article.id,
        includeSections: req.body.include_sections !== false,
        sectionCount: req.body.section_count ?? 2,
        forcePrompt: true,
      });
      res.status(201).json({ ok: true, success: true, article: result.article, image_assets: result.image_assets, image_prompt: result.image_prompt });
    } catch (e) {
      return sendAiError(res, e);
    }
  })
);

router.post('/articles/:id/ai/generate-images',
  [
    param('id').isInt({ min: 1 }),
    body('include_sections').optional().isBoolean(),
    body('section_count').optional({ nullable: true }).isInt({ min: 0, max: 4 }),
    body('force_prompt').optional().isBoolean(),
    body('only').optional({ nullable: true }).custom(v => typeof v === 'string' || Array.isArray(v)),
  ],
  validate,
  ah(async (req, res) => {
    try {
      const result = await aiImageService.generateMagazineImages({
        articleId: req.params.id,
        includeSections: req.body.include_sections !== false,
        sectionCount: req.body.section_count ?? 2,
        forcePrompt: !!req.body.force_prompt,
        only: req.body.only || null,
      });
      res.json({ ok: true, success: true, article: result.article, image_assets: result.image_assets, image_prompt: result.image_prompt, generated: result.generated });
    } catch (e) {
      return sendAiError(res, e);
    }
  })
);

router.post('/articles/:id/ai/translate',
  [
    param('id').isInt({ min: 1 }),
    body('source_language').trim().isLength({ min: 2, max: 16 }),
    body('target_language').trim().isLength({ min: 2, max: 16 }),
    body('title').trim().notEmpty().isLength({ max: 191 }),
    body('excerpt').optional({ nullable: true }).isString().isLength({ max: 500 }),
    body('content_md').isString(),
    body('seo_title').optional({ nullable: true }).isString().isLength({ max: 191 }),
    body('seo_description').optional({ nullable: true }).isString().isLength({ max: 500 }),
    body('tags').optional().isArray({ max: 16 }),
  ],
  validate,
  ah(async (req, res) => {
    try {
      const article = await Article.findByPk(req.params.id);
      if (!article) return res.status(404).json({ error: 'Article introuvable' });
      const translation = await translationService.translateArticle({
        sourceLanguage: req.body.source_language,
        targetLanguage: req.body.target_language,
        title: req.body.title,
        excerpt: req.body.excerpt || '',
        contentMd: req.body.content_md,
        seoTitle: req.body.seo_title || '',
        seoDescription: req.body.seo_description || '',
        tags: Array.isArray(req.body.tags) ? req.body.tags : [],
        imageAltText: article.image_alt_text || '',
        imageAssets: article.image_assets || null,
        faq: Array.isArray(article.faq) ? article.faq : [],
        recipeMeta: article.recipe_meta || null,
        sources: Array.isArray(article.sources) ? article.sources : [],
      });

      const articleSlug = await generateUniqueSlug(Article, translation.title || article.title || 'article');
      const translatedArticle = await Article.create({
        title: translation.title,
        slug: articleSlug,
        excerpt: translation.excerpt || null,
        cover_image_url: article.cover_image_url || null,
        image_prompt: article.image_prompt || null,
        image_alt_text: translation.image_alt_text || article.image_alt_text || null,
        image_assets: translation.image_assets || article.image_assets || null,
        category: article.category,
        rubrique: article.rubrique,
        body: translation.content_md || null,
        gallery: article.gallery || [],
        tags: translation.tags || [],
        related_product_refs: article.related_product_refs || [],
        related_business_refs: article.related_business_refs || [],
        city_id: article.city_id || null,
        recipe_meta: article.category === 'recette' ? (translation.recipe_meta || article.recipe_meta || null) : null,
        status: 'draft',
        author_id: req.user.id,
        published_at: null,
        seo_title: translation.seo_title || null,
        seo_description: translation.seo_description || null,
        generated_by_ai: article.generated_by_ai,
        faq: translation.faq || [],
        sources: translation.sources || [],
        view_count: 0,
      });
      await saveTranslations(translatedArticle, { [translation.language]: translation });
      const saved = await loadArticle(translatedArticle.id);
      res.status(201).json({ ok: true, success: true, translation, article: saved, source_article_id: article.id });
    } catch (e) {
      return sendAiError(res, e);
    }
  })
);

router.delete('/articles/:id/images/:key',
  [param('id').isInt({ min: 1 }), param('key').isString().isLength({ min: 2, max: 40 })],
  validate,
  ah(async (req, res) => {
    try {
      const result = await aiImageService.removeImageAsset({ articleId: req.params.id, key: req.params.key });
      res.json({ ok: true, article: result.article, image_assets: result.image_assets });
    } catch (e) {
      return sendAiError(res, e);
    }
  })
);

// ── Upload ───────────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../../../uploads', 'discover');
function ensureUploadDir() { fs.mkdirSync(uploadDir, { recursive: true }); }
ensureUploadDir();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Type de fichier non supporté'), ok);
  },
});

router.post('/articles/upload',
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]),
  ah(async (req, res) => {
    ensureUploadDir();
    const files = req.files || {};
    const out = {};
    const jobs = [];

    if (files.cover?.[0]) {
      jobs.push(toCoverWebp(files.cover[0].buffer).then(buf => {
        const filename = `cover_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.cover_image_url = `/uploads/discover/${filename}`;
      }));
    }
    if (files.gallery?.length) {
      out.gallery = [];
      files.gallery.forEach((file, i) => {
        jobs.push(toGalleryWebp(file.buffer).then(buf => {
          const filename = `gallery_${Date.now()}_${i}.webp`;
          fs.writeFileSync(path.join(uploadDir, filename), buf);
          out.gallery[i] = `/uploads/discover/${filename}`;
        }));
      });
    }

    if (!jobs.length) return res.status(400).json({ error: 'Aucun fichier reçu (champs attendus : cover, gallery)' });
    await Promise.all(jobs);
    res.json({ ok: true, ...out });
  })
);

// Statistiques de lecture — vues cumulées (compteur `articles.view_count`,
// incrémenté à chaque chargement public, voir articleService.js), pas de
// table d'événements détaillée : agrégats simples par article/catégorie/rubrique.
router.get('/stats', ah(async (req, res) => {
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const totals = await Article.findOne({
    where: { status: 'published' },
    attributes: [
      [fn('COUNT', col('id')), 'published_count'],
      [fn('COALESCE', fn('SUM', col('view_count')), 0), 'total_views'],
      [fn('COALESCE', fn('AVG', col('view_count')), 0), 'avg_views'],
    ],
    raw: true,
  });
  const draftCount = await Article.count({ where: { status: 'draft' } });
  const aiCount = await Article.count({ where: { generated_by_ai: true } });
  const publishedThisMonth = await Article.count({ where: { status: 'published', published_at: { [Op.gte]: startOfMonth } } });

  const topArticles = await Article.findAll({
    where: { status: 'published' },
    attributes: ['id', 'slug', 'title', 'category', 'rubrique', 'view_count', 'published_at'],
    order: [['view_count', 'DESC']],
    limit: 10,
    raw: true,
  });
  const byCategory = await Article.findAll({
    where: { status: 'published' },
    attributes: ['category', [fn('COUNT', col('id')), 'count'], [fn('COALESCE', fn('SUM', col('view_count')), 0), 'views']],
    group: ['category'],
    order: [[literal('views'), 'DESC']],
    raw: true,
  });
  const byRubrique = await Article.findAll({
    where: { status: 'published' },
    attributes: ['rubrique', [fn('COUNT', col('id')), 'count'], [fn('COALESCE', fn('SUM', col('view_count')), 0), 'views']],
    group: ['rubrique'],
    order: [[literal('views'), 'DESC']],
    limit: 10,
    raw: true,
  });
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0, 0, 0, 0);
  const publishedByMonth = await Article.findAll({
    where: { status: 'published', published_at: { [Op.gte]: sixMonthsAgo } },
    attributes: [[fn('DATE_FORMAT', col('published_at'), '%Y-%m'), 'month'], [fn('COUNT', col('id')), 'count']],
    group: [literal('month')],
    order: [[literal('month'), 'ASC']],
    raw: true,
  });

  // Trafic réel (visites dédupliquées par visiteur+jour, voir backend/utils/traffic.js) —
  // à distinguer de `view_count` ci-dessus qui compte chaque chargement de page brut.
  const realTrafficRows = await rawQuery(`
    SELECT
      COUNT(DISTINCT CASE WHEN view_date = CURDATE() THEN visitor_hash END) AS visitors_today,
      COUNT(DISTINCT CASE WHEN view_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN visitor_hash END) AS visitors_7d,
      COUNT(DISTINCT CASE WHEN view_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) THEN visitor_hash END) AS visitors_30d
    FROM traffic_events
    WHERE module = 'discover'
  `);
  const realTraffic = realTrafficRows[0];
  const dailyVisitors = await rawQuery(`
    SELECT view_date AS day, COUNT(DISTINCT visitor_hash) AS visitors
    FROM traffic_events
    WHERE module = 'discover' AND view_date >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
    GROUP BY view_date
    ORDER BY day ASC
  `);
  const topReferrers = await rawQuery(`
    SELECT referrer_domain, COUNT(DISTINCT visitor_hash) AS visitors
    FROM traffic_events
    WHERE module = 'discover' AND view_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
    GROUP BY referrer_domain
    ORDER BY visitors DESC
    LIMIT 8
  `);
  const realDeviceSplit = await rawQuery(`
    SELECT device_type, COUNT(DISTINCT visitor_hash) AS visitors
    FROM traffic_events
    WHERE module = 'discover' AND view_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
    GROUP BY device_type
  `);

  res.json({
    stats: {
      publishedCount: Number(totals?.published_count || 0),
      totalViews: Number(totals?.total_views || 0),
      avgViews: Math.round(Number(totals?.avg_views || 0)),
      draftCount,
      aiGeneratedCount: aiCount,
      publishedThisMonth,
      topArticles,
      byCategory,
      byRubrique,
      publishedByMonth,
      realTraffic,
      dailyVisitors,
      topReferrers,
      realDeviceSplit,
    },
  });
}));

module.exports = router;
