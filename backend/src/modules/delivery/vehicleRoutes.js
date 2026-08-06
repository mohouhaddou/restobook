'use strict';

/**
 * Routes Module Delivery — Véhicules (Phase 6)
 * GET    /api/delivery/vehicles/me   — mes véhicules
 * POST   /api/delivery/vehicles      — déclarer un véhicule (devient l'actif)
 * PATCH  /api/delivery/vehicles/:id  — modifier mon véhicule
 * DELETE /api/delivery/vehicles/:id  — supprimer mon véhicule
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const { DeliveryPerson, DeliveryVehicle } = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');

const VEHICLE_TYPES = ['foot', 'bike', 'scooter', 'moto', 'car', 'van'];

router.use(requireAuth, requirePermission(PERMISSIONS.DELIVERY_MANAGE));

async function myDeliveryPerson(req, res) {
  const dp = await DeliveryPerson.findOne({ where: { user_id: req.user.id } });
  if (!dp) { res.status(404).json({ error: 'Profil livreur introuvable' }); return null; }
  return dp;
}

router.get('/vehicles/me', async (req, res, next) => {
  try {
    const dp = await myDeliveryPerson(req, res);
    if (!dp) return;
    const vehicles = await DeliveryVehicle.findAll({ where: { delivery_person_id: dp.id }, order: [['createdAt', 'DESC']] });
    res.json({ vehicles });
  } catch (e) { next(e); }
});

router.post('/vehicles',
  [
    body('type').isIn(VEHICLE_TYPES),
    body('brand').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('plate_number').optional({ nullable: true }).trim().isLength({ max: 32 }),
    body('capacity_l').optional({ nullable: true }).isFloat({ min: 0 }),
    body('max_weight_kg').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const dp = await myDeliveryPerson(req, res);
      if (!dp) return;
      // Un seul véhicule "actif" à la fois par convention applicative (pas de
      // contrainte DB) — en déclarer un nouveau désactive les précédents.
      await DeliveryVehicle.update({ is_active: false }, { where: { delivery_person_id: dp.id } });
      const vehicle = await DeliveryVehicle.create({
        delivery_person_id: dp.id,
        type: req.body.type, brand: req.body.brand || null, plate_number: req.body.plate_number || null,
        capacity_l: req.body.capacity_l ?? null, max_weight_kg: req.body.max_weight_kg ?? null,
        fuel_consumption: req.body.fuel_consumption || null, is_active: true,
      });
      res.status(201).json({ vehicle });
    } catch (e) { next(e); }
  }
);

router.patch('/vehicles/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const dp = await myDeliveryPerson(req, res);
      if (!dp) return;
      const vehicle = await DeliveryVehicle.findOne({ where: { id: req.params.id, delivery_person_id: dp.id } });
      if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable' });

      const fields = ['type', 'brand', 'plate_number', 'capacity_l', 'max_weight_kg', 'fuel_consumption', 'is_active'];
      for (const f of fields) if (req.body[f] !== undefined) vehicle[f] = req.body[f];
      await vehicle.save();
      res.json({ vehicle });
    } catch (e) { next(e); }
  }
);

router.delete('/vehicles/:id', async (req, res, next) => {
  try {
    const dp = await myDeliveryPerson(req, res);
    if (!dp) return;
    const n = await DeliveryVehicle.destroy({ where: { id: req.params.id, delivery_person_id: dp.id } });
    if (!n) return res.status(404).json({ error: 'Véhicule introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
