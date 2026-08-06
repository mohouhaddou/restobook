'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Historique complet de trajectoire (append-only, écriture throttlée par
// locationService — voir backend/src/modules/delivery/services/locationService.js).
// delivery_locations ne garde que la dernière position ; cette table sert au
// rejeu de trajet / futures heatmaps / calcul de distance parcourue.
class DeliveryTracking extends Model {}

DeliveryTracking.init({
  id:                 { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  delivery_person_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  assignment_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  lat:         { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  lng:         { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  speed_kmh:   { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  heading_deg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  accuracy_m:  { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  recorded_at: { type: DataTypes.DATE, allowNull: false },
}, {
  sequelize,
  modelName: 'delivery_tracking',
  tableName: 'delivery_tracking',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['delivery_person_id', 'recorded_at'] },
    { fields: ['assignment_id', 'recorded_at'] },
  ]
});

module.exports = DeliveryTracking;
