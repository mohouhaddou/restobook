'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');
class PortalContentProgress extends Model {}
PortalContentProgress.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  portal_content_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  page_index: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  total_pages: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, modelName: 'portal_content_progress', tableName: 'portal_content_progress', timestamps: false, indexes: [
  { unique: true, fields: ['user_id', 'portal_content_id'], name: 'uq_portal_progress_user_content' },
  { fields: ['user_id', 'updated_at'], name: 'idx_portal_progress_user_updated' },
] });
module.exports = PortalContentProgress;
