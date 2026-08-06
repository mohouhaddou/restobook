'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// medicine_id (pas product_id) : cohérent avec le reste du domaine pharmacie
// (PharmacySaleItem.medicine_id, PharmacyPrescriptionItem.medicine_id) —
// orderEngine.js ne lit jamais les noms de FK au niveau item, donc aucune
// contrainte de vocabulaire cross-moteur ici (contrairement au niveau order,
// voir pharmacyOrder.js).
class PharmacyOrderItem extends Model {}

PharmacyOrderItem.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  order_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  medicine_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // nullable : médicament supprimé

  // Snapshot au moment de la commande
  product_name:  { type: DataTypes.STRING(191), allowNull: false },
  product_price: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  unit:          { type: DataTypes.STRING(32),   defaultValue: 'unité' },

  // Toujours entier — pas de vente au poids en pharmacie (contrairement à
  // HanoutOrderItem.quantity qui peut être décimal pour le kg).
  quantity:   { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 1 },
  line_total: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
}, {
  sequelize,
  tableName:   'pharmacy_order_items',
  underscored: true,
  timestamps:  false,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['medicine_id'] },
  ],
});

module.exports = PharmacyOrderItem;
