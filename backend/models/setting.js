const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');

class Setting extends Model {}
Setting.init({
  key: { type: DataTypes.STRING, unique: true },
  value: { type: DataTypes.TEXT }
}, { sequelize, modelName: 'setting' });

module.exports = Setting;
