'use strict';

/**
 * Routes Module Delivery — Zones (Phase 5)
 * GET/POST     /api/delivery/zones
 * PATCH/DELETE /api/delivery/zones/:id
 *
 * Un commerce ne gère que ses propres zones (organization_id = son org).
 * Le SuperAdmin peut en plus créer/gérer des zones réseau (organization_id
 * null) et voir toutes les zones.
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { Op } = require('sequelize');

const { DeliveryZone } = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS, isRoleCompatible } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');

router.use(requireAuth);

function isSuperAdmin(req) { return isRoleCompatible(req.user.role, 'superadmin'); }

router.get('/zones', async (req, res, next) => {
  try {
    const where = isSuperAdmin(req)
      ? (req.query.organization_id ? { organization_id: req.query.organization_id === 'null' ? null : req.query.organization_id } : {})
      : { organization_id: { [Op.in]: [req.user.organization_id, null] } };
    const zones = await DeliveryZone.findAll({ where, order: [['priority', 'DESC'], ['id', 'ASC']] });
    res.json({ zones });
  } catch (e) { next(e); }
});

router.post('/zones',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  [
    body('name').trim().isLength({ min: 1, max: 120 }),
    body('center_lat').isFloat({ min: -90, max: 90 }),
    body('center_lng').isFloat({ min: -180, max: 180 }),
    body('radius_km').isFloat({ min: 0.1, max: 200 }),
    body('base_fee').optional().isFloat({ min: 0 }),
    body('per_km_fee').optional().isFloat({ min: 0 }),
    body('priority').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const organization_id = isSuperAdmin(req) && req.body.organization_id === null
        ? null
        : (isSuperAdmin(req) && req.body.organization_id ? req.body.organization_id : req.user.organization_id);
      const zone = await DeliveryZone.create({
        organization_id,
        name: req.body.name, color: req.body.color || null,
        center_lat: req.body.center_lat, center_lng: req.body.center_lng, radius_km: req.body.radius_km,
        base_fee: req.body.base_fee ?? null, per_km_fee: req.body.per_km_fee ?? null,
        avg_delivery_time_min: req.body.avg_delivery_time_min ?? null,
        priority: req.body.priority ?? 0,
      });
      res.status(201).json({ zone });
    } catch (e) { next(e); }
  }
);

router.patch('/zones/:id',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const where = isSuperAdmin(req) ? { id: req.params.id } : { id: req.params.id, organization_id: req.user.organization_id };
      const zone = await DeliveryZone.findOne({ where });
      if (!zone) return res.status(404).json({ error: 'Zone introuvable' });

      const fields = ['name', 'color', 'center_lat', 'center_lng', 'radius_km', 'base_fee', 'per_km_fee', 'avg_delivery_time_min', 'priority', 'is_active'];
      for (const f of fields) if (req.body[f] !== undefined) zone[f] = req.body[f];
      await zone.save();
      res.json({ zone });
    } catch (e) { next(e); }
  }
);

router.delete('/zones/:id', requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE), async (req, res, next) => {
  try {
    const where = isSuperAdmin(req) ? { id: req.params.id } : { id: req.params.id, organization_id: req.user.organization_id };
    const n = await DeliveryZone.destroy({ where });
    if (!n) return res.status(404).json({ error: 'Zone introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
