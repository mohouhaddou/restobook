'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyProfile extends Model {}

// Profil complémentaire d'une pharmacie (1:1 avec Organization).
// Les champs déjà génériques (nom, adresse, téléphone, horaires, livraison) restent
// portés par Organization/Business — ce modèle ne couvre que ce qui est spécifique pharmacie.
PharmacyProfile.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },

  pharmacien_responsable: { type: DataTypes.STRING(191), allowNull: true },
  license_number:         { type: DataTypes.STRING(64),  allowNull: true },

  is_garde:    { type: DataTypes.BOOLEAN, defaultValue: false }, // pharmacie de garde
  garde_note:  { type: DataTypes.STRING(255), allowNull: true },

  services: { type: DataTypes.JSON, defaultValue: [] }, // ex: ['vaccination','livraison','tension_arterielle']
}, {
  sequelize,
  tableName: 'pharmacy_profiles',
  underscored: true,
  timestamps: true,
});

module.exports = PharmacyProfile;
