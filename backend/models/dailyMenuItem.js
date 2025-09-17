const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');

class DailyMenuItem extends Model {}
DailyMenuItem.init({
  stock_quota: { type: DataTypes.INTEGER, allowNull: true }
}, { sequelize, modelName: 'daily_menu_item' });

module.exports = DailyMenuItem;
