'use strict';

/**
 * Routes : entité Business (profil public Ifilino)
 *
 * GET    /api/businesses              — liste paginée (public/admin)
 * GET    /api/businesses/:id          — détail business
 * GET    /api/businesses/by-org/:orgId — business via organization_id
 * POST   /api/businesses              — créer (admin/superadmin)
 * PUT    /api/businesses/:id          — modifier (admin org ou superadmin)
 * PATCH  /api/businesses/:id/status   — changer status (superadmin)
 * DELETE /api/businesses/:id          — supprimer (superadmin uniquement)
 */

const express = require('express');
const router  = express.Router();
const { body, param, query } = require('express-validator');
const { Op }  = require('sequelize');

const { requireAuth, requireSuperAdmin, requirePermission, orgScope } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { Business, Organization } = require('../../../models');
const { PERMISSIONS } = require('../../../auth/permissions');

// ── Helper : attributs Organisation publics ───────────────────────────────────
const ORG_ATTRS = ['id', 'slug', 'name', 'type', 'plan', 'active', 'is_marketplace', 'is_internal',
  'avg_rating', 'total_reviews', 'accepts_delivery', 'accepts_takeaway', 'accepts_dine_in',
  'cuisine_type', 'delivery_fee', 'min_order_amount', 'avg_prep_time'];

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Validations réutilisables ─────────────────────────────────────────────────
const BIZ_TYPES   = ['restaurant','cafe','cantine','hanout','boulangerie','patisserie','boucherie','autre'];
const BIZ_MODULES = ['resto','cantine','hanout','marketplace'];
const BIZ_STATUS  = ['draft','pending','approved','rejected','suspended'];

const bodyValidators = [
  body('name').optional().trim().isLength({ min: 2, max: 191 }),
  body('business_type').optional().isIn(BIZ_TYPES),
  body('module').optional().isIn(BIZ_MODULES),
  body('description').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim().isLength({ max: 100 }),
  body('district').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('phone').optional().trim().isLength({ max: 32 }),
  body('whatsapp').optional().trim().isLength({ max: 32 }),
  body('email').optional().isEmail(),
  body('logo').optional().trim().isURL(),
  body('cover_image').optional().trim().isURL(),
  body('is_public').optional().isBoolean(),
  body('opening_hours').optional().isObject(),
];

/* ══════════════════════════════════════════════════════════════════════════════
   GET /api/businesses  — liste paginée
══════════════════════════════════════════════════════════════════════════════ */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(BIZ_STATUS),
    query('module').optional().isIn(BIZ_MODULES),
    query('business_type').optional().isIn(BIZ_TYPES),
    query('city').optional().trim(),
    query('q').optional().trim(),
    query('is_public').optional().isBoolean(),
  ],
  validate,
  ah(async (req, res) => {
    const page    = Math.max(1, parseInt(req.query.page  || 1));
    const limit   = Math.min(100, parseInt(req.query.limit || 20));
    const offset  = (page - 1) * limit;

    const where = {};
    if (req.query.status)        where.status        = req.query.status;
    if (req.query.module)        where.module        = req.query.module;
    if (req.query.business_type) where.business_type = req.query.business_type;
    if (req.query.city)          where.city          = { [Op.like]: `%${req.query.city}%` };
    if (req.query.is_public !== undefined) where.is_public = req.query.is_public === 'true';
    if (req.query.q) {
      where[Op.or] = [
        { name:        { [Op.like]: `%${req.query.q}%` } },
        { description: { [Op.like]: `%${req.query.q}%` } },
        { city:        { [Op.like]: `%${req.query.q}%` } },
      ];
    }

    // Requêtes publiques : seulement les businesses approuvés et publics
    const isAuthenticated = !!req.headers.authorization;
    if (!isAuthenticated) {
      where.status    = 'approved';
      where.is_public = true;
    }

    const { count, rows } = await Business.findAndCountAll({
      where,
      include: [{ model: Organization, as: 'organization', attributes: ORG_ATTRS }],
      order: [['id', 'ASC']],
      limit,
      offset,
    });

    res.json({
      businesses: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  })
);

/* ══════════════════════════════════════════════════════════════════════════════
   GET /api/businesses/by-org/:orgId  — récupérer le business d'une organisation
══════════════════════════════════════════════════════════════════════════════ */
router.get('/by-org/:orgId',
  [param('orgId').isInt({ min: 1 })],
  validate,
  ah(async (req, res) => {
    const biz = await Business.findOne({
      where: { organization_id: req.params.orgId },
      include: [{ model: Organization, as: 'organization', attributes: ORG_ATTRS }],
    });
    if (!biz) return res.status(404).json({ error: 'Business non trouvé pour cette organisation' });
    res.json({ business: biz });
  })
);

/* ══════════════════════════════════════════════════════════════════════════════
   GET /api/businesses/:id  — détail
══════════════════════════════════════════════════════════════════════════════ */
router.get('/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  ah(async (req, res) => {
    const biz = await Business.findByPk(req.params.id, {
      include: [{ model: Organization, as: 'organization', attributes: ORG_ATTRS }],
    });
    if (!biz) return res.status(404).json({ error: 'Business introuvable' });
    res.json({ business: biz });
  })
);

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/businesses  — créer (admin ou superadmin)
══════════════════════════════════════════════════════════════════════════════ */
router.post('/',
  requireAuth,
  requirePermission(PERMISSIONS.ORGANIZATION_MANAGE),
  [
    body('organization_id').isInt({ min: 1 }).withMessage('organization_id requis'),
    body('name').trim().isLength({ min: 2, max: 191 }).withMessage('name requis'),
    body('business_type').isIn(BIZ_TYPES).withMessage('business_type invalide'),
    body('module').isIn(BIZ_MODULES).withMessage('module invalide'),
    ...bodyValidators,
  ],
  validate,
  ah(async (req, res) => {
    const { organization_id, name, business_type, module: mod, ...rest } = req.body;

    const org = await Organization.findByPk(organization_id);
    if (!org) return res.status(404).json({ error: 'Organisation introuvable' });

    const exists = await Business.findOne({ where: { organization_id } });
    if (exists) return res.status(409).json({ error: 'Un business existe déjà pour cette organisation', business_id: exists.id });

    const biz = await Business.create({
      organization_id,
      name,
      business_type,
      module: mod,
      status: 'draft',
      ...rest,
    });

    res.status(201).json({ business: biz, message: 'Business créé avec status=draft' });
  })
);

