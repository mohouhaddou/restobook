'use strict';

/**
 * Routes Module Delivery — Localisation (Phase 2)
 * POST /api/delivery/location — fallback REST du ping GPS (le chemin
 * principal est Socket.IO, voir backend/index.js 'courier:position:push') —
 * utile quand la websocket n'est pas disponible ou pour les tests.
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const { DeliveryPerson, User, Delivery, DeliveryTracking } = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS, isRoleCompatible } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const { recordPing, buildPositionPayload } = require('./services/locationService');
const { resolveOrderModel, trackingCode } = require('./services/orderEngine');

router.use(requireAuth);

router.post('/location',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('speed_kmh').optional().isFloat({ min: 0 }),
    body('heading_deg').optional().isFloat({ min: 0, max: 360 }),
    body('accuracy_m').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const deliveryPerson = await DeliveryPerson.findOne({
        where: { user_id: req.user.id },
        include: [{ model: User, as: 'user', attributes: ['nom'] }],
      });
      if (!deliveryPerson) return res.status(404).json({ error: 'Profil livreur introuvable' });

      const { activeAssignment } = await recordPing(deliveryPerson, req.body);

      if (global.io && activeAssignment?.order) {
        const payload = buildPositionPayload({
          deliveryPersonId: deliveryPerson.id,
          lat: Number(req.body.lat), lng: Number(req.body.lng),
          speed_kmh: req.body.speed_kmh, heading_deg: req.body.heading_deg,
          activeAssignment,
          courierFirstName: deliveryPerson.user?.nom ? deliveryPerson.user.nom.split(' ')[0] : null,
        });
        global.io.to(`track:${trackingCode(activeAssignment.order)}`).emit('courier:position', payload);
        global.io.to(`org_delivery:${activeAssignment.order.organization_id}`).emit('courier:position', payload);
      }

      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

// GET /api/delivery/assignments/:deliveryId/tracking — historique GPS d'une
// livraison (spec point 10/15). Accès : le livreur concerné, le staff de
// l'organisation de la commande, ou superadmin.
router.get('/assignments/:deliveryId/tracking', async (req, res, next) => {
  try {
    const delivery = await Delivery.findByPk(req.params.deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Livraison introuvable' });

    const order = await resolveOrderModel(delivery.pos_order_type).findByPk(delivery.order_id, { attributes: ['id', 'organization_id'] });
    const isOwnCourier = delivery.partner_id === req.user.id;
    const isSameOrgStaff = req.user.organization_id && order?.organization_id === req.user.organization_id;
    const isSuperAdmin = isRoleCompatible(req.user.role, 'superadmin');
    if (!isOwnCourier && !isSameOrgStaff && !isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });

    const points = await DeliveryTracking.findAll({
      where: { assignment_id: delivery.id },
      attributes: ['lat', 'lng', 'speed_kmh', 'heading_deg', 'recorded_at'],
      order: [['recorded_at', 'ASC']],
    });
    res.json({ points });
  } catch (e) { next(e); }
});

module.exports = router;
