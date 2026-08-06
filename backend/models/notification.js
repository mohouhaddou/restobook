'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Notification extends Model {}

Notification.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  // NULL = broadcast org (tous les staff de l'org voient cette notif)
  recipient_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  recipient_role:  { type: DataTypes.STRING(32), allowNull: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  type:            { type: DataTypes.STRING(64), allowNull: false },
  title:           { type: DataTypes.STRING(255), allowNull: false },
  message:         { type: DataTypes.TEXT, allowNull: true },
  entity_type:     { type: DataTypes.STRING(32), allowNull: true },
  entity_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  action_url:      { type: DataTypes.STRING(255), allowNull: true },
  channel:         { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'in_app' },
  status:          { type: DataTypes.ENUM('unread','read','archived'), allowNull: false, defaultValue: 'unread' },
  priority:        { type: DataTypes.ENUM('low','normal','high','urgent'), allowNull: false, defaultValue: 'normal' },
  data:            { type: DataTypes.JSON, allowNull: true },
  read_at:         { type: DataTypes.DATE, allowNull: true },
  expires_at:      { type: DataTypes.DATE, allowNull: true },
  dedup_key:       { type: DataTypes.STRING(191), allowNull: true },
}, {
  sequelize,
  tableName: 'notifications',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['dedup_key'] },
    { fields: ['expires_at'] },
  ],
});

module.exports = Notification;
