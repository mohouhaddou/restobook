'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class TableReservation extends Model {}

TableReservation.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  guest_name:      { type: DataTypes.STRING(191), allowNull: false },
  guest_phone:     { type: DataTypes.STRING(32), allowNull: true },
  guest_email:     { type: DataTypes.STRING(191), allowNull: true },
  date_jour:       { type: DataTypes.DATEONLY, allowNull: false },
  time_slot:       { type: DataTypes.STRING(8), allowNull: false },
  guests_count:    { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 2 },
  table_label:     { type: DataTypes.STRING(64), allowNull: true },
  status:          {
    type: DataTypes.ENUM('pending','confirmed','seated','cancelled','no_show'),
    defaultValue: 'pending'
  },
  notes:           { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  modelName: 'table_reservation',
  tableName: 'table_reservations',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['organization_id', 'date_jour', 'status'] },
  ]
});

module.exports = TableReservation;
