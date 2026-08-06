'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Règle de tarification livraison. Résolution par pricingService : org+zone
// > org seule > zone seule > règle globale (organization_id ET zone_id null),
// triée par priority desc. Si aucune règle active ne matche, le commerce
// garde son organizations.delivery_fee plat actuel — comportement inchangé
// tant que rien n'est configuré (voir pricingService.js).
class DeliveryPricingRule extends Model {}

DeliveryPricingRule.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  zone_id:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  name:                { type: DataTypes.STRING(120), allowNull: false },
  type: {
    type: DataTypes.ENUM('fixed', 'per_distance', 'per_duration', 'dynamic_surge', 'off_peak', 'free_threshold'),
    allowNull: false,
  },
  base_amount:         { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  per_km_amount:       { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  per_minute_amount:   { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  surge_multiplier:    { type: DataTypes.DECIMAL(4, 2), allowNull: true },
  min_order_for_free:  { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  active_days:         { type: DataTypes.JSON, allowNull: true }, // ex: [0,6] dimanche/samedi
  active_from:         { type: DataTypes.STRING(5), allowNull: true }, // 'HH:mm'
  active_to:           { type: DataTypes.STRING(5), allowNull: true },
  priority:            { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active:           { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'delivery_pricing_rule',
  tableName: 'delivery_pricing_rules',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['zone_id'] },
    { fields: ['is_active'] },
  ]
});

module.exports = DeliveryPricingRule;
