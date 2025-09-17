// backend/models/reservation.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index'); // conservez votre chemin d'instance Sequelize

class Reservation extends Model {}

Reservation.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },

  user_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  menu_item_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  date_jour:      { type: DataTypes.DATEONLY, allowNull: false },

  // si vous validez par scan, ajoutez 'picked'
  status:         { type: DataTypes.ENUM('confirmed', 'cancelled', 'picked'),
                    allowNull: false, defaultValue: 'confirmed' },

  // ⬇️ inclut 'boisson'
  category:       { type: DataTypes.ENUM('entrée', 'plat', 'dessert', 'boisson'),
                    allowNull: true },

  // code par item (doit être unique)
  pickup_code:    { type: DataTypes.STRING(16), allowNull: false, unique: true },

  // code commun à la réservation du jour (1 code pour 1..4 lignes)
  order_code:     { type: DataTypes.STRING(64), allowNull: true },

  // horodatage de retrait (si scan en cantine)
  picked_at:      { type: DataTypes.DATE, allowNull: true },

}, {
  sequelize,
  modelName: 'reservation',
  tableName: 'reservations',
  timestamps: true,
  indexes: [
    // Règle métier : 1 "confirmed" par (user, jour, catégorie)
    { name: 'uniq_user_day_cat_status', unique: true,
      fields: ['user_id', 'date_jour', 'category', 'status'] },

    // Accélère les recherches par ordre (QR réservation)
    { name: 'reservations_order_code', fields: ['order_code'] },

    // Aide pour jointure/summary
    { name: 'menu_item_id', fields: ['menu_item_id'] }
  ]
});

module.exports = Reservation;
