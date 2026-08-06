'use strict';

/**
 * Produits numériques — routes SuperAdmin. Montées sous /api/superadmin/digital-products.
 * Même style que backend/src/modules/portals/adminRoutes.js (whitelist `pick()`, pas de spread
 * brut de req.body).
 *
 * GET    /types                — liste curée des types de produits (formulaire admin)
 * GET    /?portalContentId=X   — liste des produits d'une Story
 * POST   /                     — créer
 * GET    /:id                  — détail
 * PUT    /:id                  — mettre à jour
 * DELETE /:id                  — supprimer
 * POST   /:id/regenerate       — force une nouvelle version (admin uniquement)
 */
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const validate = require('../../../middleware/validate');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const { DigitalProduct, GeneratedFile, PortalContent, StudyLesson } = require('../../../models');
const { DIGITAL_PRODUCT_TYPES, DIGITAL_PRODUCT_TYPE_VALUES } = require('./config');
const { ensureGeneratedFile } = require('./generationService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

const FIELDS = [
  "portal_content_id", "study_lesson_id", "type", 'title', 'description', 'cover_image_url',
  'price', 'currency', 'content_markdown', 'status', 'position',
];
function pick(source) {
  const out = {};
  for (const f of FIELDS) if (source[f] !== undefined) out[f] = source[f];
  return out;
}

router.get('/types', (req, res) => res.json({ types: DIGITAL_PRODUCT_TYPES }));

router.get('/', [query("portalContentId").optional().isInt({ min: 1 }), query("studyLessonId").optional().isInt({ min: 1 })], validate, ah(async (req, res) => {
  const where = {};
  if (req.query.portalContentId) where.portal_content_id = req.query.portalContentId;
  if (req.query.studyLessonId) where.study_lesson_id = req.query.studyLessonId;
  const products = await DigitalProduct.findAll({ where, order: [['position', 'ASC'], ['id', 'ASC']] });
  res.json({ products });
}));

router.get('/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const product = await DigitalProduct.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  res.json({ product });
}));

router.post('/',
  [
    body("portal_content_id").optional().isInt({ min: 1 }),
    body("study_lesson_id").optional().isInt({ min: 1 }),
    body('type').isIn(DIGITAL_PRODUCT_TYPE_VALUES),
    body('title').trim().notEmpty().isLength({ max: 191 }),
  ],
  validate,
  ah(async (req, res) => {
    const targetWhere = req.body.study_lesson_id ? { study_lesson_id: req.body.study_lesson_id } : { portal_content_id: req.body.portal_content_id };
    if (!req.body.study_lesson_id && !req.body.portal_content_id) return res.status(422).json({ error: "Contenu requis" });
    const target = req.body.study_lesson_id ? await StudyLesson.findByPk(req.body.study_lesson_id) : await PortalContent.findByPk(req.body.portal_content_id);
    if (!target) return res.status(422).json({ error: "Contenu introuvable" });
    const maxPos = await DigitalProduct.max("position", { where: targetWhere }) || 0;
    const product = await DigitalProduct.create({
      ...pick(req.body), position: maxPos + 1, created_by: req.user.id,
    });
    res.status(201).json({ ok: true, product });
  })
);

router.put('/:id',
  [
    param('id').isInt({ min: 1 }),
    body('type').optional().isIn(DIGITAL_PRODUCT_TYPE_VALUES),
    body('title').optional().trim().isLength({ min: 1, max: 191 }),
  ],
  validate,
  ah(async (req, res) => {
    const product = await DigitalProduct.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });
    await product.update({ ...pick(req.body), updated_by: req.user.id });
    res.json({ ok: true, product });
  })
);

router.delete('/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await DigitalProduct.destroy({ where: { id: req.params.id } });
  if (!n) return res.status(404).json({ error: 'Produit introuvable' });
  res.json({ ok: true });
}));

// Force une nouvelle génération (ex. après correction du contenu) — marque le fichier courant
// obsolète et en relance un nouveau, même mécanique que la vérification de péremption automatique.
router.post('/:id/regenerate', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const product = await DigitalProduct.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  const story = product.study_lesson_id ? await StudyLesson.findByPk(product.study_lesson_id) : await PortalContent.findByPk(product.portal_content_id);
  if (!story) return res.status(422).json({ error: "Contenu introuvable" });

  await GeneratedFile.update(
    { status: 'obsolete' },
    { where: { digital_product_id: product.id, status: 'ready' } }
  );
  const file = await ensureGeneratedFile(product, story);
  res.json({ ok: true, generatedFile: file });
}));

module.exports = router;