/* ══════════════════════════════════════════════════════════════════════════════
   PUT /api/businesses/:id  — modifier (admin de l'org ou superadmin)
══════════════════════════════════════════════════════════════════════════════ */
router.put('/:id',
  requireAuth,
  [param('id').isInt({ min: 1 }), ...bodyValidators],
  validate,
  ah(async (req, res) => {
    const biz = await Business.findByPk(req.params.id);
    if (!biz) return res.status(404).json({ error: 'Business introuvable' });

    // Vérification accès : soit superadmin, soit admin de l'org propriétaire
    const u = req.user;
    const isSuperAdmin = u.role === 'superadmin';
    const isOrgAdmin   = ['admin', 'manager', 'owner'].includes(u.role) &&
                         u.organization_id === biz.organization_id;
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Un non-superadmin ne peut pas changer status/module via PUT
    const allowed = { ...req.body };
    if (!isSuperAdmin) {
      delete allowed.status;
      delete allowed.module;
      delete allowed.rejection_reason;
      delete allowed.reviewed_by;
      delete allowed.reviewed_at;
      delete allowed.organization_id;
    }

    await biz.update(allowed);
    res.json({ business: biz, message: 'Business mis à jour' });
  })
);

/* ══════════════════════════════════════════════════════════════════════════════
   PATCH /api/businesses/:id/status  — workflow validation (superadmin)
══════════════════════════════════════════════════════════════════════════════ */
router.patch('/:id/status',
  requireAuth,
  requireSuperAdmin,
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(BIZ_STATUS).withMessage('status invalide'),
    body('rejection_reason').optional().trim(),
  ],
  validate,
  ah(async (req, res) => {
    const biz = await Business.findByPk(req.params.id);
    if (!biz) return res.status(404).json({ error: 'Business introuvable' });

    const { status, rejection_reason } = req.body;

    const update = {
      status,
      rejection_reason: status === 'rejected' ? (rejection_reason || null) : null,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    };

    // Synchroniser is_public avec l'approbation
    if (status === 'approved') update.is_public = true;
    if (['rejected', 'suspended'].includes(status)) update.is_public = false;

    await biz.update(update);

    // Mettre à jour Organization.is_marketplace en miroir
    const org = await Organization.findByPk(biz.organization_id);
    if (org) {
      await org.update({
        is_marketplace: status === 'approved',
        active: status !== 'suspended',
      });
    }

    res.json({
      business: biz,
      message: `Status → ${status}`,
      org_synced: !!org,
    });
  })
);

/* ══════════════════════════════════════════════════════════════════════════════
   DELETE /api/businesses/:id  — supprimer (superadmin uniquement, soft)
══════════════════════════════════════════════════════════════════════════════ */
router.delete('/:id',
  requireAuth,
  requireSuperAdmin,
  [param('id').isInt({ min: 1 })],
  validate,
  ah(async (req, res) => {
    const biz = await Business.findByPk(req.params.id);
    if (!biz) return res.status(404).json({ error: 'Business introuvable' });

    await biz.update({ status: 'suspended', is_public: false });
    res.json({ message: 'Business suspendu (soft delete) — organisation préservée' });
  })
);

module.exports = router;
