'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Favorite extends Model {}

Favorite.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, // commerce favori
  // Réservé pour favoriser un produit précis plus tard (v1 = favoris au niveau commerce uniquement) :
  // target_type='business' + target_id=null → favori sur tout le commerce.
  target_type: {
    type: DataTypes.ENUM('business', 'menu_item', 'hanout_product', 'pharmacy_medicine'),
    allowNull: false,
    defaultValue: 'business',
  },
  target_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'favorites',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['user_id'] },
    { unique: true, fields: ['user_id', 'organization_id', 'target_type', 'target_id'], name: 'uq_favorite_user_target' },
  ],
});

module.exports = Favorite;
