'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Association many-to-many zone <-> livreur (livreurs affectés à une zone —
// utilisée par le dispatch engine pour restreindre le pool en Phase 3+,
// optionnel : un livreur sans ligne ici reste éligible à toutes les zones).
class DeliveryZoneCourier extends Model {}

DeliveryZoneCourier.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  zone_id:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  delivery_person_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, {
  sequelize,
  modelName: 'delivery_zone_courier',
  tableName: 'delivery_zone_couriers',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { unique: true, fields: ['zone_id', 'delivery_person_id'] },
  ]
});

module.exports = DeliveryZoneCourier;
