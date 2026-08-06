'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class HanoutOrderItem extends Model {}

HanoutOrderItem.init({
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  order_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },  // nullable : produit supprimé

  // Snapshot au moment de la commande
  product_name:  { type: DataTypes.STRING(191), allowNull: false },
  product_price: { type: DataTypes.DECIMAL(8,2), allowNull: false },
  unit:          { type: DataTypes.STRING(32),   defaultValue: 'pièce' },

  quantity:   { type: DataTypes.INTEGER,     allowNull: false, defaultValue: 1 },
  line_total: { type: DataTypes.DECIMAL(8,2), allowNull: false },
}, {
  sequelize,
  tableName:   'hanout_order_items',
  underscored: true,
  timestamps:  false,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['product_id'] },
  ],
});

module.exports = HanoutOrderItem;
