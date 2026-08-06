'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Audit append-only de chaque transition de statut d'une livraison
// (assignment_id = deliveries.id). Alimente les KPI temps-par-statut et
// les enquêtes en cas de litige — jamais modifié après écriture.
class DeliveryStatusHistory extends Model {}

DeliveryStatusHistory.init({
  id:                 { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  assignment_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  from_status:        { type: DataTypes.STRING(24), allowNull: true },
  to_status:          { type: DataTypes.STRING(24), allowNull: false },
  changed_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  changed_by_role:    { type: DataTypes.STRING(32), allowNull: true },
  lat:    { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  lng:    { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  reason: { type: DataTypes.STRING(255), allowNull: true },
}, {
  sequelize,
  modelName: 'delivery_status_history',
  tableName: 'delivery_status_history',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['assignment_id', 'created_at'] },
  ]
});

module.exports = DeliveryStatusHistory;
