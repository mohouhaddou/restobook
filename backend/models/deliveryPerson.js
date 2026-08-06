'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class DeliveryPerson extends Model {}

DeliveryPerson.init({
  id:                     { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:                { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  // Mode 1 (own_fleet) = livreur d'un commerce, owner_organization_id renseigné.
  // Mode 2 (network)   = livreur réseau iFilino, owner_organization_id null (comportement historique).
  // Mode 3 (external)  = partenaire externe, external_provider_code renseigné (aucune intégration réelle).
  mode:                   { type: DataTypes.ENUM('own_fleet', 'network', 'external'), defaultValue: 'network' },
  owner_organization_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  external_provider_code: { type: DataTypes.STRING(64), allowNull: true },
  status: {
    type: DataTypes.ENUM('available', 'busy', 'paused', 'offline', 'on_delivery', 'awaiting', 'returning'),
    defaultValue: 'offline'
  },
  avg_rating:         { type: DataTypes.DECIMAL(3, 2), defaultValue: 0 },
  ratings_count:      { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  deliveries_count:   { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  total_distance_km:  { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  last_status_change_at: { type: DataTypes.DATE, allowNull: true },
  last_seen_at:          { type: DataTypes.DATE, allowNull: true },
  is_active:             { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'delivery_person',
  tableName: 'delivery_persons',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['user_id'] },
    { fields: ['mode', 'status'] },
    { fields: ['owner_organization_id'] },
  ]
});

module.exports = DeliveryPerson;
