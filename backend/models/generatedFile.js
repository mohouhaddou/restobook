'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Fichier réellement généré pour un DigitalProduct — un seul par (digital_product_id, version) ;
// réutilisé par tous les acheteurs (voir generationService.ensureGeneratedFile, le cache décrit
// dans le plan). storage_provider/storage_path passent par l'abstraction StorageProvider — jamais
// de chemin absolu ni d'URL publique (contrairement à backend/uploads/, ce stockage n'est jamais
// servi par express.static, voir storage/LocalStorageProvider.js).
class GeneratedFile extends Model {}

GeneratedFile.init({
  id:                 { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  digital_product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },

  checksum:         { type: DataTypes.STRING(64), allowNull: true },
  storage_provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'local' },
  storage_path:     { type: DataTypes.STRING(500), allowNull: true },
  mime_type:        { type: DataTypes.STRING(100), allowNull: true },
  size:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  generated_at:     { type: DataTypes.DATE, allowNull: true },

  status: {
    type: DataTypes.ENUM('pending', 'generating', 'ready', 'failed', 'obsolete'),
    allowNull: false, defaultValue: 'pending',
  },
  error_message: { type: DataTypes.STRING(500), allowNull: true },
}, {
  sequelize,
  modelName: 'generated_file',
  tableName: 'generated_files',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['digital_product_id', 'status', 'version'] },
  ],
});

module.exports = GeneratedFile;
