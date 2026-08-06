'use strict';

/**
 * Programme Fidélité — administration SuperAdmin du moteur de fidélité
 * hiérarchique (global → catégorie → commerce). Monté sous /api/admin/loyalty,
 * réservé au SuperAdmin.
 *
 * Routes :
 *   GET  /overview                    — KPIs (participants, points/cashback distribués, tops)
 *   GET  /global-rule                 — règle globale active
 *   PUT  /global-rule                 — définir la règle globale (supersède l'ancienne)
 *   GET  /category-rules              — grille des règles par catégorie
 *   PUT  /category-rules/:businessType — définir la règle d'une catégorie
 *   GET  /limits                      — bornes globales (max cashback%, min/max points_rate, ...)
 *   PUT  /limits                      — modifier les bornes
 *   GET  /pending                     — file d'approbation (règles commerçant en attente), paginée
 *   POST /pending/:ruleId/approve     — approuver une règle commerçant
 *   POST /pending/:ruleId/reject      — refuser une règle commerçant (motif requis)
 */

const express = require('express');
const router = express.Router();
const { Op, QueryTypes } = require('sequelize');
const { body, param, query } = require('express-validator');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const {
  sequelize, LoyaltyRule, BusinessLoyaltySettings, LoyaltyGlobalLimits,
  Organization, Business,
} = require('../../../models');
const NotificationService = require('../../../services/NotificationService');
const { logRuleAudit } = require('../loyalty/ruleAuditService');

const BUSINESS_TYPES = ['restaurant', 'cafe', 'cantine', 'hanout', 'boulangerie', 'patisserie', 'boucherie', 'pharmacie', 'autre'];

router.use(requireAuth, requireSuperAdmin);

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ruleFieldValidators = [
  body('points_rate').isFloat({ min: 0.01 }).withMessage('points_rate doit être > 0'),
  body('cashback_pct').optional().isFloat({ min: 0, max: 100 }),
  body('min_order_amount').optional().isFloat({ min: 0 }),
  body('excluded_products').optional().isArray(),
  body('excluded_categories').optional().isArray(),
  body('monthly_budget_cap').optional({ nullable: true }).isFloat({ min: 0 }),
  body('valid_from').optional({ nullable: true }).isISO8601(),
  body('valid_until').optional({ nullable: true }).isISO8601(),
];

