'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { PlayReward, PlayUserReward, PlayXp } = require('../../../../models');
const { whereForPlayer, findOrCreatePlayerXp } = require('./playerService');

async function listRewards({ organizationId = null } = {}) {
  const where = {
    active: true,
    [Op.or]: [{ organization_id: null }, ...(organizationId ? [{ organization_id: organizationId }] : [])],
  };
  return PlayReward.findAll({ where, order: [['sort_order', 'ASC']], raw: true });
}

function generateCouponCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function claimReward(playerRef, rewardId) {
  if (playerRef.isGuest) {
    const err = new Error('Connectez-vous pour réclamer votre récompense');
    err.status = 403;
    throw err;
  }

  const reward = await PlayReward.findOne({ where: { id: rewardId, active: true } });
  if (!reward) throw new Error('Récompense introuvable');
  if (reward.stock != null && reward.used_count >= reward.stock) {
    const err = new Error('Stock épuisé');
    err.status = 409;
    throw err;
  }

  const where = whereForPlayer(playerRef);
  if (reward.max_per_user) {
    const alreadyClaimed = await PlayUserReward.count({ where: { ...where, reward_id: reward.id } });
    if (alreadyClaimed >= reward.max_per_user) {
      const err = new Error('Limite de réclamation atteinte pour cette récompense');
      err.status = 409;
      throw err;
    }
  }

  const xpRow = await findOrCreatePlayerXp(playerRef);
  if (xpRow.icoins_balance < reward.cost_icoins) {
    const err = new Error('iCoins insuffisantes');
    err.status = 400;
    throw err;
  }

  const expiresAt = new Date(Date.now() + reward.valid_days * 24 * 60 * 60 * 1000);
  const userReward = await PlayUserReward.create({
    ...where,
    reward_id: reward.id,
    icoins_spent: reward.cost_icoins,
    coupon_code: generateCouponCode(),
    status: 'active',
    expires_at: expiresAt,
  });

  await xpRow.update({ icoins_balance: xpRow.icoins_balance - reward.cost_icoins });
  await reward.update({ used_count: reward.used_count + 1 });

  return userReward;
}

module.exports = { claimReward, listRewards };
