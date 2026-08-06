'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PushToken extends Model {}

// Une seule ligne active par device_id à la fois (voir NotificationRouter.registerToken) —
// c'est ce qui empêche un device de continuer à recevoir les push d'un compte
// dont l'utilisateur s'est déconnecté (le token FCM est stable par device, pas par session).
PushToken.init({
  id:            { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  role:          { type: DataTypes.ENUM('customer', 'driver', 'business', 'admin'), allowNull: false },
  business_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  driver_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  fcm_token:     { type: DataTypes.STRING(512), allowNull: false },
  device_id:     { type: DataTypes.STRING(191), allowNull: false },
  platform:      { type: DataTypes.ENUM('web', 'android', 'ios'), allowNull: false, defaultValue: 'web' },
  session_id:    { type: DataTypes.STRING(191), allowNull: true },
  is_active:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  last_seen_at:  { type: DataTypes.DATE, allowNull: true },
  revoked_at:    { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'push_token',
  tableName: 'push_tokens',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['user_id', 'role'] },
    { fields: ['business_id'] },
    { fields: ['driver_id'] },
  ],
});

module.exports = PushToken;
