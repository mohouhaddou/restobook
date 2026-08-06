'use strict';

/**
 * documentExpiryJob — alertes automatiques d'expiration de documents livreur
 * (spec point 20). Poller in-process, même convention que
 * src/modules/infra/poller.js — pas de queue/cron externe, cohérent avec la
 * décision de différer Redis/BullMQ tant que le volume ne l'exige pas.
 */

const { Op } = require('sequelize');
const { DeliveryDocument, DeliveryPerson } = require('../../../../models');

const ALERT_THRESHOLDS_DAYS = [30, 7, 1];
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 2x/jour suffit pour des seuils en jours

function daysUntil(dateStr) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

async function runCheck() {
  try {
    const docs = await DeliveryDocument.findAll({
      where: { expires_at: { [Op.not]: null }, status: { [Op.in]: ['pending', 'verified'] } },
      include: [{ model: DeliveryPerson, as: 'deliveryPerson' }],
    });
    const NotificationService = require('../../../shared/notifications/NotificationService');

    for (const doc of docs) {
      const days = daysUntil(doc.expires_at);

      if (days < 0) {
        if (doc.status !== 'expired') await doc.update({ status: 'expired' });
        continue;
      }
      if (!ALERT_THRESHOLDS_DAYS.includes(days)) continue;

      // Le job tourne 2x/jour — évite de renotifier plusieurs fois le même jour.
      const today = new Date().toISOString().slice(0, 10);
      if (doc.last_expiry_alert_at && new Date(doc.last_expiry_alert_at).toISOString().slice(0, 10) === today) continue;

      await NotificationService.create({
        type: 'DELIVERY_DOC_EXPIRING',
        recipient_id: doc.deliveryPerson?.user_id,
        title: '⏳ Document bientôt expiré',
        message: `Votre document (${doc.type}) expire dans ${days} jour(s). Merci de le renouveler.`,
        entity_type: 'DELIVERY_DOCUMENT', entity_id: doc.id, action_url: '/delivery',
        priority: days <= 1 ? 'urgent' : 'normal',
      }).catch(() => {});
      await doc.update({ last_expiry_alert_at: new Date() });
    }
  } catch (e) {
    console.error('[documentExpiryJob] error:', e.message);
  }
}

let interval = null;
function start() {
  if (interval) return;
  runCheck().catch(() => {});
  interval = setInterval(runCheck, CHECK_INTERVAL_MS);
}

module.exports = { start, runCheck };
