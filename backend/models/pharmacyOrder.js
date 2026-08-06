'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Commande client pharmacie (achat en ligne, OTC/parapharmacie uniquement —
// jamais de médicament sous ordonnance, voir garde-fou dans
// src/modules/pharmacy/publicRoutes.js POST /:slug/orders). Champs
// délibérément identiques à HanoutOrder (mêmes noms) : les shims génériques
// de delivery/services/orderEngine.js (trackingCode/guestName/guestPhone/
// totalAmount/isDeliveryOrder) lisent déjà order_number/customer_name/
// customer_phone/total/delivery_type via des chaînes ?? — réutiliser ce
// vocabulaire évite toute modification de ces fonctions.
class PharmacyOrder extends Model {}

PharmacyOrder.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  order_number: { type: DataTypes.STRING(32), allowNull: false, unique: true },

  customer_name:  { type: DataTypes.STRING(191), allowNull: false },
  customer_phone: { type: DataTypes.STRING(32),  allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  delivery_type: { type: DataTypes.ENUM('pickup', 'delivery', 'in_store'), defaultValue: 'pickup' },
  delivery_address:  { type: DataTypes.TEXT,          allowNull: true },
  delivery_district: { type: DataTypes.STRING(100),   allowNull: true },
  delivery_fee:      { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  delivery_lat:      { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  delivery_lng:      { type: DataTypes.DECIMAL(10, 7), allowNull: true },

  subtotal:   { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  total:      { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  tax_amount: { type: DataTypes.DECIMAL(8, 2), allowNull: true, defaultValue: 0 },

  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered', 'cancelled'),
    defaultValue: 'pending',
  },

  source:         { type: DataTypes.ENUM('MARKETPLACE', 'POS', 'ADMIN'), defaultValue: 'MARKETPLACE' },
  payment_method: { type: DataTypes.ENUM('cash', 'card', 'credit', 'online'), allowNull: true, defaultValue: 'cash' },
  payment_status: { type: DataTypes.ENUM('pending', 'paid', 'refunded', 'failed'), allowNull: true, defaultValue: 'pending' },
  cashier_id:               { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  cash_register_session_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  notes:             { type: DataTypes.TEXT,    allowNull: true },
  whatsapp_notified: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Snapshot des items ET des lots FEFO consommés par item (voir
  // src/modules/pharmacy/proRoutes.js PATCH /orders/:id/status pour la
  // restauration de stock sur annulation — impossible de faire un simple
  // increment('stock_quantity') comme hanout, le stock pharmacie est
  // recalculé depuis les lots).
  items_snapshot: { type: DataTypes.JSON, defaultValue: [] },
}, {
  sequelize,
  tableName:   'pharmacy_orders',
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

module.exports = PharmacyOrder;
