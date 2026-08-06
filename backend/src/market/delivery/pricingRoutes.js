'use strict';

/**
 * Routes Module Delivery — Tarification (Phase 5)
 * GET/POST     /api/delivery/pricing-rules
 * PATCH/DELETE /api/delivery/pricing-rules/:id
 *
 * Même scoping que zoneRoutes.js : un commerce ne gère que ses propres
 * règles, le SuperAdmin peut en plus gérer les règles globales.
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { Op } = require('sequelize');

const { DeliveryPricingRule } = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS, isRoleCompatible } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');

router.use(requireAuth);

function isSuperAdmin(req) { return isRoleCompatible(req.user.role, 'superadmin'); }
const RULE_TYPES = ['fixed', 'per_distance', 'per_duration', 'dynamic_surge', 'off_peak', 'free_threshold'];

router.get('/pricing-rules', async (req, res, next) => {
  try {
    const where = isSuperAdmin(req)
      ? (req.query.organization_id ? { organization_id: req.query.organization_id === 'null' ? null : req.query.organization_id } : {})
      : { organization_id: { [Op.in]: [req.user.organization_id, null] } };
    const rules = await DeliveryPricingRule.findAll({ where, order: [['priority', 'DESC'], ['id', 'ASC']] });
    res.json({ rules });
  } catch (e) { next(e); }
});

router.post('/pricing-rules',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  [
    body('name').trim().isLength({ min: 1, max: 120 }),
    body('type').isIn(RULE_TYPES),
    body('base_amount').isFloat({ min: 0 }),
    body('zone_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('per_km_amount').optional({ nullable: true }).isFloat({ min: 0 }),
    body('surge_multiplier').optional({ nullable: true }).isFloat({ min: 0 }),
    body('min_order_for_free').optional({ nullable: true }).isFloat({ min: 0 }),
    body('priority').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const organization_id = isSuperAdmin(req) && req.body.organization_id === null
        ? null
        : (isSuperAdmin(req) && req.body.organization_id ? req.body.organization_id : req.user.organization_id);
      const rule = await DeliveryPricingRule.create({
        organization_id, zone_id: req.body.zone_id ?? null,
        name: req.body.name, type: req.body.type,
        base_amount: req.body.base_amount,
        per_km_amount: req.body.per_km_amount ?? null,
        per_minute_amount: req.body.per_minute_amount ?? null,
        surge_multiplier: req.body.surge_multiplier ?? null,
        min_order_for_free: req.body.min_order_for_free ?? null,
        active_days: req.body.active_days ?? null,
        active_from: req.body.active_from ?? null, active_to: req.body.active_to ?? null,
        priority: req.body.priority ?? 0,
      });
      res.status(201).json({ rule });
    } catch (e) { next(e); }
  }
);

router.patch('/pricing-rules/:id',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const where = isSuperAdmin(req) ? { id: req.params.id } : { id: req.params.id, organization_id: req.user.organization_id };
      const rule = await DeliveryPricingRule.findOne({ where });
      if (!rule) return res.status(404).json({ error: 'Règle introuvable' });

      const fields = [
        'name', 'type', 'zone_id', 'base_amount', 'per_km_amount', 'per_minute_amount',
        'surge_multiplier', 'min_order_for_free', 'active_days', 'active_from', 'active_to',
        'priority', 'is_active',
      ];
      for (const f of fields) if (req.body[f] !== undefined) rule[f] = req.body[f];
      await rule.save();
      res.json({ rule });
    } catch (e) { next(e); }
  }
);

router.delete('/pricing-rules/:id', requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE), async (req, res, next) => {
  try {
    const where = isSuperAdmin(req) ? { id: req.params.id } : { id: req.params.id, organization_id: req.user.organization_id };
    const n = await DeliveryPricingRule.destroy({ where });
    if (!n) return res.status(404).json({ error: 'Règle introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
