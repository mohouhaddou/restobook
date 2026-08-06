'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Delivery extends Model {}

Delivery.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  // order_id fait référence à Order.id, HanoutOrder.id OU PharmacyOrder.id
  // selon pos_order_type (les PK auto-incrémentées sont des séquences
  // indépendantes qui se chevauchent — même piège que
  // loyalty_transactions.pos_order_type, voir migrate_loyalty_engine.js).
  // D'où l'unicité composite (order_id, pos_order_type) au lieu d'une
  // unicité simple sur order_id.
  order_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  pos_order_type:  { type: DataTypes.ENUM('order', 'hanout_order', 'pharmacy_order'), allowNull: false, defaultValue: 'order' },
  // partner_id/partner_lat/partner_lng sont conservés (écrits en parallèle de
  // delivery_person_id) pendant la transition vers le modèle DeliveryPerson —
  // voir plan module delivery, ne pas supprimer avant migration complète.
  partner_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  status: {
    // Valeurs historiques inchangées + valeurs additives pour le futur moteur
    // de dispatch (Phase 3) : searching, proposed, rejected, confirmed, completed.
    type: DataTypes.ENUM(
      'pending','assigned','picking_up','picked_up','on_the_way','delivered','failed',
      'searching','proposed','rejected','confirmed','completed'
    ),
    defaultValue: 'pending'
  },
  pickup_at:    { type: DataTypes.DATE, allowNull: true },
  delivered_at: { type: DataTypes.DATE, allowNull: true },
  partner_lat:  { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  partner_lng:  { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  distance_km:  { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  fee:          { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  notes:        { type: DataTypes.TEXT, allowNull: true },

  // ── Module delivery (dispatch/tracking) ────────────────────────────────────
  delivery_person_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  mode:               { type: DataTypes.ENUM('own_fleet', 'network', 'external'), allowNull: true },
  zone_id:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  vehicle_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  eta_minutes:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  dispatch_attempts:  { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  proposed_at:        { type: DataTypes.DATE, allowNull: true },
  accepted_at:        { type: DataTypes.DATE, allowNull: true },
  pickup_lat:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  pickup_lng:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  dropoff_lat:        { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  dropoff_lng:        { type: DataTypes.DECIMAL(10, 7), allowNull: true },
}, {
  sequelize,
  modelName: 'delivery',
  tableName: 'deliveries',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['order_id', 'pos_order_type'] },
    { fields: ['partner_id'] },
    { fields: ['status'] },
    { fields: ['delivery_person_id'] },
  ]
});

module.exports = Delivery;
