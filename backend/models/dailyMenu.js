const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class DailyMenu extends Model {}
DailyMenu.init({
  date_jour:       { type: DataTypes.DATEONLY, allowNull: false },
  title:           { type: DataTypes.STRING(200), allowNull: true },
  price:           { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  description:     { type: DataTypes.TEXT, allowNull: true },
  locked:          { type: DataTypes.BOOLEAN, defaultValue: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, modelName: 'daily_menu' });

module.exports = DailyMenu;
