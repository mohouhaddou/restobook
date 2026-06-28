'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Organization extends Model {}

Organization.init({
  id:   { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug: { type: DataTypes.STRING(64), unique: true, allowNull: false },
  name: { type: DataTypes.STRING(191), allowNull: false },
  type: {
    type: DataTypes.ENUM('canteen', 'restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe'),
    allowNull: false,
    defaultValue: 'canteen'
  },
  plan: {
    type: DataTypes.ENUM('trial', 'starter', 'pro', 'enterprise'),
    defaultValue: 'trial'
  },
  plan_expires_at: { type: DataTypes.DATE, allowNull: true },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
  settings:        { type: DataTypes.JSON, allowNull: true },

  // ── Marketplace fields ────────────────────────────────────────────────────
  address:          { type: DataTypes.STRING(255), allowNull: true },
  city:             { type: DataTypes.STRING(100), allowNull: true },
  zone:             { type: DataTypes.STRING(100), allowNull: true },
  district:         { type: DataTypes.STRING(100), allowNull: true },
  postal_code:      { type: DataTypes.STRING(20),  allowNull: true },
  country:          { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Maroc' },
  phone:            { type: DataTypes.STRING(32), allowNull: true },
  email:            { type: DataTypes.STRING(191), allowNull: true },
  description:      { type: DataTypes.TEXT, allowNull: true },
  logo_url:         { type: DataTypes.STRING(500), allowNull: true },
  cover_url:        { type: DataTypes.STRING(500), allowNull: true },
  opening_hours:    { type: DataTypes.JSON, allowNull: true },
  cuisine_type:     { type: DataTypes.STRING(100), allowNull: true },
  accepts_delivery: { type: DataTypes.BOOLEAN, defaultValue: true },
  accepts_takeaway: { type: DataTypes.BOOLEAN, defaultValue: true },
  accepts_dine_in:  { type: DataTypes.BOOLEAN, defaultValue: true },
  delivery_fee:     { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  min_order_amount: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  avg_prep_time:    { type: DataTypes.INTEGER, defaultValue: 20 },
  avg_rating:       { type: DataTypes.DECIMAL(3, 2), defaultValue: 0 },
  total_reviews:    { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  latitude:          { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  location_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  accepts_reservation: { type: DataTypes.BOOLEAN, defaultValue: true },
  accepts_qr_table:    { type: DataTypes.BOOLEAN, defaultValue: false },
  is_featured:      { type: DataTypes.BOOLEAN, defaultValue: false },
  // ── Séparation domaines ────────────────────────────────────────────────────
  // is_marketplace : visible dans la marketplace publique (restaurants, snacks, cafés)
  // is_internal    : usage privé uniquement (cantines d'entreprises, scolaires…)
  is_marketplace:   { type: DataTypes.BOOLEAN, defaultValue: false },
  is_internal:      { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  sequelize,
  modelName: 'organization',
  tableName: 'organizations',
  timestamps: true,
  underscored: true,
});

module.exports = Organization;
