'use strict';
const router  = require('express').Router();
const { Op }  = require('sequelize');
const { requireAuth, requireRole, orgScope } = require('../../../middleware/auth');
const { getOrgSubscription, invalidateCache } = require('../../../middleware/subscriptionGuard');
const { SubscriptionPlan, UserSubscription, Organization, User, Order } = require('../../../models');

/* ── GET /api/subscriptions/plans ── Public ─────────────────────────── */
router.get('/plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC']],
    });
    res.json({ plans });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/subscriptions/my ── Abonnement courant + usage ─────────── */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    if (!orgId) return res.json({ plan: null, usage: {}, is_superadmin: true });

    const sub  = await getOrgSubscription(orgId);
    const plan = sub?.plan;

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const [ordersMonth, userCount] = await Promise.all([
      Order.count({ where: { organization_id: orgId, created_at: { [Op.gte]: startOfMonth } } }),
      User.count({ where: { organization_id: orgId } }),
    ]);

    res.json({
      subscription: sub?.virtual ? null : sub,
      plan,
      status: sub?.status || 'virtual',
      trial_ends_at: sub?.trial_ends_at || null,
      usage: { orders_this_month: ordersMonth, users: userCount, restaurants: 1 },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/subscriptions/check ── Feature flags pour le frontend ──── */
router.get('/check', requireAuth, async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    if (!orgId || req.user?.role === 'superadmin') {
      return res.json({ superadmin: true, all_features: true, plan: 'enterprise' });
    }
    const sub  = await getOrgSubscription(orgId);
    const plan = sub?.plan;
    res.json({
      plan:      plan?.slug     || 'free_demo',
      plan_name: plan?.name     || 'Free Demo',
      status:    sub?.status    || 'trial',
      trial_ends_at: sub?.trial_ends_at || null,
      features: {
        has_ai_features:        !!plan?.has_ai_features,
        has_exports:            !!plan?.has_exports,
        has_advanced_dashboard: !!plan?.has_advanced_dashboard,
        has_loyalty_module:     !!plan?.has_loyalty_module,
        has_delivery_module:    !!plan?.has_delivery_module,
        has_canteen_module:     !!plan?.has_canteen_module,
        has_nutrition_ai:       !!plan?.has_nutrition_ai,
        has_api_access:         !!plan?.has_api_access,
      },
      limits: {
        max_restaurants:      plan?.max_restaurants      ?? 1,
        max_users:            plan?.max_users            ?? 3,
        max_orders_per_month: plan?.max_orders_per_month ?? 50,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ════════════════════ SUPERADMIN ONLY ════════════════════════════════ */

/* ── GET /api/subscriptions/all ── Liste toutes les souscriptions ──── */
router.get('/all', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const subs = await UserSubscription.findAll({
      include: [
        { model: SubscriptionPlan, as: 'plan' },
        { model: Organization,     as: 'organization', attributes: ['id','name','type'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ subscriptions: subs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── POST /api/subscriptions/assign ── Assigner un plan ─────────────── */
router.post('/assign', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { organization_id, plan_slug, billing_cycle, expires_at, notes } = req.body;
    if (!organization_id || !plan_slug) return res.status(400).json({ error: 'Champs manquants' });

    const plan = await SubscriptionPlan.findOne({ where: { slug: plan_slug } });
    if (!plan) return res.status(404).json({ error: 'Plan introuvable' });

    // Annuler l'abonnement actif
    await UserSubscription.update(
      { status: 'cancelled', cancelled_at: new Date() },
      { where: { organization_id, status: { [Op.in]: ['active','trial'] } } }
    );

    const sub = await UserSubscription.create({
      organization_id, plan_id: plan.id,
      status: 'active', billing_cycle: billing_cycle || 'monthly',
      started_at: new Date(),
      expires_at: expires_at ? new Date(expires_at) : null,
      notes,
    });

    invalidateCache(organization_id);
    res.json({ ok: true, subscription: sub, plan });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PATCH /api/subscriptions/:id/cancel ─────────────────────────────── */
router.patch('/:id/cancel', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const sub = await UserSubscription.findByPk(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Introuvable' });
    await sub.update({ status: 'cancelled', cancelled_at: new Date() });
    invalidateCache(sub.organization_id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PATCH /api/subscriptions/:id ── Modifier un abonnement ─────────── */
router.patch('/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { status, billing_cycle, expires_at, notes } = req.body;
    const sub = await UserSubscription.findByPk(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Introuvable' });
    await sub.update({ status, billing_cycle, expires_at: expires_at ? new Date(expires_at) : undefined, notes });
    invalidateCache(sub.organization_id);
    res.json({ ok: true, subscription: sub });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/subscriptions/plans/:id ── Modifier un plan ────────────── */
router.patch('/plans/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan introuvable' });
    await plan.update(req.body);
    res.json({ ok: true, plan });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
