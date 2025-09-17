const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');

class DailyMenu extends Model {}
DailyMenu.init({
  date_jour: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  locked: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { sequelize, modelName: 'daily_menu' });

module.exports = DailyMenu;
