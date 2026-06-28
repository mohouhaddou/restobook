const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Setting extends Model {}
Setting.init({
  key: { type: DataTypes.STRING },
  value: { type: DataTypes.TEXT },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }
}, { sequelize, modelName: 'setting' });

module.exports = Setting;
