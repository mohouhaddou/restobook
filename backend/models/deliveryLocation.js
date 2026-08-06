'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Dernière position connue d'un livreur — une seule ligne par livreur (upsert
// à chaque ping GPS). L'historique complet des positions vit dans
// delivery_tracking (introduit en Phase 2), cette table ne sert qu'au lookup
// rapide "où est ce livreur maintenant" pour la carte/dispatch.
class DeliveryLocation extends Model {}

DeliveryLocation.init({
  id:                 { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  delivery_person_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  lat:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  lng:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  speed_kmh:   { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  heading_deg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  accuracy_m:  { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  recorded_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'delivery_location',
  tableName: 'delivery_locations',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['delivery_person_id'] },
  ]
});

module.exports = DeliveryLocation;
