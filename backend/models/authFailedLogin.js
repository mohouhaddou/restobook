'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Tentatives de connexion échouées — écrit depuis les 2 branches d'échec de
// POST /api/auth/login (backend/src/modules/auth/routes.js), fire-and-forget.
// Alimente le compteur "tentatives échouées (24h)" de la page Sécurité du
// module Infrastructure — la seule donnée de sécurité que l'app peut produire
// elle-même sans changement système (fail2ban/auth.log restent hors de portée
// de l'utilisateur applicatif sur ce VPS, voir InfraSecurityPage).
class AuthFailedLogin extends Model {}

AuthFailedLogin.init({
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  identifier: { type: DataTypes.STRING(191), allowNull: true }, // matricule/email tenté
  ip:         { type: DataTypes.STRING(45), allowNull: true },
}, {
  sequelize,
  tableName: 'auth_failed_logins',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['created_at'] },
  ],
});

module.exports = AuthFailedLogin;
