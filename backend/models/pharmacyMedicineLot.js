'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyMedicineLot extends Model {}

PharmacyMedicineLot.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  medicine_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  supplier_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  lot_number:        { type: DataTypes.STRING(100), allowNull: false },
  quantity_initial:  { type: DataTypes.INTEGER, allowNull: false },
  quantity_remaining:{ type: DataTypes.INTEGER, allowNull: false },
  entry_date:        { type: DataTypes.DATEONLY, allowNull: false },
  expiry_date:       { type: DataTypes.DATEONLY, allowNull: false },
  purchase_price:    { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },

  status: {
    type: DataTypes.ENUM('active', 'depleted', 'expired', 'recalled'),
    defaultValue: 'active',
  },
}, {
  sequelize,
  tableName: 'pharmacy_medicine_lots',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['medicine_id'] },
    // FEFO : index pour trier rapidement par date de péremption
    { fields: ['medicine_id', 'status', 'expiry_date'] },
  ],
});

module.exports = PharmacyMedicineLot;
