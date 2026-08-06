'use strict';

/**
 * Point d'entrée unique pour créditer points + cashback à la remise d'une
 * commande resto (Order), utilisé par orders/routes.js et deliveryRoutes.js.
 * Calcule le montant éligible (hors produits/catégories exclus par la règle
 * résolue) avant de créditer, pour que les exclusions configurées par le
 * commerçant s'appliquent aussi hors POS.
 */

const { OrderItem, MenuItem } = require('../../../models');
const { resolveLoyaltyRule } = require('./ruleEngine');
const { computeEligibleAmount } = require('./eligibility');
const { creditOrderPoints } = require('../marketplace/loyaltyService');
const { creditOrderCashback } = require('./cashbackEarnService');
const { reverseOrderLoyalty } = require('./reversalService');

async function eligibleAmountForOrder(order, rule) {
  if (!rule.enabled || (!rule.excluded_products.length && !rule.excluded_categories.length)) {
    return Number(order.total_amount);
  }
  const items = await OrderItem.findAll({
    where: { order_id: order.id },
    include: [{ model: MenuItem, as: 'menu_item', attributes: ['id', 'category_id'] }],
  });
  return computeEligibleAmount(
    items.map(it => ({
      product_id: it.menu_item_id,
      category_id: it.menu_item?.category_id ?? null,
      line_total: Number(it.unit_price) * it.quantity,
    })),
    rule, order.total_amount
  );
}

// Appelé quand une commande resto passe en 'delivered' (staff ou livreur).
async function onOrderDelivered(order) {
  if (!order.user_id) return;
  const rule = await resolveLoyaltyRule(order.organization_id);
  const eligibleAmount = await eligibleAmountForOrder(order, rule);
  await Promise.all([
    creditOrderPoints(order.user_id, order.organization_id, order.id, eligibleAmount, 'order'),
    creditOrderCashback(order.user_id, order.organization_id, order.id, 'order', eligibleAmount),
  ]);
}

// Appelé quand une commande resto passe en 'cancelled' après avoir déjà été 'delivered'.
async function onOrderCancelledAfterDelivery(order, actorUserId) {
  await reverseOrderLoyalty(order.id, order.organization_id, 'order', { reason: 'order_cancelled', actorUserId });
}

module.exports = { onOrderDelivered, onOrderCancelledAfterDelivery };
