'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyPrescription extends Model {}

// NOTE OCR : `ocr_raw_text` / `ocr_status` sont prévus pour une future extraction
// automatique du contenu de l'ordonnance, non implémentée dans cette version —
// la validation humaine du pharmacien reste seule source de vérité.
PharmacyPrescription.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  customer_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  sale_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  doctor_name:       { type: DataTypes.STRING(191), allowNull: true },
  prescription_date: { type: DataTypes.DATEONLY, allowNull: true },
  file_url:          { type: DataTypes.STRING(500), allowNull: false }, // photo ou PDF

  status: {
    type: DataTypes.ENUM('received', 'preparing', 'served', 'cancelled'),
    defaultValue: 'received',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },

  ocr_status:   { type: DataTypes.ENUM('not_started', 'pending', 'done', 'failed'), defaultValue: 'not_started' },
  ocr_raw_text: { type: DataTypes.TEXT, allowNull: true },

  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'pharmacy_prescriptions',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['customer_id'] },
    { fields: ['organization_id', 'status'] },
  ],
});

module.exports = PharmacyPrescription;
