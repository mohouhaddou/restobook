'use strict';

const { InfraAuditLog } = require('../../../../models');

// Clone exact de ruleAuditService.js (loyalty) — fire-and-forget, l'audit ne
// doit jamais faire échouer l'action réelle (redémarrage, sauvegarde, etc.).
async function logInfraAudit({ user_id = null, user_name = null, action, entity_id = null, details = null }) {
  try {
    await InfraAuditLog.create({ user_id, user_name, action, entity_id, details });
  } catch { /* l'audit ne doit jamais faire échouer l'opération principale */ }
}

module.exports = { logInfraAudit };
