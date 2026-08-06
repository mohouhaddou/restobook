'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class StoreHeroSlideEvent extends Model {}

StoreHeroSlideEvent.init({
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slide_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  event_type: { type: DataTypes.ENUM('impression', 'click'), allowNull: false },
}, {
  sequelize,
  tableName: 'store_hero_events',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['slide_id', 'event_type', 'created_at'] },
  ],
});

module.exports = StoreHeroSlideEvent;
