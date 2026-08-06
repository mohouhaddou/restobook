'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Document administratif d'un livreur (ou de son véhicule). `status` suit un
// cycle simple : pending (déposé, pas encore vérifié) → verified/rejected
// (SuperAdmin), et 'expired' est appliqué par documentExpiryJob.js quand
// expires_at est dépassé — indépendamment de verified/rejected.
class DeliveryDocument extends Model {}

DeliveryDocument.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  delivery_person_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  vehicle_id:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  type: {
    type: DataTypes.ENUM('license', 'registration_card', 'insurance', 'national_id', 'background_check', 'other'),
    allowNull: false,
  },
  file_url:     { type: DataTypes.STRING(500), allowNull: true },
  number:       { type: DataTypes.STRING(100), allowNull: true },
  issued_at:    { type: DataTypes.DATEONLY, allowNull: true },
  expires_at:   { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'expired', 'rejected'),
    defaultValue: 'pending',
  },
  verified_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  verified_at:         { type: DataTypes.DATE, allowNull: true },
  last_expiry_alert_at: { type: DataTypes.DATE, allowNull: true },
  notes:        { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  modelName: 'delivery_document',
  tableName: 'delivery_documents',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['delivery_person_id', 'type'] },
    { fields: ['expires_at'] },
  ]
});

module.exports = DeliveryDocument;
