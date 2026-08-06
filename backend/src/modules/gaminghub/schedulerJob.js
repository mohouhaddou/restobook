'use strict';

/**
 * Planification de publication — gaming_articles.scheduled_at. Poller
 * in-process (pas de nouvelle dépendance cron), même convention que
 * seo/sitemapService.startPeriodicRefresh() / delivery/dispatchEngine.startSweep()
 * démarrés dans backend/index.js. Bascule draft -> published dès que
 * scheduled_at <= now ; auto-réparant si le process redémarre pendant
 * l'attente (pas de timer par article).
 */
const { GamingArticle } = require('../../../models');
const { Op } = require('sequelize');

const INTERVAL_MS = 60 * 1000;
let timer = null;

async function tick() {
  try {
    const due = await GamingArticle.findAll({
      where: { status: 'draft', scheduled_at: { [Op.lte]: new Date(), [Op.ne]: null } },
    });
    for (const article of due) {
      article.status = 'published';
      article.published_at = article.published_at || new Date();
      await article.save();
      console.log(`[gaminghub.scheduler] article #${article.id} (${article.slug}) publié automatiquement`);
    }
  } catch (e) {
    console.error('[gaminghub.scheduler] erreur', e.message);
  }
}

function start() {
  if (timer) return;
  timer = setInterval(tick, INTERVAL_MS);
  tick();
}

module.exports = { start };
