'use strict';

/**
 * GET /api/business/overview?period=today|week|month|quarter
 *
 * Dashboard business unifié — restaurants & cantines.
 * Retourne les 10 indicateurs métier en un seul appel.
 */

const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { requireAuth, requireOrganizationAccess } = require('../middleware/auth');
const { checkFeature } = require('../middleware/subscriptionGuard');
const {
  Organization, Order, OrderItem, MenuItem, Reservation,
  DailyMenu, DailyMenuItem, Review, User,
} = require('../models');

router.use(requireAuth, requireOrganizationAccess, checkFeature('has_advanced_dashboard'));

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodBounds(period) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  let from, to;

  switch (period) {
    case 'today':
      from = new Date(now); from.setHours(0, 0, 0, 0);
      to   = new Date(now); to.setHours(23, 59, 59, 999);
      break;
    case 'week':
      from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0);
      to   = new Date(now); to.setHours(23, 59, 59, 999);
      break;
    case 'quarter':
      from = new Date(now); from.setDate(now.getDate() - 89); from.setHours(0, 0, 0, 0);
      to   = new Date(now); to.setHours(23, 59, 59, 999);
      break;
    case 'month':
    default:
      from = new Date(now); from.setDate(now.getDate() - 29); from.setHours(0, 0, 0, 0);
      to   = new Date(now); to.setHours(23, 59, 59, 999);
      break;
  }

  const prevFrom = new Date(from);
  const prevTo   = new Date(to);
  const diff     = to - from;
  prevFrom.setTime(from.getTime() - diff - 1);
  prevTo.setTime(from.getTime() - 1);

  return { from, to, prevFrom, prevTo, todayStr };
}

function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function round2(n) { return Math.round(n * 100) / 100; }

// ── Recommandations IA (règle-métier) ────────────────────────────────────────

function buildRecommendations({ cancellationRate, avgRating, wasteRate, revenueGrowth, topItems, bottomItems, totalOrders, reservationRate, isCanteen }) {
  const recs = [];

  if (cancellationRate > 25) {
    recs.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Taux d\'annulation élevé',
      text: `${cancellationRate}% des commandes sont annulées. Réduisez les délais de préparation ou proposez une politique d'annulation flexible.`,
    });
  } else if (cancellationRate > 15) {
    recs.push({
      type: 'info',
      icon: '💡',
      title: 'Annulations à surveiller',
      text: `Le taux d'annulation (${cancellationRate}%) mérite attention. Analysez les créneaux horaires concernés.`,
    });
  }

  if (avgRating > 0 && avgRating < 3.5) {
    recs.push({
      type: 'danger',
      icon: '🔴',
      title: 'Satisfaction client critique',
      text: `Note moyenne de ${avgRating}/5. Identifiez les plats et services les moins bien notés et agissez en priorité.`,
    });
  } else if (avgRating >= 4.5) {
    recs.push({
      type: 'success',
      icon: '🌟',
      title: 'Excellente satisfaction',
      text: `Note de ${avgRating}/5 — vos clients sont très satisfaits. Encouragez-les à laisser des avis publics pour attirer de nouveaux clients.`,
    });
  }

  if (wasteRate > 30) {
    recs.push({
      type: 'warning',
      icon: '♻️',
      title: 'Gaspillage alimentaire important',
      text: `Environ ${wasteRate}% de la production est gaspillée. Ajustez les quantités préparées selon les prévisions de demande.`,
    });
  }

  if (revenueGrowth !== null && revenueGrowth < -10) {
    recs.push({
      type: 'danger',
      icon: '📉',
      title: 'Baisse du chiffre d\'affaires',
      text: `Le CA a baissé de ${Math.abs(revenueGrowth)}% par rapport à la période précédente. Envisagez des promotions ou la mise en avant de vos bestsellers.`,
    });
  } else if (revenueGrowth !== null && revenueGrowth > 20) {
    recs.push({
      type: 'success',
      icon: '📈',
      title: 'Forte croissance',
      text: `+${revenueGrowth}% de CA par rapport à la période précédente. Anticipez la demande et renforcez vos stocks.`,
    });
  }

  if (bottomItems.length > 0) {
    const worst = bottomItems.slice(0, 2).map(i => i.libelle).join(', ');
    recs.push({
      type: 'info',
      icon: '🍽️',
      title: 'Plats peu demandés',
      text: `« ${worst} » se vendent peu. Envisagez de les retirer du menu, de les repositionner ou d'en améliorer la présentation.`,
    });
  }

  if (isCanteen && reservationRate < 50) {
    recs.push({
      type: 'info',
      icon: '📣',
      title: 'Taux de réservation faible',
      text: `Seulement ${reservationRate}% de réservation. Relancez vos convives par notification ou rappel automatique.`,
    });
  }

  if (topItems.length > 0) {
    const best = topItems[0].libelle;
    recs.push({
      type: 'success',
      icon: '🏆',
      title: 'Votre bestseller',
      text: `« ${best} » est votre plat le plus demandé. Assurez-vous d'en avoir toujours en stock et mettez-le en avant sur votre menu.`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      type: 'success',
      icon: '✅',
      title: 'Tout est nominal',
      text: 'Vos indicateurs sont dans les normes. Continuez sur cette lancée et optimisez vos pics de fréquentation.',
    });
  }

  return recs.slice(0, 5);
}

