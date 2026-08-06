'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');
class TrafficEvent extends Model {}
TrafficEvent.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  module:           { type: DataTypes.ENUM('discover', 'play', 'gaminghub'), allowNull: false },
  entity_type:      { type: DataTypes.STRING(32), allowNull: false },
  entity_id:        { type: DataTypes.STRING(64), allowNull: true },
  visitor_hash:     { type: DataTypes.CHAR(64), allowNull: false },
  referrer_domain:  { type: DataTypes.STRING(191), allowNull: true },
  device_type:      { type: DataTypes.ENUM('mobile', 'desktop', 'tablet'), allowNull: true },
  view_date:        { type: DataTypes.DATEONLY, allowNull: false },
  created_at:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, modelName: 'traffic_event', tableName: 'traffic_events', timestamps: false, indexes: [
  { unique: true, fields: ['module', 'entity_type', 'entity_id', 'visitor_hash', 'view_date'], name: 'uq_traffic_visit_day' },
  { fields: ['module', 'view_date'], name: 'idx_traffic_module_date' },
  { fields: ['module', 'referrer_domain'], name: 'idx_traffic_module_referrer' },
] });
module.exports = TrafficEvent;
