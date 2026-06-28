'use strict';

/**
 * Routes Module Livreur
 * GET   /api/delivery/available        — commandes prêtes à livrer
 * POST  /api/delivery/accept/:orderId  — accepter une livraison
 * PATCH /api/delivery/:orderId/status  — mettre à jour le statut
 * GET   /api/delivery/history          — historique du livreur
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { Op } = require('sequelize');

const { Order, OrderItem, MenuItem, Organization, User, Delivery } = require('../models');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../auth/permissions');
const validate = require('../middleware/validate');

router.use(requireAuth);

// Seul le rôle 'delivery' (et admin+) peut accéder
const requireDelivery = requirePermission(PERMISSIONS.DELIVERY_MANAGE);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/delivery/available — commandes prêtes non assignées
// ════════════════════════════════════════════════════════════════════════════
router.get('/available', requireDelivery, async (req, res, next) => {
  try {
    const deliveries = await Delivery.findAll({
      where: { status: 'pending', partner_id: null },
      include: [{
        model: Order, as: 'order',
        where: { type: 'delivery', status: 'ready' },
        include: [
          {
            model: Organization, as: 'organization',
            attributes: ['id','name','slug','address','city','phone','logo_url']
          },
          {
            model: OrderItem, as: 'items',
            include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle'] }]
          }
        ]
      }],
      order: [['created_at','ASC']],
      limit: 50,
    });

    const result = deliveries.map(d => ({
      delivery_id:      d.id,
      order_id:         d.order.id,
      pickup_code:      d.order.pickup_code,
      guest_name:       d.order.guest_name,
      delivery_address: d.order.delivery_address,
      total_amount:     Number(d.order.total_amount),
      fee:              Number(d.fee),
      restaurant: {
        name:    d.order.organization?.name,
        address: d.order.organization?.address,
        phone:   d.order.organization?.phone,
      },
      items_count: (d.order.items || []).length,
      created_at:  d.createdAt,
    }));

    res.json({ available: result, count: result.length });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/delivery/accept/:orderId — accepter une livraison
// ════════════════════════════════════════════════════════════════════════════
router.post('/accept/:orderId',
  requireDelivery,
  [param('orderId').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const partnerId = req.user.id;
      const delivery = await Delivery.findOne({
        where: { order_id: req.params.orderId, status: 'pending', partner_id: null }
      });
      if (!delivery) return res.status(404).json({ error: 'Livraison introuvable ou déjà assignée' });

      delivery.partner_id = partnerId;
      delivery.status = 'assigned';
      await delivery.save();

      // Mettre à jour le statut de la commande
      await Order.update(
        { status: 'picked_up' },
        { where: { id: req.params.orderId } }
      );

      // Notifier via Socket.IO
      if (global.io) {
        global.io.to(`track:${delivery.order_id}`).emit('order:status', {
          order_id: delivery.order_id, status: 'picked_up'
        });
      }

      res.json({ ok: true, delivery_id: delivery.id, message: 'Livraison acceptée' });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/delivery/:orderId/status — mettre à jour statut livraison
// ════════════════════════════════════════════════════════════════════════════
router.patch('/:orderId/status',
  requireDelivery,
  [
    param('orderId').isInt({ min: 1 }),
    body('status').isIn(['picking_up','picked_up','on_the_way','delivered','failed']),
    body('partner_lat').optional().isFloat({ min: -90, max: 90 }),
    body('partner_lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const delivery = await Delivery.findOne({
        where: {
          order_id: req.params.orderId,
          partner_id: req.user.id
        }
      });
      if (!delivery) return res.status(404).json({ error: 'Livraison introuvable' });

      const { status, partner_lat, partner_lng } = req.body;
      delivery.status = status;
      if (partner_lat !== undefined) delivery.partner_lat = partner_lat;
      if (partner_lng !== undefined) delivery.partner_lng = partner_lng;
      if (status === 'picked_up') delivery.pickup_at = new Date();
      if (status === 'delivered') delivery.delivered_at = new Date();
      await delivery.save();

      // Sync statut commande
      const orderStatusMap = {
        picking_up:  'confirmed',
        picked_up:   'picked_up',
        on_the_way:  'on_the_way',
        delivered:   'delivered',
        failed:      'cancelled',
      };
      const order = await Order.findByPk(req.params.orderId);
      if (order) {
        order.status = orderStatusMap[status] || order.status;
        await order.save();

        // Notifier client et restaurant
        if (global.io) {
          const payload = { order_id: order.id, status: order.status };
          global.io.to(`track:${order.pickup_code}`).emit('order:status', payload);
          global.io.to(`org:${order.organization_id}`).emit('order:status', payload);
        }
      }

      res.json({ ok: true, delivery_status: status });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/delivery/history — historique du livreur
// ════════════════════════════════════════════════════════════════════════════
router.get('/history', requireDelivery, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const deliveries = await Delivery.findAll({
      where: { partner_id: req.user.id },
      include: [{
        model: Order, as: 'order',
        attributes: ['id','pickup_code','total_amount','guest_name','delivery_address','created_at'],
        include: [{
          model: Organization, as: 'organization',
          attributes: ['name','slug']
        }]
      }],
      order: [['created_at','DESC']],
      limit: 50,
    });

    const todayDeliveries = deliveries.filter(d =>
      d.createdAt?.toISOString()?.slice(0,10) === today
    );
    const totalFees = todayDeliveries.reduce((s, d) => s + Number(d.fee || 0), 0);

    res.json({
      history: deliveries.map(d => ({
        delivery_id:      d.id,
        order_id:         d.order?.id,
        pickup_code:      d.order?.pickup_code,
        status:           d.status,
        fee:              Number(d.fee),
        restaurant_name:  d.order?.organization?.name,
        delivery_address: d.order?.delivery_address,
        guest_name:       d.order?.guest_name,
        delivered_at:     d.delivered_at,
        created_at:       d.createdAt,
      })),
      today_summary: {
        count:     todayDeliveries.length,
        completed: todayDeliveries.filter(d => d.status === 'delivered').length,
        earnings:  Math.round(totalFees * 100) / 100,
      }
    });
  } catch (e) { next(e); }
});

module.exports = router;
