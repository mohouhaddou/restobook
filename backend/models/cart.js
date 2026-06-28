'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Cart extends Model {}

Cart.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  session_token:   { type: DataTypes.STRING(64), allowNull: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  expires_at:      { type: DataTypes.DATE, allowNull: false },
}, {
  sequelize,
  modelName: 'cart',
  tableName: 'carts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['session_token'] },
    { fields: ['expires_at'] }
  ]
});

module.exports = Cart;
