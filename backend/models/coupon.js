'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Coupon extends Model {}

Coupon.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  code:            { type: DataTypes.STRING(32), allowNull: false, unique: true },
  type:            { type: DataTypes.ENUM('percent', 'fixed'), allowNull: false, defaultValue: 'percent' },
  value:           { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  min_order:       { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  max_uses:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  used_count:      { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  valid_from:      { type: DataTypes.DATEONLY, allowNull: true },
  valid_until:     { type: DataTypes.DATEONLY, allowNull: true },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'coupon',
  tableName: 'coupons',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['organization_id'] }, { unique: true, fields: ['code'] }]
});

module.exports = Coupon;