// ── Prévisions demande (7 prochains jours) ────────────────────────────────────

async function computeForecast(orgId, isCanteen) {
  const forecast = [];
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const today = new Date();

  for (let i = 1; i <= 7; i++) {
    const target = new Date(today);
    target.setDate(today.getDate() + i);
    const dayOfWeek = target.getDay();

    // Moyenner les 4 dernières occurrences du même jour
    let total = 0;
    let count = 0;
    for (let w = 1; w <= 4; w++) {
      const past = new Date(target);
      past.setDate(target.getDate() - w * 7);
      const pastStr = past.toISOString().slice(0, 10);

      let n;
      if (isCanteen) {
        n = await Reservation.count({
          where: {
            organization_id: orgId,
            date_jour: pastStr,
            status: { [Op.in]: ['confirmed', 'picked'] },
          },
        });
      } else {
        const pastStart = new Date(past); pastStart.setHours(0, 0, 0, 0);
        const pastEnd   = new Date(past); pastEnd.setHours(23, 59, 59, 999);
        n = await Order.count({
          where: {
            organization_id: orgId,
            status: { [Op.notIn]: ['cancelled'] },
            created_at: { [Op.between]: [pastStart, pastEnd] },
          },
        });
      }
      total += n;
      count++;
    }

    const avg = count > 0 ? Math.round(total / count) : 0;
    forecast.push({
      date: target.toISOString().slice(0, 10),
      day:  days[dayOfWeek],
      expected: avg,
    });
  }

  return forecast;
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/business/overview
// ════════════════════════════════════════════════════════════════════════════

router.get('/overview', async (req, res, next) => {
  try {
    const orgId  = req.user.organization_id;
    const period = ['today', 'week', 'month', 'quarter'].includes(req.query.period)
      ? req.query.period : 'month';

    const { from, to, prevFrom, prevTo } = periodBounds(period);

    const org = await Organization.findByPk(orgId, { attributes: ['id', 'name', 'type', 'avg_rating', 'total_reviews'] });
    if (!org) return res.status(404).json({ error: 'Organisation introuvable' });

    const isCanteen = org.type === 'canteen';

    // ── 1 & 2 · CA + Commandes ──────────────────────────────────────────────
    let revenue = 0, prevRevenue = 0;
    let totalOrders = 0, cancelledOrders = 0;
    let prevTotal = 0, prevCancelled = 0;
    let byType = {};
    let byDay = [];

    if (isCanteen) {
      // Mode cantine : on compte les réservations
      const [curr, prev] = await Promise.all([
        Reservation.findAll({
          where: { organization_id: orgId, date_jour: { [Op.between]: [from.toISOString().slice(0,10), to.toISOString().slice(0,10)] } },
          attributes: ['status', [fn('COUNT', col('reservation.id')), 'count']],
          group: ['status'], raw: true,
        }),
        Reservation.findAll({
          where: { organization_id: orgId, date_jour: { [Op.between]: [prevFrom.toISOString().slice(0,10), prevTo.toISOString().slice(0,10)] } },
          attributes: [[fn('COUNT', col('reservation.id')), 'count'], 'status'],
          group: ['status'], raw: true,
        }),
      ]);

      for (const r of curr) {
        const n = Number(r.count);
        totalOrders += n;
        if (r.status === 'cancelled') cancelledOrders += n;
      }
      for (const r of prev) {
        const n = Number(r.count);
        prevTotal += n;
        if (r.status === 'cancelled') prevCancelled += n;
      }

      // CA cantine estimé : nombre de réservations * prix moyen des plats
      const avgPrice = await MenuItem.findOne({
        where: { organization_id: orgId, actif: true },
        attributes: [[fn('AVG', col('prix')), 'avg']],
        raw: true,
      });
      const ticketMoyen = Number(avgPrice?.avg || 0);
      const served = totalOrders - cancelledOrders;
      revenue     = round2(served * ticketMoyen);
      prevRevenue = round2((prevTotal - prevCancelled) * ticketMoyen);

    } else {
      // Mode restaurant : on utilise les commandes
      const [curr, prev, currByDay] = await Promise.all([
        Order.findAll({
          where: { organization_id: orgId, created_at: { [Op.between]: [from, to] } },
          attributes: ['status', 'type', 'total_amount'],
          raw: true,
        }),
        Order.findAll({
          where: { organization_id: orgId, created_at: { [Op.between]: [prevFrom, prevTo] } },
          attributes: ['status', 'total_amount'],
          raw: true,
        }),
        Order.findAll({
          where: {
            organization_id: orgId,
            status: { [Op.notIn]: ['cancelled', 'pending'] },
            created_at: { [Op.between]: [from, to] },
          },
          attributes: [
            [fn('DATE', col('created_at')), 'day'],
            [fn('COUNT', col('id')), 'cnt'],
            [fn('SUM', col('total_amount')), 'rev'],
          ],
          group: [fn('DATE', col('created_at'))],
          order: [[fn('DATE', col('created_at')), 'ASC']],
          raw: true,
        }),
      ]);

      for (const o of curr) {
        totalOrders++;
        if (o.status === 'cancelled') { cancelledOrders++; continue; }
        if (o.status !== 'pending') revenue += Number(o.total_amount || 0);
        byType[o.type] = (byType[o.type] || 0) + 1;
      }
      revenue = round2(revenue);

      for (const o of prev) {
        prevTotal++;
        if (o.status === 'cancelled') { prevCancelled++; continue; }
        prevRevenue += Number(o.total_amount || 0);
      }
      prevRevenue = round2(prevRevenue);

      byDay = currByDay.map(r => ({
        day: r.day,
        orders: Number(r.cnt),
        revenue: round2(Number(r.rev || 0)),
      }));
    }

    const activeOrders       = totalOrders - cancelledOrders;
    const cancellationRate   = pct(cancelledOrders, totalOrders);
    const revenueGrowth      = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
    const avgTicket          = activeOrders > 0 ? round2(revenue / activeOrders) : 0;

    // ── 5 · Taux de réservation ─────────────────────────────────────────────
    let reservationRate = 0;
    if (isCanteen) {
      const activeUsers = await User.count({ where: { organization_id: orgId, actif: true } });
      const periodDays  = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 90;
      const capacity    = activeUsers * periodDays;
      reservationRate   = pct(activeOrders, capacity);
    } else {
      reservationRate = pct(activeOrders, totalOrders);
    }

    // ── 3 & 4 · Plats les plus / moins vendus ──────────────────────────────
    let topItems = [], bottomItems = [];

    if (isCanteen) {
      const itemStats = await Reservation.findAll({
        where: {
          organization_id: orgId,
          date_jour: { [Op.between]: [from.toISOString().slice(0,10), to.toISOString().slice(0,10)] },
          status: { [Op.in]: ['confirmed', 'picked'] },
          menu_item_id: { [Op.ne]: null },
        },
        include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle', 'type', 'prix'] }],
        attributes: [
          'menu_item_id',
          [fn('COUNT', col('reservation.id')), 'qty'],
        ],
        group: ['menu_item_id', 'menu_item.id'],
        order: [[literal('qty'), 'DESC']],
        raw: true, nest: true,
      });
      const mapped = itemStats.map(r => ({
        libelle: r.menu_item?.libelle || '',
        type:    r.menu_item?.type    || '',
        qty:     Number(r.qty || 0),
        revenue: round2(Number(r.qty || 0) * Number(r.menu_item?.prix || 0)),
      }));
      topItems    = mapped.slice(0, 5);
      bottomItems = mapped.slice(-5).reverse().filter(i => i.qty > 0);
    } else {
      const itemStats = await OrderItem.findAll({
        include: [{
          model: Order, as: 'order',
          where: {
            organization_id: orgId,
            status: { [Op.notIn]: ['cancelled'] },
            created_at: { [Op.between]: [from, to] },
          },
          attributes: [],
          required: true,
        }, {
          model: MenuItem, as: 'menu_item',
          attributes: ['libelle', 'type'],
        }],
        attributes: [
          'menu_item_id',
          [fn('SUM', col('quantity')), 'qty'],
          [fn('SUM', literal('quantity * unit_price')), 'revenue'],
        ],
        group: ['menu_item_id', 'menu_item.id'],
        order: [[literal('qty'), 'DESC']],
        raw: true, nest: true,
      });
      const mapped = itemStats.map(r => ({
        libelle: r.menu_item?.libelle || '',
        type:    r.menu_item?.type    || '',
        qty:     Number(r.qty || 0),
        revenue: round2(Number(r.revenue || 0)),
      }));
      topItems    = mapped.slice(0, 5);
      bottomItems = mapped.slice(-5).reverse().filter(i => i.qty > 0);
    }

    // ── 7 · Satisfaction ───────────────────────────────────────────────────
    const reviewStats = await Review.findOne({
      where: { organization_id: orgId },
      attributes: [
        [fn('AVG', col('rating')), 'avg'],
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal("CASE WHEN rating = 5 THEN 1 ELSE 0 END")), 'r5'],
        [fn('SUM', literal("CASE WHEN rating = 4 THEN 1 ELSE 0 END")), 'r4'],
        [fn('SUM', literal("CASE WHEN rating = 3 THEN 1 ELSE 0 END")), 'r3'],
        [fn('SUM', literal("CASE WHEN rating <= 2 THEN 1 ELSE 0 END")), 'r_low'],
      ],
      raw: true,
    });
    const avgRating     = reviewStats ? round2(Number(reviewStats.avg || 0)) : 0;
    const totalReviews  = reviewStats ? Number(reviewStats.total || 0) : 0;
    const satisfaction  = {
      avg_rating: avgRating,
      count:      totalReviews,
      distribution: [
        { stars: 5, count: Number(reviewStats?.r5  || 0) },
        { stars: 4, count: Number(reviewStats?.r4  || 0) },
        { stars: 3, count: Number(reviewStats?.r3  || 0) },
        { stars: 2, count: Number(reviewStats?.r_low || 0) },
      ],
    };

    // ── 8 · Estimation du gaspillage ──────────────────────────────────────
    let wasteCount = 0, wasteValue = 0, wasteRate = 0;
    if (isCanteen) {
      // Gaspillage = réservations confirmées non retirées (no-show)
      const noShow = await Reservation.count({
        where: {
          organization_id: orgId,
          date_jour: { [Op.between]: [from.toISOString().slice(0,10), to.toISOString().slice(0,10)] },
          status: 'confirmed',
        },
      });
      const avgPrice = await MenuItem.findOne({
        where: { organization_id: orgId, actif: true },
        attributes: [[fn('AVG', col('prix')), 'avg']], raw: true,
      });
      wasteCount = noShow;
      wasteValue = round2(noShow * Number(avgPrice?.avg || 0));
      wasteRate  = pct(noShow, activeOrders + noShow);
    } else {
      // Gaspillage restaurant = plats préparés mais commandes annulées après confirmation
      const cancelledAfterConfirm = await Order.count({
        where: {
          organization_id: orgId,
          status: 'cancelled',
          created_at: { [Op.between]: [from, to] },
        },
      });
      wasteCount = cancelledAfterConfirm;
      wasteValue = round2(cancelledAfterConfirm * avgTicket);
      wasteRate  = pct(cancelledAfterConfirm, totalOrders);
    }

    // ── 9 · Prévisions simples ─────────────────────────────────────────────
    const forecast = await computeForecast(orgId, isCanteen);

    // ── 10 · Recommandations IA ────────────────────────────────────────────
    const recommendations = buildRecommendations({
      cancellationRate,
      avgRating,
      wasteRate,
      revenueGrowth,
      topItems,
      bottomItems,
      totalOrders,
      reservationRate,
      isCanteen,
    });

    // ── Réponse finale ─────────────────────────────────────────────────────
    res.json({
      period,
      org_name: org.name,
      org_type: org.type,
      is_canteen: isCanteen,

      revenue: {
        total:   revenue,
        prev:    prevRevenue,
        growth:  revenueGrowth,
        avg_ticket: avgTicket,
      },
      orders: {
        total:             totalOrders,
        active:            activeOrders,
        cancelled:         cancelledOrders,
        cancellation_rate: cancellationRate,
        reservation_rate:  reservationRate,
        by_type:           byType,
        by_day:            byDay,
      },
      top_items:    topItems,
      bottom_items: bottomItems,
      satisfaction,
      waste: {
        count:      wasteCount,
        value:      wasteValue,
        rate:       wasteRate,
      },
      forecast,
      recommendations,
    });
  } catch (e) { next(e); }
});

module.exports = router;
