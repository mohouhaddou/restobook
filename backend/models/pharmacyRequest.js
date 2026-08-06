'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyRequest extends Model {}

// Demandes envoyées depuis la fiche marketplace publique d'une pharmacie :
// envoi d'ordonnance, demande de disponibilité produit, demande de livraison.
// Validation humaine obligatoire côté pharmacien — aucun achat/réservation n'est confirmé automatiquement.
PharmacyRequest.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  type: { type: DataTypes.ENUM('prescription', 'availability', 'delivery', 'reservation'), allowNull: false },

  customer_name:  { type: DataTypes.STRING(191), allowNull: false },
  customer_phone: { type: DataTypes.STRING(32),  allowNull: false },

  product_name: { type: DataTypes.STRING(191), allowNull: true },  // pour availability/reservation
  file_url:     { type: DataTypes.STRING(500), allowNull: true },  // pour prescription
  message:      { type: DataTypes.TEXT, allowNull: true },
  address:      { type: DataTypes.STRING(255), allowNull: true },  // pour delivery

  status: { type: DataTypes.ENUM('new', 'in_progress', 'done', 'rejected'), defaultValue: 'new' },
  internal_notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  tableName: 'pharmacy_requests',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'status'] },
  ],
});

module.exports = PharmacyRequest;
