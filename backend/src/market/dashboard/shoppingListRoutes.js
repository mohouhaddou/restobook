'use strict';

/**
 * Listes de courses — assistant intelligent. Monté sous /api/dashboard/lists
 * par dashboard/routes.js (qui applique déjà requireCustomerAccount en amont
 * sur tout le router parent — pas besoin de le refaire ici).
 *
 * Routes :
 *   GET    /                       — mes listes
 *   POST   /                       — créer une liste
 *   PATCH  /:id                    — renommer/changer icône
 *   DELETE /:id                    — supprimer une liste
 *   GET    /presets                — métadonnées des présets curés
 *   POST   /generate               — générer une liste depuis un préset
 *   POST   /:id/items              — ajouter un article (catégorisation auto)
 *   POST   /:id/items/bulk         — ajouter plusieurs articles (vocal/scan multiple)
 *   PATCH  /:id/items/reorder      — réordonner (drag & drop)
 *   PATCH  /:id/items/:itemId      — cocher/modifier un article
 *   DELETE /:id/items/:itemId      — retirer un article
 *   POST   /:id/best-store         — recommander le meilleur commerce unique
 *   POST   /:id/usual-purchases/add — ajouter des achats habituels en bulk
 *   GET    /:id/checkout-plan      — grouper les articles par commerce (slug résolu) pour "Commander"
 */

const express = require('express');
const router  = express.Router();
const { body, param } = require('express-validator');
const { Op } = require('sequelize');
const validate = require('../../../middleware/validate');
const { ShoppingList, ShoppingListItem, HanoutProduct, Organization } = require('../../../models');
const { PRESET_META } = require('./shoppingListPresets');
const svc = require('./shoppingListService');

async function findOwnedList(id, userId) {
  return ShoppingList.findOne({ where: { id, user_id: userId } });
}

router.get('/', async (req, res, next) => {
  try {
    const lists = await ShoppingList.findAll({
      where: { user_id: req.user.id },
      include: [{ model: ShoppingListItem, as: 'items' }],
      order: [['created_at', 'DESC']],
    });
    res.json({ lists });
  } catch (e) { next(e); }
});

router.get('/presets', async (req, res, next) => {
  try {
    res.json({ presets: PRESET_META });
  } catch (e) { next(e); }
});

router.post('/generate',
  [
    body('preset_key').trim().notEmpty(),
    body('name').optional().trim().isLength({ max: 120 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const list = await svc.materializePreset(req.user.id, req.body.preset_key, { name: req.body.name });
      res.status(201).json({ ok: true, list });
    } catch (e) { next(e); }
  }
);

router.post('/',
  [
    body('name').trim().notEmpty().isLength({ max: 120 }),
    body('icon').optional().trim().isLength({ max: 10 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, icon } = req.body;
      const list = await ShoppingList.create({ user_id: req.user.id, name, icon: icon || '🛒' });
      res.status(201).json({ ok: true, list: { ...list.toJSON(), items: [] } });
    } catch (e) { next(e); }
  }
);

router.patch('/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().isLength({ min: 1, max: 120 }),
    body('icon').optional().trim().isLength({ max: 10 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      if (req.body.name !== undefined) list.name = req.body.name;
      if (req.body.icon !== undefined) list.icon = req.body.icon;
      await list.save();
      res.json({ ok: true, list });
    } catch (e) { next(e); }
  }
);

router.delete('/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const n = await ShoppingList.destroy({ where: { id: req.params.id, user_id: req.user.id } });
      if (!n) return res.status(404).json({ error: 'Liste introuvable' });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

const ITEM_FIELDS_BODY = [
  body('name').trim().notEmpty().isLength({ max: 191 }),
  body('quantity').optional().trim().isLength({ max: 50 }),
  body('quantity_value').optional().isFloat({ min: 0 }),
  body('quantity_unit').optional().trim().isLength({ max: 16 }),
  body('notes').optional().trim().isLength({ max: 255 }),
  body('priority').optional().isIn(['low', 'normal', 'high']),
  body('is_favorite').optional().isBoolean(),
  body('brand').optional().trim().isLength({ max: 80 }),
  body('quality_note').optional().trim().isLength({ max: 80 }),
  body('preferred_organization_id').optional().isInt({ min: 1 }),
  body('source_module').optional().isIn(['hanout', 'pharmacie', 'resto']),
  body('source_product_id').optional().isInt({ min: 1 }),
  body('image_url').optional().trim().isLength({ max: 255 }),
  body('barcode').optional().trim().isLength({ max: 32 }),
  body('estimated_price').optional().isFloat({ min: 0 }),
];

function extractItemFields(src) {
  const fields = ['quantity', 'quantity_value', 'quantity_unit', 'notes', 'priority', 'is_favorite',
    'brand', 'quality_note', 'preferred_organization_id', 'source_module', 'source_product_id',
    'image_url', 'barcode', 'estimated_price'];
  const out = {};
  for (const f of fields) if (src[f] !== undefined) out[f] = src[f];
  return out;
}

router.post('/:id/items',
  [param('id').isInt({ min: 1 }), ...ITEM_FIELDS_BODY],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      // La catégorie est TOUJOURS calculée serveur à la création — jamais fournie par le client.
      const item = await ShoppingListItem.create({
        list_id: list.id, name: req.body.name,
        category: svc.categorizeItem(req.body.name),
        ...extractItemFields(req.body),
      });
      res.status(201).json({ ok: true, item });
    } catch (e) { next(e); }
  }
);

