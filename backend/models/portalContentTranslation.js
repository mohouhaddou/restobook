'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PortalContentTranslation extends Model {}

PortalContentTranslation.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  portal_content_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  portal:            { type: DataTypes.ENUM('sports', 'kids'), allowNull: false },
  language:          { type: DataTypes.STRING(8), allowNull: false },
  title:             { type: DataTypes.STRING(191), allowNull: false },
  slug:              { type: DataTypes.STRING(191), allowNull: false },
  excerpt:           { type: DataTypes.STRING(500), allowNull: true },
  body:              { type: DataTypes.TEXT('long'), allowNull: true },
  metadata:          { type: DataTypes.JSON, allowNull: true },
  seo_title:         { type: DataTypes.STRING(191), allowNull: true },
  seo_description:   { type: DataTypes.STRING(500), allowNull: true },
  seo_keywords:      { type: DataTypes.JSON, allowNull: true },
  status:            { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'published' },
}, {
  sequelize,
  modelName: 'portal_content_translation',
  tableName: 'portal_content_translations',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['portal_content_id', 'language'] },
    { unique: true, fields: ['portal', 'language', 'slug'] },
    { fields: ['language', 'status'] },
  ],
});

module.exports = PortalContentTranslation;
