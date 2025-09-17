const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');

class User extends Model {}

User.init({
  matricule: { type: DataTypes.STRING, unique: true, allowNull: false },
  nom: DataTypes.STRING,
  email: DataTypes.STRING,
  role: { type: DataTypes.ENUM('admin','manager','user'), defaultValue: 'user' },
  hash_mdp: DataTypes.STRING,
  actif: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { sequelize, modelName: 'user' });

module.exports = User;
