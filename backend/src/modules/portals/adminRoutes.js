'use strict';

const express = require('express');
const { param, query, body } = require('express-validator');
const validate = require('../../../middleware/validate');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const { PortalContent, PortalContentTranslation } = require('../../../models');
const { getPortal } = require('./config');
const portalContentService = require('./portalContentService');
const { SUPPORTED_LANGUAGES } = require('./i18n');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PARENT_FIELDS = ['portal', 'content_type', 'slug', 'image_url', 'category', 'metadata', 'status', 'featured', 'isPremium', 'previewLength', 'premiumBadge', 'sort_order', 'published_at'];
const pick = (source, fields) => Object.fromEntries(fields.filter(key => source[key] !== undefined).map(key => [key, source[key]]));

// L'éditeur superadmin (frontend/src/pages/superadmin/PortalArticleEditorPage.jsx) soumet/attend
// toujours des champs plats `title_fr/title_en/title_ar`, `excerpt_fr/en/ar`, `body_fr/en/ar` +
// un seul `seo_title`/`seo_description` partagé entre langues (onglets de langue dans le même
// formulaire) — contrat conservé tel quel ici, traduit en interne vers/depuis
// portal_content_translations pour ne pas casser cette UI existante déjà fonctionnelle.
function flattenTranslations(item) {
  const translations = item.translations || [];
  const flat = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    const tr = translations.find(t => t.language === lang);
    flat[`title_${lang}`] = tr?.title || '';
    flat[`slug_${lang}`] = tr?.slug || '';
    flat[`excerpt_${lang}`] = tr?.excerpt || '';
    flat[`body_${lang}`] = tr?.body || '';
    flat[`metadata_${lang}`] = tr?.metadata || null;
    flat[`seo_title_${lang}`] = tr?.seo_title || '';
    flat[`seo_description_${lang}`] = tr?.seo_description || '';
    flat[`seo_keywords_${lang}`] = tr?.seo_keywords || [];
  }
  const primary = translations.find(t => t.language === 'en') || translations[0];
  flat.seo_title = primary?.seo_title || '';
  flat.seo_description = primary?.seo_description || '';
  flat.translation_group_id = item.id;
  return flat;
}

