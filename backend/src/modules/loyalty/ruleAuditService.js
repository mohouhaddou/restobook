'use strict';

/**
 * Journal d'audit des règles de fidélité — mirroir de logCreditAudit()
 * (backend/src/modules/hanout/creditLedger.js) : fire-and-forget, l'audit ne
 * doit jamais faire échouer l'opération principale.
 */

const { LoyaltyRuleAuditLog } = require('../../../models');

async function logRuleAudit({ organization_id = null, user_id = null, user_name = null, action, entity_id = null, details = null }) {
  try {
    await LoyaltyRuleAuditLog.create({ organization_id, user_id, user_name, action, entity_id, details });
  } catch { /* l'audit ne doit jamais faire échouer l'opération principale */ }
}

module.exports = { logRuleAudit };
