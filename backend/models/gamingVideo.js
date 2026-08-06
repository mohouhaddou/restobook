'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Vidéos officielles YouTube uniquement — is_official reste toujours true,
// aucune UI ne doit permettre de créer une ligne avec une source non officielle.
class GamingVideo extends Model {}

GamingVideo.init({
  id:             { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  gaming_game_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  youtube_id:     { type: DataTypes.STRING(32), allowNull: false },
  title:          { type: DataTypes.STRING(191), allowNull: true },
  is_official:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order:     { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'gaming_video',
  tableName: 'gaming_videos',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = GamingVideo;
