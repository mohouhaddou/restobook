'use strict';

/**
 * statusHistoryService — audit append-only de chaque transition de statut
 * d'une livraison (delivery_status_history). Best-effort : ne doit jamais
 * faire échouer le flux appelant, comme les autres hooks de ce module
 * (voir orderHooks.js, NotificationService — tous appelés en ".catch(()=>{})").
 */

const { DeliveryStatusHistory } = require('../../../../models');

async function recordTransition(assignmentId, { from = null, to, userId = null, role = null, lat = null, lng = null, reason = null }) {
  try {
    await DeliveryStatusHistory.create({
      assignment_id: assignmentId,
      from_status: from,
      to_status: to,
      changed_by_user_id: userId,
      changed_by_role: role,
      lat, lng, reason,
    });
  } catch { /* audit non bloquant */ }
}

module.exports = { recordTransition };
