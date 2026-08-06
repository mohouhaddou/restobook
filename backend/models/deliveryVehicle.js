'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Véhicule d'un livreur. `is_active` distingue le véhicule courant si un
// livreur en a déclaré plusieurs au fil du temps (changement de moto, etc.) —
// convention applicative (un seul actif à la fois), pas de contrainte DB.
class DeliveryVehicle extends Model {}

DeliveryVehicle.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  delivery_person_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: {
    type: DataTypes.ENUM('foot', 'bike', 'scooter', 'moto', 'car', 'van'),
    allowNull: false,
  },
  brand:            { type: DataTypes.STRING(100), allowNull: true },
  plate_number:     { type: DataTypes.STRING(32), allowNull: true },
  capacity_l:       { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  max_weight_kg:    { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  fuel_consumption: { type: DataTypes.STRING(64), allowNull: true },
  photo_url:        { type: DataTypes.STRING(500), allowNull: true },
  is_active:        { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'delivery_vehicle',
  tableName: 'delivery_vehicles',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['delivery_person_id'] },
  ]
});

module.exports = DeliveryVehicle;
