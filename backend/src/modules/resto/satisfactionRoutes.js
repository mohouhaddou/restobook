'use strict';

const express = require('express');
const { query, param } = require('express-validator');
const { Op, fn, col } = require('sequelize');
const validate = require('../../../middleware/validate');
const { requireAuth, requireOrganizationAccess, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const { Review, Order, OrderItem, MenuItem, User } = require('../../../models');
const { analyzeReview, aggregateSatisfaction } = require('../../../services/SatisfactionAIService');

const router = express.Router();

router.use(
  requireAuth,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.RESTAURANT_STATS_VIEW, PERMISSIONS.RESTAURANT_MENU_MANAGE])
);

function dateRange(req) {
  const from = req.query.from ? new Date(String(req.query.from).slice(0, 10)) : new Date(Date.now() - 30 * 86400000);
  const to = req.query.to ? new Date(String(req.query.to).slice(0, 10)) : new Date();
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

async function loadReviews(req) {
  const { from, to } = dateRange(req);
  const reviews = await Review.findAll({
    where: {
      organization_id: req.user.organization_id,
      created_at: { [Op.between]: [from, to] },
    },
    include: [
      { model: Order, as: 'order', attributes: ['id', 'type', 'total_amount', 'guest_name', 'guest_phone'], required: false },
      { model: User, as: 'user', attributes: ['id', 'nom', 'matricule'], required: false },
    ],
    order: [['created_at', 'DESC']],
  });
  return { from, to, reviews };
}

router.get('/dashboard',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const { from, to, reviews } = await loadReviews(req);
      const itemRows = await OrderItem.findAll({
        include: [
          {
            model: Order,
            as: 'order',
            where: { organization_id: req.user.organization_id, created_at: { [Op.between]: [from, to] } },
            attributes: [],
            required: true,
          },
          { model: MenuItem, as: 'menu_item', attributes: ['libelle'], required: false },
        ],
        attributes: [
          'menu_item_id',
          [fn('COUNT', col('order_item.id')), 'orders_count'],
        ],
        group: ['menu_item_id', 'menu_item.id'],
        raw: true,
        nest: true,
      });

      const aggregate = aggregateSatisfaction({
        reviews,
        itemRows: itemRows.map(row => ({
          menu_item_id: row.menu_item_id,
          libelle: row.menu_item?.libelle || 'Plat',
          orders_count: Number(row.orders_count || 0),
        })),
      });

      res.json({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        ...aggregate,
      });
    } catch (e) { next(e); }
  }
);

router.get('/reviews',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const { reviews } = await loadReviews(req);
      res.json({
        reviews: reviews.map(review => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          item_ratings: review.item_ratings || [],
          sentiment: review.sentiment,
          sentiment_score: review.sentiment_score === null ? null : Number(review.sentiment_score),
          issue_tags: review.issue_tags || [],
          ai_summary: review.ai_summary || null,
          created_at: review.createdAt,
          order: review.order || null,
          user: review.user || null,
        })),
      });
    } catch (e) { next(e); }
  }
);

router.post('/reviews/:id/analyze',
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const review = await Review.findOne({ where: { id: req.params.id, organization_id: req.user.organization_id } });
      if (!review) return res.status(404).json({ error: 'Avis introuvable' });
      const analysis = analyzeReview(review);
      review.sentiment = analysis.sentiment;
      review.sentiment_score = analysis.sentiment_score;
      review.issue_tags = analysis.issue_tags;
      review.ai_summary = analysis;
      review.analyzed_at = new Date();
      await review.save();
      res.json({ review, analysis });
    } catch (e) { next(e); }
  }
);

module.exports = router;
