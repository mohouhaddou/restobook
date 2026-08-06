'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class HanoutOrder extends Model {}

HanoutOrder.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  order_number: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
  },

  // Client
  customer_name:  { type: DataTypes.STRING(191), allowNull: false },
  customer_phone: { type: DataTypes.STRING(32),  allowNull: false },
  // Compte marketplace lié (carte iFilino scannée en caisse) — nullable, un
  // client comptoir/hanout n'a pas forcément de compte (voir customer_name/phone ci-dessus).
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  // Livraison
  delivery_type: {
    type: DataTypes.ENUM('pickup','delivery','in_store'),
    defaultValue: 'pickup',
  },
  delivery_address:  { type: DataTypes.TEXT,         allowNull: true },
  delivery_district: { type: DataTypes.STRING(100),  allowNull: true },
  delivery_fee:      { type: DataTypes.DECIMAL(6,2), defaultValue: 0 },
  delivery_lat:      { type: DataTypes.DECIMAL(10,7), allowNull: true },
  delivery_lng:      { type: DataTypes.DECIMAL(10,7), allowNull: true },

  // Montants
  subtotal:    { type: DataTypes.DECIMAL(8,2), allowNull: false },
  total:       { type: DataTypes.DECIMAL(8,2), allowNull: false },
  tax_amount:  { type: DataTypes.DECIMAL(8,2), allowNull: true, defaultValue: 0 },

  // Statut — picked_up/on_the_way ajoutés de façon additive pour le module
  // delivery (courier en transit) ; valeurs historiques inchangées.
  status: {
    type: DataTypes.ENUM('pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled'),
    defaultValue: 'pending',
  },

  // source distingue l'origine métier de la commande (POS = vente en caisse)
  source: {
    type: DataTypes.ENUM('MARKETPLACE', 'POS', 'ADMIN'),
    defaultValue: 'MARKETPLACE',
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'card', 'credit', 'online'),
    allowNull: true,
    defaultValue: 'cash',
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'refunded', 'failed'),
    allowNull: true,
    defaultValue: 'pending',
  },
  cashier_id:               { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  cash_register_session_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  notes:             { type: DataTypes.TEXT,    allowNull: true },
  whatsapp_notified: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Snapshot des items (pour affichage rapide sans JOIN)
  items_snapshot: { type: DataTypes.JSON, defaultValue: [] },
}, {
  sequelize,
  tableName:   'hanout_orders',
  underscored: true,
  timestamps:  true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'status'] },
    { fields: ['order_number'], unique: true },
    { fields: ['customer_phone'] },
    { fields: ['user_id'] },
  ],
});

module.exports = HanoutOrder;
