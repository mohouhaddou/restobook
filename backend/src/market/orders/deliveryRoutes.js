'use strict';

/**
 * Routes Module Livreur — dual-engine (resto Order + hanout HanoutOrder)
 * GET   /api/delivery/available          — commandes prêtes à livrer (les 2 moteurs)
 * POST  /api/delivery/accept/:deliveryId — accepter une livraison
 * PATCH /api/delivery/:deliveryId/status — mettre à jour le statut
 * GET   /api/delivery/history            — historique du livreur
 *
 * Les routes utilisent l'id de la ligne `Delivery` (:deliveryId), jamais
 * l'id de la commande sous-jacente : Order.id et HanoutOrder.id sont deux
 * séquences indépendantes qui se chevauchent (voir orderEngine.js), un
 * :orderId serait ambigu entre les deux moteurs.
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const {
  Order, OrderItem, MenuItem, HanoutOrder, HanoutOrderItem, Organization, DeliveryPerson, Delivery,
} = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const statusHistoryService = require('../delivery/services/statusHistoryService');
const { isHanout, resolveOrderModel, trackingCode, guestName, totalAmount, notificationShim, courierEligibleForOrg } = require('../delivery/services/orderEngine');

router.use(requireAuth);

// Seul le rôle 'delivery' (et admin+) peut accéder
const requireDelivery = requirePermission(PERMISSIONS.DELIVERY_MANAGE);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/delivery/available — commandes prêtes non assignées (resto + hanout)
// ════════════════════════════════════════════════════════════════════════════
router.get('/available', requireDelivery, async (req, res, next) => {
  try {
    const deliveries = await Delivery.findAll({
      where: { status: 'pending', partner_id: null },
      order: [['created_at', 'ASC']],
      limit: 50,
    });
    if (!deliveries.length) return res.json({ available: [], count: 0 });

    const requesterDp = await DeliveryPerson.findOne({ where: { user_id: req.user.id } });

    const restoIds  = deliveries.filter(d => !isHanout(d)).map(d => d.order_id);
    const hanoutIds = deliveries.filter(d => isHanout(d)).map(d => d.order_id);

    const [restoOrders, hanoutOrders] = await Promise.all([
      restoIds.length ? Order.findAll({
        where: { id: restoIds, type: 'delivery', status: 'ready' },
        include: [
          { model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'address', 'city', 'phone', 'logo_url', 'latitude', 'longitude', 'delivery_mode'] },
          { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle'] }] },
        ],
      }) : [],
      hanoutIds.length ? HanoutOrder.findAll({
        where: { id: hanoutIds, delivery_type: 'delivery', status: 'ready' },
        include: [
          { model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'address', 'city', 'phone', 'logo_url', 'latitude', 'longitude', 'delivery_mode'] },
          { model: HanoutOrderItem, as: 'items' },
        ],
      }) : [],
    ]);
    const restoMap  = new Map(restoOrders.map(o => [o.id, o]));
    const hanoutMap = new Map(hanoutOrders.map(o => [o.id, o]));

    const result = deliveries.map(d => {
      const order = isHanout(d) ? hanoutMap.get(d.order_id) : restoMap.get(d.order_id);
      if (!order) return null; // pas (encore) prête, annulée, ou autre — pas éligible
      if (!order.organization || !courierEligibleForOrg(requesterDp, order.organization)) return null;
      return {
        delivery_id:      d.id,
        order_id:         order.id,
        engine:           isHanout(d) ? 'hanout' : 'resto',
        pickup_code:      trackingCode(order),
        guest_name:       guestName(order),
        delivery_address: order.delivery_address,
        delivery_lat:     order.delivery_lat != null ? Number(order.delivery_lat) : null,
        delivery_lng:     order.delivery_lng != null ? Number(order.delivery_lng) : null,
        total_amount:     totalAmount(order),
        fee:              Number(d.fee),
        restaurant: {
          name:    order.organization?.name,
          address: order.organization?.address,
          phone:   order.organization?.phone,
          lat:     order.organization?.latitude  != null ? Number(order.organization.latitude)  : null,
          lng:     order.organization?.longitude != null ? Number(order.organization.longitude) : null,
        },
        items_count: (order.items || []).length,
        created_at:  d.createdAt,
      };
    }).filter(Boolean);

    res.json({ available: result, count: result.length });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/delivery/accept/:deliveryId — accepter une livraison
// ════════════════════════════════════════════════════════════════════════════
router.post('/accept/:deliveryId',
  requireDelivery,
  [param('deliveryId').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const partnerId = req.user.id;
      const delivery = await Delivery.findOne({
        where: { id: req.params.deliveryId, status: 'pending', partner_id: null }
      });
      if (!delivery) return res.status(404).json({ error: 'Livraison introuvable ou déjà assignée' });

      // Le statut de la commande ne change PAS à l'acceptation : "picked_up"
      // ne doit refléter que le retrait effectif chez le commerçant, déclenché
      // plus tard par PATCH /:deliveryId/status.
      const OrderModel = resolveOrderModel(delivery.pos_order_type);
      const order = await OrderModel.findByPk(delivery.order_id);

      const claimOrg = order ? await Organization.findByPk(order.organization_id, { attributes: ['id', 'delivery_mode'] }) : null;
      const requesterDp = await DeliveryPerson.findOne({ where: { user_id: partnerId } });
      if (!claimOrg || !courierEligibleForOrg(requesterDp, claimOrg)) {
        return res.status(403).json({ error: 'Cette livraison ne fait pas partie de votre pool' });
      }

      delivery.partner_id = partnerId;
      delivery.status = 'assigned';
      await delivery.save();

      statusHistoryService.recordTransition(delivery.id, { from: 'pending', to: 'assigned', userId: req.user.id, role: req.user.role, reason: 'manual_pool_claim' });
      DeliveryPerson.update(
        { status: 'on_delivery', last_status_change_at: new Date() },
        { where: { user_id: partnerId } }
      ).catch(() => {});

      // Notifier via Socket.IO — room alignée sur le code de suivi public
      // (pickup_code resto / order_number hanout), pas sur l'id numérique de
      // la commande : la page de suivi public ne rejoint que track:{code}.
      if (global.io && order) {
        const payload = { order_id: order.id, status: order.status, delivery_status: 'assigned' };
        global.io.to(`track:${trackingCode(order)}`).emit('order:status', payload);
        global.io.to(`org:${order.organization_id}`).emit('order:status', payload);
      }
      if (order) {
        require('../../shared/notifications/NotificationService').create({
          type: 'DELIVERY_ACCEPTED',
          organization_id: order.organization_id,
          recipient_id: null, // broadcast à tout le staff de l'org
          title: '🛵 Livraison acceptée',
          message: `Un livreur a accepté la commande #${trackingCode(order)}`,
          entity_type: 'ORDER', entity_id: order.id, action_url: '/orders',
        }).catch(() => {});
      }

      res.json({ ok: true, delivery_id: delivery.id, message: 'Livraison acceptée' });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/delivery/:deliveryId/status — mettre à jour statut livraison
// ════════════════════════════════════════════════════════════════════════════
router.patch('/:deliveryId/status',
  requireDelivery,
  [
    param('deliveryId').isInt({ min: 1 }),
    body('status').isIn(['picking_up', 'picked_up', 'on_the_way', 'delivered', 'failed']),
    body('partner_lat').optional().isFloat({ min: -90, max: 90 }),
    body('partner_lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const delivery = await Delivery.findOne({
        where: { id: req.params.deliveryId, partner_id: req.user.id }
      });
      if (!delivery) return res.status(404).json({ error: 'Livraison introuvable' });

      const { status, partner_lat, partner_lng } = req.body;
      const prevDeliveryStatus = delivery.status;
      delivery.status = status;
      if (partner_lat !== undefined) delivery.partner_lat = partner_lat;
      if (partner_lng !== undefined) delivery.partner_lng = partner_lng;
      if (status === 'picked_up') delivery.pickup_at = new Date();
      if (status === 'delivered') delivery.delivered_at = new Date();
      await delivery.save();

      statusHistoryService.recordTransition(delivery.id, {
        from: prevDeliveryStatus, to: status, userId: req.user.id, role: req.user.role,
        lat: partner_lat, lng: partner_lng,
      });
      if (status === 'delivered' || status === 'failed') {
        DeliveryPerson.update(
          { status: 'available', last_status_change_at: new Date() },
          { where: { user_id: req.user.id } }
        ).catch(() => {});
      }

      // Sync statut commande — valeurs communes aux deux moteurs depuis
      // l'extension additive de hanout_orders.status (picked_up/on_the_way).
      // 'picking_up' (le livreur part chercher la commande) n'a pas d'équivalent
      // côté commande : à ce stade la commande est déjà 'ready' (le dispatch ne se
      // déclenche qu'une fois la commande prête) — la mapper vers 'confirmed'
      // faisait régresser son statut en arrière.
      const orderStatusMap = {
        picked_up:   'picked_up',
        on_the_way:  'on_the_way',
        delivered:   'delivered',
        failed:      'cancelled',
      };
      const OrderModel = resolveOrderModel(delivery.pos_order_type);
      const order = await OrderModel.findByPk(delivery.order_id);
      if (order) {
        const prevStatus = order.status;
        order.status = orderStatusMap[status] || order.status;
        await order.save();

        // Notifier client et commerce
        if (global.io) {
          const payload = { order_id: order.id, status: order.status };
          global.io.to(`track:${trackingCode(order)}`).emit('order:status', payload);
          global.io.to(`org:${order.organization_id}`).emit('order:status', payload);
        }

        // Notification in-app → client (si connecté). Shim pour hanout : voir
        // orderEngine.notificationShim (NotificationService attend des champs
        // resto — pickup_code/type — qui n'existent pas tels quels sur HanoutOrder).
        require('../../../services/NotificationService')
          .onOrderStatusChanged(notificationShim(order, delivery), order.status)
          .catch(() => {});

        // Notification in-app → commerce (staff) quand la livraison est
        // effectivement terminée — pas besoin de shim ici, seuls
        // organization_id/id/pickup_code (ou order_number) sont lus, présents
        // tels quels sur les deux moteurs.
        if (order.status === 'delivered') {
          require('../../../services/NotificationService')
            .onOrderDeliveredBusiness(order)
            .catch(() => {});
        }

        // Fidélité — uniquement câblée pour le moteur resto aujourd'hui
        // (onOrderDelivered/onOrderCancelledAfterDelivery lisent des champs
        // resto — OrderItem.menu_item_id, etc. — les appeler avec une
        // HanoutOrder interrogerait la mauvaise table par coïncidence d'id).
        // Comportement inchangé : une commande hanout livrée ne créditait déjà
        // aucun point avant ce module ; pas de régression, juste pas (encore)
        // d'extension de la fidélité à ce flux.
        if (!isHanout(delivery)) {
          const { onOrderDelivered, onOrderCancelledAfterDelivery } = require('../loyalty/orderHooks');
          if (order.status === 'delivered') {
            onOrderDelivered(order).catch(() => {});
          } else if (order.status === 'cancelled' && prevStatus === 'delivered') {
            onOrderCancelledAfterDelivery(order, req.user.id).catch(() => {});
          }
        }
      }

      res.json({ ok: true, delivery_status: status });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/delivery/history — historique du livreur (resto + hanout)
// ════════════════════════════════════════════════════════════════════════════
router.get('/history', requireDelivery, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const deliveries = await Delivery.findAll({
      where: { partner_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    const restoIds  = deliveries.filter(d => !isHanout(d)).map(d => d.order_id);
    const hanoutIds = deliveries.filter(d => isHanout(d)).map(d => d.order_id);

    const [restoOrders, hanoutOrders] = await Promise.all([
      restoIds.length ? Order.findAll({
        where: { id: restoIds },
        attributes: ['id', 'pickup_code', 'total_amount', 'guest_name', 'delivery_address', 'delivery_lat', 'delivery_lng', 'created_at'],
        include: [{ model: Organization, as: 'organization', attributes: ['name', 'slug', 'latitude', 'longitude'] }],
      }) : [],
      hanoutIds.length ? HanoutOrder.findAll({
        where: { id: hanoutIds },
        attributes: ['id', 'order_number', 'total', 'customer_name', 'delivery_address', 'delivery_lat', 'delivery_lng', 'createdAt'],
        include: [{ model: Organization, as: 'organization', attributes: ['name', 'slug', 'latitude', 'longitude'] }],
      }) : [],
    ]);
    const restoMap  = new Map(restoOrders.map(o => [o.id, o]));
    const hanoutMap = new Map(hanoutOrders.map(o => [o.id, o]));

    const today_summary = { count: 0, completed: 0, earnings: 0 };
    const history = deliveries.map(d => {
      const order = isHanout(d) ? hanoutMap.get(d.order_id) : restoMap.get(d.order_id);
      const isToday = d.createdAt?.toISOString()?.slice(0, 10) === today;
      if (isToday) {
        today_summary.count += 1;
        if (d.status === 'delivered') today_summary.completed += 1;
        today_summary.earnings += Number(d.fee || 0);
      }
      return {
        delivery_id:      d.id,
        order_id:         order?.id,
        pickup_code:      order ? trackingCode(order) : null,
        status:           d.status,
        fee:              Number(d.fee),
        restaurant_name:  order?.organization?.name,
        delivery_address: order?.delivery_address,
        delivery_lat:     order?.delivery_lat != null ? Number(order.delivery_lat) : null,
        delivery_lng:     order?.delivery_lng != null ? Number(order.delivery_lng) : null,
        restaurant_lat:   order?.organization?.latitude  != null ? Number(order.organization.latitude)  : null,
        restaurant_lng:   order?.organization?.longitude != null ? Number(order.organization.longitude) : null,
        guest_name:       order ? guestName(order) : null,
        delivered_at:     d.delivered_at,
        created_at:       d.createdAt,
      };
    });

    res.json({
      history,
      today_summary: {
        count: today_summary.count,
        completed: today_summary.completed,
        earnings: Math.round(today_summary.earnings * 100) / 100,
      }
    });
  } catch (e) { next(e); }
});

module.exports = router;
