'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Ville de premier niveau pour le SEO programmatique (/:city, /:city/restaurants,
// /:city/:category). Dérivée du champ texte libre organizations.city — voir
// scripts/migrate_seo_backfill_cities.js. Générique, réutilisable par tous les
// verticaux (restaurant, hanout, pharmacie...), pas seulement les restaurants.
class City extends Model {}

City.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:            { type: DataTypes.STRING(100), unique: true, allowNull: false },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  region:          { type: DataTypes.STRING(100), allowNull: true },
  country:         { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Maroc' },
  latitude:        { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude:       { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  is_active:       { type: DataTypes.BOOLEAN, defaultValue: true },
  seo_title:       { type: DataTypes.STRING(191), allowNull: true },
  seo_description: { type: DataTypes.STRING(500), allowNull: true },
}, {
  sequelize,
  modelName: 'city',
  tableName: 'cities',
  timestamps: true,
  underscored: true,
});

module.exports = City;
