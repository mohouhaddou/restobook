'use strict';

// Même convention que heroAuditService.js : fire-and-forget, console-log,
// l'audit ne doit jamais faire échouer l'action SuperAdmin réelle.
async function logAdAudit({ user_id = null, user_name = null, action, entity_id = null, details = null }) {
  try {
    console.log(`[ads-audit] user=${user_name || user_id || '?'} action=${action} campaign=${entity_id}`, details || '');
  } catch { /* l'audit ne doit jamais faire échouer l'opération principale */ }
}

module.exports = { logAdAudit };
