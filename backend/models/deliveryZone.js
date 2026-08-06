'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Zone circulaire (centre + rayon) — un polygone réel (colonne `geometry`)
// est prévu pour une évolution future mais non exploité en V1 : un simple
// cercle couvre le cas d'usage réel (tarification/priorité par distance
// autour d'un commerce ou d'un pôle réseau) sans UI de dessin de polygone.
class DeliveryZone extends Model {}

DeliveryZone.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // null = zone réseau (Mode 2)
  name:                { type: DataTypes.STRING(120), allowNull: false },
  color:               { type: DataTypes.STRING(16), allowNull: true },
  center_lat:          { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  center_lng:          { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  radius_km:           { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 5 },
  geometry:            { type: DataTypes.JSON, allowNull: true },
  base_fee:            { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  per_km_fee:          { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  avg_delivery_time_min: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  priority:            { type: DataTypes.INTEGER, defaultValue: 0 },
  time_slots:          { type: DataTypes.JSON, allowNull: true },
  is_active:           { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'delivery_zone',
  tableName: 'delivery_zones',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['is_active'] },
  ]
});

module.exports = DeliveryZone;