function parseLocalizedMetadata(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseSeoKeywords(value) {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

async function upsertTranslationsFromFlatBody(contentId, portal, parentSlug, body) {
  for (const lang of SUPPORTED_LANGUAGES) {
    const title = body[`title_${lang}`];
    if (!title || !String(title).trim()) continue;
    const localizedSlug = String(body[`slug_${lang}`] || '').trim()
      || (lang === 'en' ? parentSlug : `${parentSlug}-${lang}`);
    const localizedMetadata = parseLocalizedMetadata(body[`metadata_${lang}`]);
    const seoKeywords = parseSeoKeywords(body[`seo_keywords_${lang}`]);
    const values = {
      slug: localizedSlug,
      title: String(title).trim(),
      excerpt: body[`excerpt_${lang}`] || null,
      body: body[`body_${lang}`] || null,
      metadata: localizedMetadata,
      seo_title: body[`seo_title_${lang}`] || body.seo_title || null,
      seo_description: body[`seo_description_${lang}`] || body.seo_description || null,
      seo_keywords: seoKeywords,
      status: body.status || 'published',
    };
    const [translation] = await PortalContentTranslation.findOrCreate({
      where: { portal_content_id: contentId, language: lang },
      defaults: { portal_content_id: contentId, portal, language: lang, ...values },
    });
    await translation.update({ ...values, status: body.status || translation.status });
  }
}

router.use(requireAuth, requireSuperAdmin);

router.get('/:portal/analytics', [param('portal').isIn(['sports', 'kids'])], validate, ah(async (req, res) => {
  const rows = await PortalContent.findAll({ where: { portal: req.params.portal }, raw: true });
  const byType = {};
  for (const row of rows) {
    if (!byType[row.content_type]) byType[row.content_type] = { type: row.content_type, total: 0, published: 0, views: 0 };
    byType[row.content_type].total += 1;
    byType[row.content_type].published += row.status === 'published' ? 1 : 0;
    byType[row.content_type].views += Number(row.view_count || 0);
  }
  res.json({
    summary: {
      contents: rows.length,
      published: rows.filter(row => row.status === 'published').length,
      drafts: rows.filter(row => row.status === 'draft').length,
      views: rows.reduce((sum, row) => sum + Number(row.view_count || 0), 0),
    },
    byType: Object.values(byType).sort((a, b) => b.views - a.views),
  });
}));

router.get('/:portal/contents', [
  param('portal').isIn(['sports', 'kids']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, ah(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 30);
  const { rows, count } = await PortalContent.findAndCountAll({
    where: { portal: req.params.portal },
    include: [portalContentService.allTranslationsInclude({ publishedOnly: false })],
    order: [['updated_at', 'DESC']],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  res.json({
    items: rows.map(row => ({
      ...row.toJSON(),
      ...flattenTranslations(row),
      translation_languages: (row.translations || []).map(t => t.language),
    })).filter(row => !req.query.lang || row.translation_languages.includes(req.query.lang)),
    total: count,
    page,
    pages: Math.ceil(count / limit),
  });
}));

router.get('/:portal/contents/:id', [
  param('portal').isIn(['sports', 'kids']),
  param('id').isInt({ min: 1 }),
], validate, ah(async (req, res) => {
  const item = await PortalContent.findOne({ where: { id: req.params.id, portal: req.params.portal }, include: [portalContentService.allTranslationsInclude({ publishedOnly: false })] });
  if (!item) return res.status(404).json({ error: 'Contenu introuvable' });
  res.json({ item: { ...item.toJSON(), ...flattenTranslations(item) } });
}));

router.post('/:portal/contents', [
  param('portal').isIn(['sports', 'kids']),
  body('content_type').isString().trim().isLength({ min: 1, max: 64 }),
  body('slug').isString().trim().isLength({ min: 1, max: 191 }),
  body('title_en').isString().trim().isLength({ min: 1, max: 191 }),
], validate, ah(async (req, res) => {
  if (!getPortal(req.params.portal).contentTypes.includes(req.body.content_type)) {
    return res.status(422).json({ error: 'Type de contenu invalide pour ce portail' });
  }
  const item = await PortalContent.create({ ...pick(req.body, PARENT_FIELDS), portal: req.params.portal });
  await upsertTranslationsFromFlatBody(item.id, req.params.portal, item.slug, req.body);
  const created = await PortalContent.findOne({ where: { id: item.id }, include: [portalContentService.allTranslationsInclude({ publishedOnly: false })] });
  res.status(201).json({ item: { ...created.toJSON(), ...flattenTranslations(created) } });
}));

router.put('/:portal/contents/:id', [
  param('portal').isIn(['sports', 'kids']),
  param('id').isInt({ min: 1 }),
], validate, ah(async (req, res) => {
  const item = await PortalContent.findOne({ where: { id: req.params.id, portal: req.params.portal } });
  if (!item) return res.status(404).json({ error: 'Contenu introuvable' });
  await item.update({ ...pick(req.body, PARENT_FIELDS), portal: req.params.portal });
  await upsertTranslationsFromFlatBody(item.id, req.params.portal, item.slug, req.body);
  const updated = await PortalContent.findOne({ where: { id: item.id }, include: [portalContentService.allTranslationsInclude({ publishedOnly: false })] });
  res.json({ item: { ...updated.toJSON(), ...flattenTranslations(updated) } });
}));

router.delete('/:portal/contents/:id', [
  param('portal').isIn(['sports', 'kids']),
  param('id').isInt({ min: 1 }),
], validate, ah(async (req, res) => {
  const item = await PortalContent.findOne({ where: { id: req.params.id, portal: req.params.portal } });
  if (!item) return res.status(404).json({ error: 'Contenu introuvable' });
  await item.destroy();
  res.json({ ok: true });
}));

module.exports = router;
