'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class HeroSlideEvent extends Model {}

HeroSlideEvent.init({
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slide_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  event_type: { type: DataTypes.ENUM('impression', 'click', 'conversion'), allowNull: false },
  user_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  order_type: { type: DataTypes.ENUM('resto', 'hanout'), allowNull: true }, // conversion uniquement
  order_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },       // conversion uniquement, pas de vraie FK (2 tables de commande différentes)
  amount:     { type: DataTypes.DECIMAL(10, 2), allowNull: true },        // conversion uniquement, snapshot du total commande
}, {
  sequelize,
  tableName: 'marketplace_hero_events',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['slide_id', 'event_type', 'created_at'] },
    { fields: ['order_type', 'order_id'] }, // vérification d'idempotence pour l'attribution
  ],
});

module.exports = HeroSlideEvent;
