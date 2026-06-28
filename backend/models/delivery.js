'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Delivery extends Model {}

Delivery.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  order_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  partner_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending','assigned','picking_up','picked_up','on_the_way','delivered','failed'),
    defaultValue: 'pending'
  },
  pickup_at:    { type: DataTypes.DATE, allowNull: true },
  delivered_at: { type: DataTypes.DATE, allowNull: true },
  partner_lat:  { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  partner_lng:  { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  distance_km:  { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  fee:          { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  notes:        { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  modelName: 'delivery',
  tableName: 'deliveries',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['order_id'] },
    { fields: ['partner_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Delivery;
