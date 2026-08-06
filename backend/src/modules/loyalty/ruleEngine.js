'use strict';

/**
 * Résolution hiérarchique des règles de fidélité — SuperAdmin global →
 * catégorie de commerce → commerce (mode 'custom' avec règle approuvée).
 *
 * Ordre de résolution pour un organization_id donné :
 *   1. business_loyalty_settings.mode === 'none'      → désactivé partout.
 *   2. mode === 'custom' + active_rule_id approuvée
 *      et dans sa fenêtre de validité                 → cette règle.
 *      (règle absente/expirée/non approuvée → on continue, bascule silencieuse)
 *   3. règle de catégorie active pour le business_type → cette règle.
 *   4. règle globale active                            → cette règle.
 *   5. rien configuré                                  → désactivé.
 *
 * Le multiplicateur de tier existant (backend/src/shared/config/loyaltyTiers.js,
 * bonus_rate 1.0→2.0) continue de s'appliquer PAR-DESSUS le taux résolu ici —
 * ce module ne remplace que la base "1 MAD = 1 point" codée en dur jusqu'ici.
 */

const { Business, LoyaltyRule, BusinessLoyaltySettings } = require('../../../models');

function withinValidity(rule) {
  const today = new Date().toISOString().slice(0, 10);
  if (rule.valid_from && today < rule.valid_from) return false;
  if (rule.valid_until && today > rule.valid_until) return false;
  return true;
}

function toResolved(rule, source) {
  return {
    enabled: true,
    source, // 'business' | 'category' | 'global'
    rule_id: rule.id,
    points_rate: Number(rule.points_rate),
    cashback_pct: Number(rule.cashback_pct),
    min_order_amount: Number(rule.min_order_amount),
    excluded_products: rule.excluded_products || [],
    excluded_categories: rule.excluded_categories || [],
    monthly_budget_cap: rule.monthly_budget_cap !== null ? Number(rule.monthly_budget_cap) : null,
  };
}

const DISABLED = { enabled: false, source: 'none' };

async function resolveLoyaltyRule(organizationId) {
  const settings = await BusinessLoyaltySettings.findOne({ where: { organization_id: organizationId } });
  const mode = settings?.mode || 'default';

  if (mode === 'none') return DISABLED;

  let fallbackApplied = false;

  if (mode === 'custom' && settings.active_rule_id) {
    const custom = await LoyaltyRule.findByPk(settings.active_rule_id);
    if (custom && custom.status === 'approved' && withinValidity(custom)) {
      return toResolved(custom, 'business');
    }
    fallbackApplied = true; // règle custom manquante/expirée/pas encore approuvée
  }

  const business = await Business.findOne({ where: { organization_id: organizationId }, attributes: ['business_type'] });
  if (business?.business_type) {
    const categoryRule = await LoyaltyRule.findOne({
      where: { scope: 'category', business_type: business.business_type, status: 'active' },
    });
    if (categoryRule && withinValidity(categoryRule)) {
      const resolved = toResolved(categoryRule, 'category');
      resolved.fallback_applied = fallbackApplied;
      return resolved;
    }
  }

  const globalRule = await LoyaltyRule.findOne({ where: { scope: 'global', status: 'active' } });
  if (globalRule && withinValidity(globalRule)) {
    const resolved = toResolved(globalRule, 'global');
    resolved.fallback_applied = fallbackApplied;
    return resolved;
  }

  return DISABLED;
}

module.exports = { resolveLoyaltyRule, withinValidity };
