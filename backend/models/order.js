'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Order extends Model {}

Order.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  type: {
    type: DataTypes.ENUM('dine_in', 'takeaway', 'click_collect', 'delivery', 'in_store'),
    defaultValue: 'delivery'
  },
  // order_source sépare le canal de commande du mode de fulfillment
  // TABLE_QR = client à table via QR code, ONLINE = marketplace/livraison/emporter, STAFF = créé par le personnel
  order_source: {
    type: DataTypes.ENUM('TABLE_QR', 'ONLINE', 'STAFF'),
    defaultValue: 'ONLINE'
  },
  // source distingue l'origine métier de la commande (POS = vente en caisse)
  source: {
    type: DataTypes.ENUM('MARKETPLACE', 'POS', 'ADMIN'),
    defaultValue: 'MARKETPLACE'
  },
  cashier_id:               { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  cash_register_session_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  tax_amount:               { type: DataTypes.DECIMAL(8, 2), allowNull: true, defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled'),
    defaultValue: 'pending'
  },
  total_amount:      { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  notes:             { type: DataTypes.TEXT, allowNull: true },
  pickup_code:       { type: DataTypes.STRING(16), allowNull: true },
  table_id:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  table_label:       { type: DataTypes.STRING(64), allowNull: true },
  guest_name:        { type: DataTypes.STRING(191), allowNull: true },
  guest_phone:       { type: DataTypes.STRING(32), allowNull: true },

  // ── Delivery fields ───────────────────────────────────────────────────────
  delivery_address:  { type: DataTypes.TEXT, allowNull: true },
  delivery_lat:      { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  delivery_lng:      { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  delivery_fee:      { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  service_fee:       { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  discount_amount:   { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  coupon_code:       { type: DataTypes.STRING(32), allowNull: true },

  // ── Payment fields ────────────────────────────────────────────────────────
  payment_method: {
    type: DataTypes.ENUM('cash', 'card', 'wallet', 'online', 'credit'),
    defaultValue: 'cash'
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'refunded', 'failed'),
    defaultValue: 'pending'
  },
  estimated_ready_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'order',
  tableName: 'orders',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['organization_id', 'status'] },
    { fields: ['organization_id', 'created_at'] },
    { fields: ['pickup_code'] },
  ]
});

module.exports = Order;
