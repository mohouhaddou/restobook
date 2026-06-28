'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Address extends Model {}

Address.init({
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  label:      { type: DataTypes.STRING(100), defaultValue: 'Maison' },
  street:     { type: DataTypes.STRING(255), allowNull: false },
  city:       { type: DataTypes.STRING(100), defaultValue: '' },
  zone:       { type: DataTypes.STRING(100), allowNull: true },
  notes:      { type: DataTypes.STRING(255), allowNull: true },
  latitude:   { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude:  { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  sequelize,
  modelName: 'address',
  tableName: 'addresses',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['user_id'] }]
});

module.exports = Address;
