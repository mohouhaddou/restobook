'use strict';

const { sequelize, PlayXp } = require('../../../../models');
const { exec } = require('./repository');
const xpCurve = require('./xpCurve');

const REASSIGN_TABLES = ['play_scores', 'play_user_missions', 'play_user_rewards', 'play_sessions'];

// Fusionne la progression d'un invité dans un compte client à la connexion.
// N'édite jamais le flow de login existant — appelé uniquement depuis
// POST /play/merge-guest (routes.js), déclenché par le frontend.
async function mergeGuestIntoUser(guestId, userId) {
  return sequelize.transaction(async (t) => {
    for (const table of REASSIGN_TABLES) {
      await exec(`UPDATE ${table} SET user_id = :userId, guest_id = NULL WHERE guest_id = :guestId`, { userId, guestId }, t);
    }

    const guestXp = await PlayXp.findOne({ where: { guest_id: guestId }, transaction: t });
    if (!guestXp) return { merged: false };

    const userXp = await PlayXp.findOne({ where: { user_id: userId }, transaction: t });
    if (userXp) {
      const mergedTotalXp = userXp.total_xp + guestXp.total_xp;
      const level = await xpCurve.levelForXp(mergedTotalXp);
      await userXp.update({
        total_xp: mergedTotalXp,
        current_level: level.level_number,
        icoins_balance: userXp.icoins_balance + guestXp.icoins_balance,
        icoins_lifetime: userXp.icoins_lifetime + guestXp.icoins_lifetime,
        current_streak_days: Math.max(userXp.current_streak_days, guestXp.current_streak_days),
        longest_streak_days: Math.max(userXp.longest_streak_days, guestXp.longest_streak_days),
      }, { transaction: t });
      await guestXp.destroy({ transaction: t });
    } else {
      await guestXp.update({ user_id: userId, guest_id: null }, { transaction: t });
    }

    // play_user_badges : contrainte unique (user_id,badge_id) — on ignore les
    // doublons (badge déjà détenu par le compte) plutôt que d'échouer la fusion.
    await exec(
      `INSERT IGNORE INTO play_user_badges (user_id, badge_id, earned_at)
       SELECT :userId, badge_id, earned_at FROM play_user_badges WHERE guest_id = :guestId`,
      { userId, guestId }, t
    );
    await exec('DELETE FROM play_user_badges WHERE guest_id = :guestId', { guestId }, t);

    return { merged: true };
  });
}

module.exports = { mergeGuestIntoUser };
