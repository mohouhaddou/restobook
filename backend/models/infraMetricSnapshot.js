'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Historique des métriques pour les graphiques 24h/7j/30j/90j/1an — UNE ligne
// toutes les 5 minutes (voir poller.js, boucle lente), pas à chaque tick
// temps réel de 6s, pour ne pas gonfler la table sur un serveur contraint.
// Purge lazy des lignes >400 jours à chaque tick lent (pas de cron séparé).
class InfraMetricSnapshot extends Model {}

InfraMetricSnapshot.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  captured_at:      { type: DataTypes.DATE, allowNull: false },
  cpu_pct:          { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  mem_pct:          { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  swap_pct:         { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  disk_pct:         { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  load1:            { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  net_rx_bps:       { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  net_tx_bps:       { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  db_size_bytes:    { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  health_score:     { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
  services_online:  { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
  services_total:   { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'infra_metric_snapshots',
  underscored: true,
  timestamps: false,
  indexes: [
    { fields: ['captured_at'] },
  ],
});

module.exports = InfraMetricSnapshot;