router.post('/:id/items/bulk',
  [
    param('id').isInt({ min: 1 }),
    body('items').isArray({ min: 1, max: 50 }),
    body('items.*.name').trim().notEmpty().isLength({ max: 191 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      const created = await Promise.all(req.body.items.map(it => ShoppingListItem.create({
        list_id: list.id, name: it.name,
        category: svc.categorizeItem(it.name),
        ...extractItemFields(it),
      })));
      res.status(201).json({ ok: true, items: created });
    } catch (e) { next(e); }
  }
);

router.patch('/:id/items/reorder',
  [
    param('id').isInt({ min: 1 }),
    body('order').isArray({ min: 1 }),
    body('order.*').isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      await Promise.all(req.body.order.map((itemId, idx) =>
        ShoppingListItem.update({ sort_order: idx }, { where: { id: itemId, list_id: list.id } })
      ));
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

router.patch('/:id/items/:itemId',
  [
    param('id').isInt({ min: 1 }), param('itemId').isInt({ min: 1 }),
    body('checked').optional().isBoolean(),
    body('name').optional().trim().isLength({ min: 1, max: 191 }),
    body('category').optional().trim().isLength({ max: 32 }),
    ...ITEM_FIELDS_BODY.map(v => v.optional()),
  ],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      const item = await ShoppingListItem.findOne({ where: { id: req.params.itemId, list_id: list.id } });
      if (!item) return res.status(404).json({ error: 'Article introuvable' });

      if (req.body.checked !== undefined) item.checked = req.body.checked;
      if (req.body.name !== undefined) item.name = req.body.name;
      // Un override manuel de catégorie pose category_user_set pour ne plus
      // jamais être écrasé par une future re-catégorisation automatique.
      if (req.body.category !== undefined) { item.category = req.body.category; item.category_user_set = true; }
      Object.assign(item, extractItemFields(req.body));
      await item.save();

      let gamification = { justCompleted: false, newBadges: [] };
      if (req.body.checked !== undefined) {
        gamification = await svc.maybeCompleteList(list);
      }

      res.json({ ok: true, item, list_completed: gamification.justCompleted, new_badges: gamification.newBadges });
    } catch (e) { next(e); }
  }
);

router.delete('/:id/items/:itemId',
  [param('id').isInt({ min: 1 }), param('itemId').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      const n = await ShoppingListItem.destroy({ where: { id: req.params.itemId, list_id: list.id } });
      if (!n) return res.status(404).json({ error: 'Article introuvable' });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

router.post('/:id/best-store',
  [
    param('id').isInt({ min: 1 }),
    body('lat').optional().isFloat({ min: -90, max: 90 }),
    body('lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      const items = await ShoppingListItem.findAll({ where: { list_id: list.id } });
      const result = await svc.computeBestStore(items, { userLat: req.body.lat || null, userLng: req.body.lng || null });
      res.json(result);
    } catch (e) { next(e); }
  }
);

router.get('/:id/checkout-plan',
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      const items = await ShoppingListItem.findAll({ where: { list_id: list.id, checked: false } });

      const orgIds = [...new Set(items.filter(i => i.preferred_organization_id).map(i => i.preferred_organization_id))];
      const orgs = await Organization.findAll({ where: { id: { [Op.in]: orgIds } }, attributes: ['id', 'slug', 'name'] });
      const orgById = new Map(orgs.map(o => [o.id, o]));

      const groups = { resto: [], hanout: [] };
      const pharmacie = [];
      const unresolved = [];

      const byOrg = new Map(); // `${module}:${orgId}` -> group
      for (const item of items) {
        if (item.source_module === 'pharmacie') { pharmacie.push({ id: item.id, name: item.name }); continue; }
        if (!item.source_module || !item.preferred_organization_id || !orgById.has(item.preferred_organization_id)) {
          unresolved.push({ id: item.id, name: item.name });
          continue;
        }
        const org = orgById.get(item.preferred_organization_id);
        const key = `${item.source_module}:${org.id}`;
        if (!byOrg.has(key)) {
          const group = { organization_id: org.id, slug: org.slug, name: org.name, items: [] };
          byOrg.set(key, group);
          groups[item.source_module].push(group);
        }
        byOrg.get(key).items.push({
          item_id: item.id, name: item.name, source_product_id: item.source_product_id,
          quantity_value: item.quantity_value ? Number(item.quantity_value) : 1,
          unit_price: item.estimated_price != null ? Number(item.estimated_price) : null,
          image_url: item.image_url,
        });
      }

      res.json({ resto: groups.resto, hanout: groups.hanout, pharmacie, unresolved });
    } catch (e) { next(e); }
  }
);

router.post('/:id/usual-purchases/add',
  [
    param('id').isInt({ min: 1 }),
    body('product_ids').isArray({ min: 1, max: 50 }),
    body('product_ids.*').isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const list = await findOwnedList(req.params.id, req.user.id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      const products = await HanoutProduct.findAll({
        where: { id: { [Op.in]: req.body.product_ids } },
        include: [{ model: Organization, as: 'organization', attributes: ['id'] }],
      });
      const created = await Promise.all(products.map(p => ShoppingListItem.create({
        list_id: list.id, name: p.name, category: svc.categorizeItem(p.name),
        estimated_price: p.price, image_url: p.images?.[0] || null,
        source_module: 'hanout', source_product_id: p.id,
        preferred_organization_id: p.organization?.id || null,
      })));
      res.status(201).json({ ok: true, items: created });
    } catch (e) { next(e); }
  }
);

module.exports = router;
