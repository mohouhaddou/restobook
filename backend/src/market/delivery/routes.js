'use strict';

/**
 * Routes Module Delivery — Profil livreur (Phase 3)
 * GET   /api/delivery/me         — profil + statut courant
 * PATCH /api/delivery/me/status  — changer son statut (disponible/pause/hors ligne/…)
 *
 * Prérequis du moteur de dispatch : sans endpoint pour passer 'available',
 * un DeliveryPerson resterait 'offline' pour toujours (valeur par défaut) et
 * ne serait jamais éligible — voir services/dispatchEngine.js findCandidatePool.
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const { DeliveryPerson } = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');

router.use(requireAuth, requirePermission(PERMISSIONS.DELIVERY_MANAGE));

const STATUS_VALUES = ['available', 'busy', 'paused', 'offline', 'on_delivery', 'awaiting', 'returning'];

router.get('/me', async (req, res, next) => {
  try {
    const dp = await DeliveryPerson.findOne({ where: { user_id: req.user.id } });
    if (!dp) return res.status(404).json({ error: 'Profil livreur introuvable' });
    res.json({
      id: dp.id, mode: dp.mode, status: dp.status,
      avg_rating: Number(dp.avg_rating), ratings_count: dp.ratings_count,
      deliveries_count: dp.deliveries_count, total_distance_km: Number(dp.total_distance_km),
      last_seen_at: dp.last_seen_at,
    });
  } catch (e) { next(e); }
});

router.patch('/me/status',
  [body('status').isIn(STATUS_VALUES)],
  validate,
  async (req, res, next) => {
    try {
      const dp = await DeliveryPerson.findOne({ where: { user_id: req.user.id } });
      if (!dp) return res.status(404).json({ error: 'Profil livreur introuvable' });

      // Un livreur ne se déclare jamais lui-même 'on_delivery' : ce statut est
      // dérivé automatiquement par l'acceptation d'une livraison (voir
      // dispatchEngine.respondToOffer / orders/deliveryRoutes.js), pas un choix manuel.
      if (req.body.status === 'on_delivery') return res.status(400).json({ error: 'Statut réservé au système' });

      dp.status = req.body.status;
      dp.last_status_change_at = new Date();
      await dp.save();

      if (global.io) {
        const payload = { delivery_person_id: dp.id, status: dp.status };
        if (dp.owner_organization_id) global.io.to(`org_delivery:${dp.owner_organization_id}`).emit('courier:status', payload);
        global.io.to('superadmin:delivery').emit('courier:status', payload);
      }

      res.json({ ok: true, status: dp.status });
    } catch (e) { next(e); }
  }
);

module.exports = router;
