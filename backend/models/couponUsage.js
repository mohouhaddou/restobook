'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Journal d'utilisation par utilisateur — `coupons.used_count` reste un compteur
// global, ce journal permet d'afficher "mes coupons utilisés" côté wallet.
class CouponUsage extends Model {}

CouponUsage.init({
  id:        { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  coupon_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  order_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  used_at:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  tableName: 'coupon_usages',
  underscored: true,
  timestamps: false,
  indexes: [
    { fields: ['coupon_id'] },
    { fields: ['user_id'] },
  ],
});

module.exports = CouponUsage;
