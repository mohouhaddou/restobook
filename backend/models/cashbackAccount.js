'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class CashbackAccount extends Model {}

// Une ligne par utilisateur (contrairement à LoyaltyPoints qui est par organisation) :
// le cashback est pensé comme un solde unique, indépendant du commerce d'origine.
CashbackAccount.init({
  id:            { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  balance:       { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total_earned:  { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total_used:    { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  tableName: 'cashback_accounts',
  underscored: true,
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
});

module.exports = CashbackAccount;