function ruleFieldsFromBody(body) {
  return {
    points_rate: body.points_rate,
    cashback_pct: body.cashback_pct ?? 0,
    min_order_amount: body.min_order_amount ?? 0,
    excluded_products: body.excluded_products ?? null,
    excluded_categories: body.excluded_categories ?? null,
    monthly_budget_cap: body.monthly_budget_cap ?? null,
    valid_from: body.valid_from ?? null,
    valid_until: body.valid_until ?? null,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// VUE D'ENSEMBLE
// ════════════════════════════════════════════════════════════════════════════

router.get('/overview', ah(async (req, res) => {
  const [totalBusinesses, modeCounts, pointsThisMonth, cashbackThisMonth, topBusinesses, topCustomers] = await Promise.all([
    Business.count(),
    sequelize.query(
      `SELECT COALESCE(bls.mode, 'default') as mode, COUNT(*) as cnt
       FROM businesses b LEFT JOIN business_loyalty_settings bls ON bls.organization_id = b.organization_id
       GROUP BY COALESCE(bls.mode, 'default')`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COALESCE(SUM(points),0) as total FROM loyalty_transactions WHERE type='earn' AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM cashback_transactions WHERE type='earn' AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT o.id, o.name, o.slug, COALESCE(SUM(ct.amount),0) as cashback_distributed
       FROM cashback_transactions ct JOIN organizations o ON o.id = ct.organization_id
       WHERE ct.type='earn' GROUP BY o.id ORDER BY cashback_distributed DESC LIMIT 10`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT u.id, u.nom, COALESCE(SUM(lt.points),0) as points_earned
       FROM loyalty_transactions lt JOIN users u ON u.id = lt.user_id
       WHERE lt.type='earn' GROUP BY u.id ORDER BY points_earned DESC LIMIT 10`,
      { type: QueryTypes.SELECT }
    ),
  ]);

  const modes = { none: 0, default: 0, custom: 0 };
  for (const row of modeCounts) modes[row.mode] = Number(row.cnt);
  const participating = modes.default + modes.custom;

  res.json({
    total_businesses: totalBusinesses,
    participating_count: participating,
    non_participating_count: modes.none,
    modes,
    points_distributed_this_month: Number(pointsThisMonth[0].total),
    cashback_distributed_this_month: Number(cashbackThisMonth[0].total),
    top_businesses: topBusinesses.map(r => ({ ...r, cashback_distributed: Number(r.cashback_distributed) })),
    top_customers: topCustomers.map(r => ({ ...r, points_earned: Number(r.points_earned) })),
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// RÈGLE GLOBALE
// ════════════════════════════════════════════════════════════════════════════

router.get('/global-rule', ah(async (req, res) => {
  const rule = await LoyaltyRule.findOne({ where: { scope: 'global', status: 'active' } });
  res.json({ rule });
}));

router.put('/global-rule', ruleFieldValidators, validate, ah(async (req, res) => {
  const t = await sequelize.transaction();
  try {
    await LoyaltyRule.update(
      { status: 'draft' },
      { where: { scope: 'global', status: 'active' }, transaction: t }
    );
    const rule = await LoyaltyRule.create({
      scope: 'global', status: 'active', created_by: req.user.id,
      ...ruleFieldsFromBody(req.body),
    }, { transaction: t });
    await t.commit();

    logRuleAudit({
      user_id: req.user.id, user_name: req.user.nom, action: 'rule_updated',
      entity_id: rule.id, details: { scope: 'global', new_value: ruleFieldsFromBody(req.body) },
    });
    res.status(201).json({ ok: true, rule });
  } catch (e) { await t.rollback(); throw e; }
}));

// ════════════════════════════════════════════════════════════════════════════
// RÈGLES PAR CATÉGORIE
// ════════════════════════════════════════════════════════════════════════════

router.get('/category-rules', ah(async (req, res) => {
  const rules = await LoyaltyRule.findAll({ where: { scope: 'category', status: 'active' } });
  const byType = Object.fromEntries(rules.map(r => [r.business_type, r]));
  res.json({ business_types: BUSINESS_TYPES, rules: byType });
}));

router.put('/category-rules/:businessType',
  [param('businessType').isIn(BUSINESS_TYPES), ...ruleFieldValidators],
  validate,
  ah(async (req, res) => {
    const businessType = req.params.businessType;
    const t = await sequelize.transaction();
    try {
      await LoyaltyRule.update(
        { status: 'draft' },
        { where: { scope: 'category', business_type: businessType, status: 'active' }, transaction: t }
      );
      const rule = await LoyaltyRule.create({
        scope: 'category', business_type: businessType, status: 'active', created_by: req.user.id,
        ...ruleFieldsFromBody(req.body),
      }, { transaction: t });
      await t.commit();

      logRuleAudit({
        user_id: req.user.id, user_name: req.user.nom, action: 'rule_updated',
        entity_id: rule.id, details: { scope: 'category', business_type: businessType, new_value: ruleFieldsFromBody(req.body) },
      });
      res.status(201).json({ ok: true, rule });
    } catch (e) { await t.rollback(); throw e; }
  })
);

// ════════════════════════════════════════════════════════════════════════════
// LIMITES GLOBALES
// ════════════════════════════════════════════════════════════════════════════

router.get('/limits', ah(async (req, res) => {
  const limits = await LoyaltyGlobalLimits.findByPk(1);
  res.json({ limits });
}));

router.put('/limits', [
  body('max_cashback_pct').isFloat({ min: 0, max: 100 }),
  body('min_points_rate').isFloat({ min: 0.01 }),
  body('max_points_rate').isFloat({ min: 0.01 }),
  body('max_monthly_budget_cap').isFloat({ min: 0 }),
  body('max_expiration_days').isInt({ min: 1 }),
], validate, ah(async (req, res) => {
  const limits = await LoyaltyGlobalLimits.findByPk(1);
  const oldValue = limits.toJSON();
  const { max_cashback_pct, min_points_rate, max_points_rate, max_monthly_budget_cap, max_expiration_days } = req.body;
  await limits.update({
    max_cashback_pct, min_points_rate, max_points_rate, max_monthly_budget_cap, max_expiration_days,
    updated_by: req.user.id,
  });

  logRuleAudit({
    user_id: req.user.id, user_name: req.user.nom, action: 'limits_updated',
    entity_id: limits.id, details: { old_value: oldValue, new_value: req.body },
  });
  res.json({ ok: true, limits });
}));

// ════════════════════════════════════════════════════════════════════════════
// APPROBATION DES RÈGLES COMMERÇANT
// ════════════════════════════════════════════════════════════════════════════

router.get('/pending', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validate, ah(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Number(req.query.limit || 20));
  const offset = (page - 1) * limit;

  const { count, rows } = await LoyaltyRule.findAndCountAll({
    where: { scope: 'business', status: 'pending' },
    include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'slug'] }],
    order: [['created_at', 'ASC']],
    limit, offset,
  });

  res.json({ rules: rows, total: count, page, pages: Math.ceil(count / limit) });
}));

router.post('/pending/:ruleId/approve',
  [param('ruleId').isInt({ min: 1 }), body('comment').optional().trim().isLength({ max: 1000 })],
  validate,
  ah(async (req, res) => {
    const rule = await LoyaltyRule.findOne({ where: { id: req.params.ruleId, scope: 'business', status: 'pending' } });
    if (!rule) return res.status(404).json({ error: 'Règle introuvable ou déjà traitée' });

    const t = await sequelize.transaction();
    try {
      await rule.update({ status: 'approved', reviewed_by: req.user.id, reviewed_at: new Date() }, { transaction: t });
      const [settings] = await BusinessLoyaltySettings.findOrCreate({
        where: { organization_id: rule.organization_id },
        defaults: { mode: 'custom', active_rule_id: rule.id },
        transaction: t,
      });
      await settings.update({ mode: 'custom', active_rule_id: rule.id }, { transaction: t });
      await t.commit();
    } catch (e) { await t.rollback(); throw e; }

    logRuleAudit({
      organization_id: rule.organization_id, user_id: req.user.id, user_name: req.user.nom,
      action: 'rule_approved', entity_id: rule.id, details: { comment: req.body.comment || null },
    });

    const owner = await require('../../../models').User.findOne({ where: { organization_id: rule.organization_id, actif: true } });
    if (owner) {
      NotificationService.create({
        recipient_id: owner.id, organization_id: rule.organization_id,
        type: 'LOYALTY_RULE_APPROVED', entity_type: 'SYSTEM', priority: 'normal',
        title: '✅ Votre règle de fidélité personnalisée est approuvée',
        message: 'Votre programme de fidélité personnalisé est maintenant actif.',
        data: { rule_id: rule.id },
      }).catch(() => {});
    }

    res.json({ ok: true, rule });
  })
);

router.post('/pending/:ruleId/reject',
  [param('ruleId').isInt({ min: 1 }), body('reason').trim().notEmpty().withMessage('Un motif de refus est requis').isLength({ max: 1000 })],
  validate,
  ah(async (req, res) => {
    const rule = await LoyaltyRule.findOne({ where: { id: req.params.ruleId, scope: 'business', status: 'pending' } });
    if (!rule) return res.status(404).json({ error: 'Règle introuvable ou déjà traitée' });

    await rule.update({ status: 'rejected', reviewed_by: req.user.id, reviewed_at: new Date(), rejection_reason: req.body.reason });

    logRuleAudit({
      organization_id: rule.organization_id, user_id: req.user.id, user_name: req.user.nom,
      action: 'rule_rejected', entity_id: rule.id, details: { reason: req.body.reason },
    });

    const owner = await require('../../../models').User.findOne({ where: { organization_id: rule.organization_id, actif: true } });
    if (owner) {
      NotificationService.create({
        recipient_id: owner.id, organization_id: rule.organization_id,
        type: 'LOYALTY_RULE_REJECTED', entity_type: 'SYSTEM', priority: 'normal',
        title: '❌ Votre règle de fidélité personnalisée a été refusée',
        message: `Motif : ${req.body.reason}`,
        data: { rule_id: rule.id },
      }).catch(() => {});
    }

    res.json({ ok: true, rule });
  })
);

module.exports = router;
