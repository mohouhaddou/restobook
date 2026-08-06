'use strict';

const { fn, col } = require('sequelize');
const { Business, Review, Organization } = require('../../../models');

function emptyDistribution() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

async function recomputeBusinessReviewStats(businessId, options = {}) {
  if (!businessId) return null;

  const rows = await Review.findAll({
    where: { business_id: businessId, status: 'published' },
    attributes: ['rating', [fn('COUNT', col('review.id')), 'count']],
    group: ['rating'],
    raw: true,
    transaction: options.transaction,
  });

  const distribution = emptyDistribution();
  let total = 0;
  let sum = 0;

  for (const row of rows) {
    const rating = Number(row.rating);
    const count = Number(row.count || 0);
    if (rating >= 1 && rating <= 5) {
      distribution[rating] = count;
      total += count;
      sum += rating * count;
    }
  }

  const avg = total > 0 ? Math.round((sum / total) * 100) / 100 : 0;

  const business = await Business.findByPk(businessId, { transaction: options.transaction });
  if (!business) return null;

  await business.update({
    avg_rating: avg,
    total_reviews: total,
    rating_distribution: distribution,
  }, { transaction: options.transaction });

  if (business.organization_id) {
    await Organization.update({
      avg_rating: avg,
      total_reviews: total,
    }, {
      where: { id: business.organization_id },
      transaction: options.transaction,
    });
  }

  return { avg_rating: avg, total_reviews: total, rating_distribution: distribution };
}

module.exports = { emptyDistribution, recomputeBusinessReviewStats };
