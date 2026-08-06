'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Journal sécurité/dispatch (ex: anomalie GPS, scoring de dispatch, échec
// d'authentification socket) — distinct de delivery_status_history qui ne
// couvre que les transitions de statut métier.
class DeliveryLog extends Model {}

DeliveryLog.init({
  id:                 { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  delivery_person_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  assignment_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  event_type:         { type: DataTypes.STRING(64), allowNull: false },
  payload:            { type: DataTypes.JSON, allowNull: true },
}, {
  sequelize,
  modelName: 'delivery_log',
  tableName: 'delivery_logs',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['event_type', 'created_at'] },
    { fields: ['delivery_person_id', 'created_at'] },
  ]
});

module.exports = DeliveryLog;
