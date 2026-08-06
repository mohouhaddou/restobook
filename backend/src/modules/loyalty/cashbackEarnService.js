'use strict';

/**
 * Gain de cashback à la commande — symétrique de creditOrderPoints
 * (backend/src/modules/marketplace/loyaltyService.js) mais pour le cashback,
 * qui jusqu'ici ne savait que se DÉPENSER (voir pos/service.js createPosSale)
 * jamais se GAGNER. Idempotent par (order_id, pos_order_type, type='earn').
 */

const { QueryTypes } = require('sequelize');
const { sequelize, CashbackAccount, CashbackTransaction } = require('../../../models');
const NotificationService = require('../../../services/NotificationService');
const { resolveLoyaltyRule } = require('./ruleEngine');
const { isUnderDailyEarnCap } = require('./antiFraud');
const { logRuleAudit } = require('./ruleAuditService');

async function monthlyDistributedCashback(orgId, opts) {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(amount),0) as total FROM cashback_transactions
     WHERE organization_id=? AND type='earn' AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
    { replacements: [orgId], type: QueryTypes.SELECT, ...opts }
  );
  return Number(row.total);
}

/**
 * @param {number} userId
 * @param {number} orgId
 * @param {number|null} orderId - id réel (orders.id ou hanout_orders.id selon posOrderType)
 * @param {'order'|'hanout_order'|null} posOrderType
 * @param {number} eligibleAmount - montant déjà net des exclusions (voir eligibility.js)
 * @param {import('sequelize').Transaction|null} t
 */
async function creditOrderCashback(userId, orgId, orderId, posOrderType, eligibleAmount, t = null) {
  if (!userId || !eligibleAmount || eligibleAmount <= 0) return null;
  const opts = t ? { transaction: t } : {};

  const rule = await resolveLoyaltyRule(orgId);
  if (!rule.enabled || rule.cashback_pct <= 0) return null;
  if (eligibleAmount < rule.min_order_amount) return null;

  if (orderId != null) {
    const already = await sequelize.query(
      `SELECT id FROM cashback_transactions WHERE order_id=? AND pos_order_type <=> ? AND type='earn' LIMIT 1`,
      { replacements: [orderId, posOrderType], type: QueryTypes.SELECT, ...opts }
    );
    if (already.length) return null;
  }

  if (!(await isUnderDailyEarnCap(userId))) {
    await logRuleAudit({ organization_id: orgId, user_id: userId, action: 'earn_blocked_fraud', details: { reason: 'daily_cap', order_id: orderId } });
    return null;
  }

  if (rule.monthly_budget_cap) {
    const spent = await monthlyDistributedCashback(orgId, opts);
    if (spent >= rule.monthly_budget_cap) {
      await logRuleAudit({ organization_id: orgId, action: 'earn_blocked_fraud', details: { reason: 'monthly_budget_cap', spent, cap: rule.monthly_budget_cap, order_id: orderId } });
      return null;
    }
  }

  const cashbackAmount = Number((eligibleAmount * rule.cashback_pct / 100).toFixed(2));
  if (cashbackAmount <= 0) return null;

  const [acct] = await CashbackAccount.findOrCreate({
    where: { user_id: userId }, defaults: { balance: 0, total_earned: 0, total_used: 0 }, ...opts,
  });
  const newBalance = Number((Number(acct.balance) + cashbackAmount).toFixed(2));
  await acct.update({
    balance: newBalance,
    total_earned: Number((Number(acct.total_earned) + cashbackAmount).toFixed(2)),
  }, opts);
  await CashbackTransaction.create({
    user_id: userId, organization_id: orgId, order_id: orderId, pos_order_type: posOrderType,
    type: 'earn', amount: cashbackAmount, balance_after: newBalance,
    description: `Cashback gagné — commande #${orderId}`,
  }, opts);

  // Fire-and-forget hors transaction (même convention que tous les autres appels
  // NotificationService — dédup/expiration/temps réel/push, voir NotificationService.create).
  NotificationService.create({
    recipient_id: userId, organization_id: orgId,
    type: 'CASHBACK_EARNED', entity_type: 'CASHBACK',
    title: `+${cashbackAmount.toFixed(2)} MAD de cashback gagné`,
    message: `Nouveau solde cashback : ${newBalance.toFixed(2)} MAD.`,
    data: { cashback: cashbackAmount, balance: newBalance, order_id: orderId },
  }).catch(() => {});

  return { cashback: cashbackAmount, balance: newBalance };
}

module.exports = { creditOrderCashback, monthlyDistributedCashback };
