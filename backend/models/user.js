'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');
const { USER_ROLE_VALUES } = require('../auth/permissions');

class User extends Model {}

User.init({
  matricule:       { type: DataTypes.STRING, allowNull: false },
  nom:             { type: DataTypes.STRING, allowNull: true },
  email:           { type: DataTypes.STRING, allowNull: true },
  phone:           { type: DataTypes.STRING(32), allowNull: true },
  avatar_url:      { type: DataTypes.STRING(500), allowNull: true },
  role: {
    type: DataTypes.ENUM(...USER_ROLE_VALUES),
    defaultValue: 'user'
  },
  hash_mdp:        { type: DataTypes.STRING, allowNull: true },
  actif:                       { type: DataTypes.BOOLEAN, defaultValue: true },
  organization_id:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  email_verified:              { type: DataTypes.BOOLEAN, defaultValue: false },
  email_verification_token:    { type: DataTypes.STRING(255), allowNull: true },
  email_verification_expires:  { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'user',
  timestamps: true,
});

module.exports = User;
