'use strict';

// Clone exact de infraAuditService.js / ruleAuditService.js — fire-and-forget,
// l'audit ne doit jamais faire échouer l'action réelle (création/édition/suppression de slide).
const HeroAuditLog = null; // pas de table dédiée en Phase 1 — voir note ci-dessous

/**
 * Phase 1 : les actions SuperAdmin sur les slides sont peu fréquentes et à
 * faible risque comparé aux actions infra (pas de redémarrage de service, pas
 * de sauvegarde) — on journalise via console.log plutôt que d'ajouter une
 * quatrième table d'audit. Facile à faire évoluer vers une vraie table si le
 * besoin de traçabilité apparaît (cloner infra_audit_logs).
 */
async function logHeroAudit({ user_id = null, user_name = null, action, entity_id = null, details = null }) {
  try {
    console.log(`[hero-audit] user=${user_name || user_id || '?'} action=${action} slide=${entity_id}`, details || '');
  } catch { /* l'audit ne doit jamais faire échouer l'opération principale */ }
}

module.exports = { logHeroAudit };
