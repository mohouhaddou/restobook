const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');

class MenuItem extends Model {}
MenuItem.init({
  libelle: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  type: { type: DataTypes.ENUM('plat','entrée','dessert','boisson'), defaultValue: 'plat' },
  allergenes: DataTypes.JSON,
  calories: DataTypes.INTEGER,
  actif: { type: DataTypes.BOOLEAN, defaultValue: true },
  image_url: { type: DataTypes.STRING } // <-- NOUVEAU
}, { sequelize, modelName: 'menu_item' });

module.exports = MenuItem;
