'use strict';

/**
 * expiryJob — purge automatique des notifications expirées (Notification
 * Center Phase 1). Poller in-process, même convention que
 * delivery/services/documentExpiryJob.js et infra/poller.js — pas de
 * queue/cron externe.
 */

const { Op } = require('sequelize');
const { Notification } = require('../../../models');

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 4x/jour suffit pour une expiration en jours

async function runCheck() {
  try {
    const [count] = await Notification.update(
      { status: 'archived' },
      { where: { expires_at: { [Op.not]: null, [Op.lt]: new Date() }, status: { [Op.ne]: 'archived' } } }
    );
    if (count) console.log(`[notifications/expiryJob] ${count} notification(s) expirée(s) archivée(s)`);
  } catch (e) {
    console.error('[notifications/expiryJob] error:', e.message);
  }
}

let interval = null;
function start() {
  if (interval) return;
  runCheck().catch(() => {});
  interval = setInterval(runCheck, CHECK_INTERVAL_MS);
}

module.exports = { start, runCheck };
