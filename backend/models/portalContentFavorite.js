'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');
class PortalContentFavorite extends Model {}
PortalContentFavorite.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  portal_content_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, modelName: 'portal_content_favorite', tableName: 'portal_content_favorites', timestamps: false, indexes: [
  { unique: true, fields: ['user_id', 'portal_content_id'], name: 'uq_portal_favorite_user_content' },
  { fields: ['user_id', 'created_at'], name: 'idx_portal_favorite_user_created' },
] });
module.exports = PortalContentFavorite;
