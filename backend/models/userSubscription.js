'use strict';
const { DataTypes } = require('sequelize');
const db = require('./db');

const UserSubscription = db.define('UserSubscription', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organization_id:   { type: DataTypes.INTEGER, allowNull: false },
  plan_id:           { type: DataTypes.INTEGER, allowNull: false },
  status:            { type: DataTypes.ENUM('active','cancelled','expired','trial','pending'), defaultValue: 'trial' },
  billing_cycle:     { type: DataTypes.ENUM('monthly','yearly'), defaultValue: 'monthly' },
  started_at:        { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  expires_at:        { type: DataTypes.DATE },
  cancelled_at:      { type: DataTypes.DATE },
  trial_ends_at:     { type: DataTypes.DATE },
  payment_reference: { type: DataTypes.STRING(255) },
  notes:             { type: DataTypes.TEXT },
}, {
  tableName: 'user_subscriptions',
  underscored: true,
});

module.exports = UserSubscription;
