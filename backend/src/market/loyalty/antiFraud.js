'use strict';

/**
 * Anti-fraude minimal pour le moteur de fidélité (Phase 1) : plafond
 * quotidien d'événements de gain (points + cashback confondus) par
 * utilisateur. Garde applicative simple dans le service de crédit — ce n'est
 * pas un endpoint public, donc pas de middleware express-rate-limit ici.
 * Détection d'anomalies avancée (vélocité, empreinte device, collusion
 * multi-comptes) explicitement hors scope Phase 1.
 */

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../../models');

const DAILY_EARN_EVENT_CAP = 50;

async function dailyEarnEventCount(userId) {
  const [pointsRow] = await sequelize.query(
    `SELECT COUNT(*) as cnt FROM loyalty_transactions WHERE user_id=? AND type='earn' AND created_at >= CURDATE()`,
    { replacements: [userId], type: QueryTypes.SELECT }
  );
  const [cashbackRow] = await sequelize.query(
    `SELECT COUNT(*) as cnt FROM cashback_transactions WHERE user_id=? AND type='earn' AND created_at >= CURDATE()`,
    { replacements: [userId], type: QueryTypes.SELECT }
  );
  return Number(pointsRow.cnt) + Number(cashbackRow.cnt);
}

async function isUnderDailyEarnCap(userId) {
  const count = await dailyEarnEventCount(userId);
  return count < DAILY_EARN_EVENT_CAP;
}

module.exports = { isUnderDailyEarnCap, DAILY_EARN_EVENT_CAP };
