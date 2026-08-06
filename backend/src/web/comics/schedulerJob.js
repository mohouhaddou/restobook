'use strict';
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../../models');

let timer;
async function sweep() {
  const due = await sequelize.query("SELECT id FROM comic_series WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()", { type: QueryTypes.SELECT });
  for (const row of due) {
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query("UPDATE comic_series SET status='published',published_at=COALESCE(published_at,NOW()),scheduled_at=NULL,updated_at=NOW() WHERE id=:id AND status='scheduled'", { replacements:{id:row.id}, transaction });
      await sequelize.query("UPDATE comic_episodes SET status='published',published_at=COALESCE(published_at,NOW()),scheduled_at=NULL,updated_at=NOW() WHERE series_id=:id", { replacements:{id:row.id}, transaction });
      await transaction.commit();
    } catch (error) { await transaction.rollback(); console.error('[comics.scheduler]', error.message); }
  }
}
function start() {
  if (timer) return;
  sweep().catch(error => console.error('[comics.scheduler]', error.message));
  timer = setInterval(() => sweep().catch(error => console.error('[comics.scheduler]', error.message)), 30000);
  timer.unref?.();
}
module.exports = { start, sweep };
