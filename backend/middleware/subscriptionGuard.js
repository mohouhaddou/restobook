'use strict';
/**
 * Subscription Guard Middleware
 * Vérifie les droits d'accès selon le plan de l'organisation.
 */
const { UserSubscription, SubscriptionPlan, Order, User, Organization } = require('../models');
const { Op } = require('sequelize');

/* ── Cache court (60 s) pour éviter les requêtes répétées ── */
const cache = new Map();
const CACHE_TTL = 60_000;

async function getOrgSubscription(orgId) {
  const now = Date.now();
  const cached = cache.get(orgId);
  if (cached && now - cached.ts < CACHE_TTL) return cached.data;

  let sub = await UserSubscription.findOne({
    where: { organization_id: orgId, status: { [Op.in]: ['active', 'trial'] } },
    include: [{ model: SubscriptionPlan, as: 'plan' }],
    order: [['created_at', 'DESC']],
  });

  if (!sub) {
    // Retour au plan Free Demo par défaut
    const freePlan = await SubscriptionPlan.findOne({ where: { slug: 'free_demo' } });
    sub = { plan: freePlan, status: 'virtual', virtual: true };
  }

  cache.set(orgId, { data: sub, ts: now });
  return sub;
}

function invalidateCache(orgId) {
  cache.delete(orgId);
}

/**
 * Vérifie qu'une fonctionnalité est activée pour le plan courant.
 * @param {string} feature - clé booléenne dans SubscriptionPlan
 */
function checkFeature(feature) {
  return async (req, res, next) => {
    try {
      const orgId = req.user?.organization_id;
      if (!orgId || req.user?.role === 'superadmin') return next();

      const sub  = await getOrgSubscription(orgId);
      const plan = sub?.plan;

      if (!plan || !plan[feature]) {
        return res.status(403).json({
          error:        'SUBSCRIPTION_REQUIRED',
          feature,
          message:      `Cette fonctionnalité n'est pas disponible dans votre plan "${plan?.name || 'Free Demo'}". Veuillez mettre à niveau votre abonnement.`,
          current_plan: plan?.slug || 'free_demo',
          upgrade_url:  '/subscription',
        });
      }

      req.subscription = { sub, plan };
      next();
    } catch (err) { next(err); }
  };
}

/**
 * Vérifie une limite numérique du plan.
 * @param {'orders_per_month'|'users'|'restaurants'} limitType
 */
function checkLimit(limitType) {
  return async (req, res, next) => {
    try {
      const orgId = req.user?.organization_id;
      if (!orgId || req.user?.role === 'superadmin') return next();

      const sub  = await getOrgSubscription(orgId);
      const plan = sub?.plan;
      if (!plan) return next();

      if (limitType === 'orders_per_month') {
        const limit = plan.max_orders_per_month;
        if (limit === -1) return next();
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
        const count = await Order.count({ where: { organization_id: orgId, created_at: { [Op.gte]: startOfMonth } } });
        if (count >= limit) {
          return res.status(403).json({
            error: 'LIMIT_REACHED', limit_type: 'orders_per_month',
            message: `Limite de ${limit} commandes/mois atteinte (plan ${plan.name}).`,
            current_count: count, limit, current_plan: plan.slug, upgrade_url: '/subscription',
          });
        }
      }

      if (limitType === 'users') {
        const limit = plan.max_users;
        if (limit === -1) return next();
        const count = await User.count({ where: { organization_id: orgId } });
        if (count >= limit) {
          return res.status(403).json({
            error: 'LIMIT_REACHED', limit_type: 'users',
            message: `Limite de ${limit} utilisateurs atteinte (plan ${plan.name}).`,
            current_count: count, limit, current_plan: plan.slug, upgrade_url: '/subscription',
          });
        }
      }

      req.subscription = { sub, plan };
      next();
    } catch (err) { next(err); }
  };
}

module.exports = { getOrgSubscription, checkFeature, checkLimit, invalidateCache };
