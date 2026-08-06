'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class AdCampaignPlacement extends Model {}

AdCampaignPlacement.init({
  id:            { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  campaign_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  placement_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, {
  sequelize,
  modelName: 'adCampaignPlacement',
  tableName: 'ad_campaign_placements',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['campaign_id', 'placement_id'] },
    { fields: ['placement_id'] },
  ],
});

module.exports = AdCampaignPlacement;
