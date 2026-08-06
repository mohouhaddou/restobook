'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Genres/catégories du Gaming Hub (MMORPG, FPS, Sandbox...) — équivalent
// éditorial de discover/rubriques.js mais persisté en table (contrairement
// aux rubriques Discover figées dans le code) pour rester créable sans déploiement.
class GamingCategory extends Model {}

GamingCategory.init({
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:       { type: DataTypes.STRING(100), unique: true, allowNull: false },
  label_fr:   { type: DataTypes.STRING(191), allowNull: false },
  label_en:   { type: DataTypes.STRING(191), allowNull: false },
  label_ar:   { type: DataTypes.STRING(191), allowNull: false },
  icon:       { type: DataTypes.STRING(10), defaultValue: '🎮' },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'gaming_category',
  tableName: 'gaming_categories',
  timestamps: true,
  underscored: true,
});

module.exports = GamingCategory;
