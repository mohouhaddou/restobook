'use strict';

/**
 * Routes Module Delivery — Cycle d'assignation (Phase 3)
 * POST /api/delivery/assignments/:deliveryId/accept — accepter une offre du dispatch engine
 * POST /api/delivery/assignments/:deliveryId/reject — la refuser (re-dispatch immédiat)
 *
 * Coexiste avec l'ancien POST /api/delivery/accept/:orderId (premier arrivé,
 * inchangé) : ces routes ne s'appliquent qu'aux livraisons déjà proposées
 * par le moteur de dispatch (statut 'proposed'), pas au pool manuel.
 */

const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const { respondToOffer } = require('./services/dispatchEngine');

router.use(requireAuth, requirePermission(PERMISSIONS.DELIVERY_MANAGE));

router.post('/assignments/:deliveryId/accept',
  [param('deliveryId').isInt({ min: 1 })], validate,
  async (req, res, next) => {
    try {
      const result = await respondToOffer(Number(req.params.deliveryId), req.user, 'accept');
      res.json(result);
    } catch (e) { e.status ? res.status(e.status).json({ error: e.message }) : next(e); }
  }
);

router.post('/assignments/:deliveryId/reject',
  [param('deliveryId').isInt({ min: 1 })], validate,
  async (req, res, next) => {
    try {
      const result = await respondToOffer(Number(req.params.deliveryId), req.user, 'reject');
      res.json(result);
    } catch (e) { e.status ? res.status(e.status).json({ error: e.message }) : next(e); }
  }
);

module.exports = router;
