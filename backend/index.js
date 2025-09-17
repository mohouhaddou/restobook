const express = require('express');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' }));
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir)); // servir /uploads


const sequelize = require('./models');
const User = require('./models/user');
const MenuItem = require('./models/menuItem');
const DailyMenu = require('./models/dailyMenu');
const DailyMenuItem = require('./models/dailyMenuItem');
const Reservation = require('./models/reservation');
const Setting = require('./models/setting');


User.hasMany(Reservation, { foreignKey: 'user_id' });
Reservation.belongsTo(User, { foreignKey: 'user_id' });

MenuItem.hasMany(DailyMenuItem, { foreignKey: 'menu_item_id' });
DailyMenuItem.belongsTo(MenuItem, { foreignKey: 'menu_item_id' });

DailyMenu.hasMany(DailyMenuItem, { foreignKey: 'daily_menu_id' });
DailyMenuItem.belongsTo(DailyMenu, { foreignKey: 'daily_menu_id' });

MenuItem.hasMany(Reservation, { foreignKey: 'menu_item_id' });
Reservation.belongsTo(MenuItem, { foreignKey: 'menu_item_id' });

app.use('/api', require('./routes'));

async function waitDb(maxRetries = 10) {
  for (let i = 1; i <= maxRetries; i++) {
    try { await sequelize.authenticate(); console.log('DB auth OK'); return; }
    catch (e) { console.log(`Tentative DB ${i}/${maxRetries} échouée: ${e.message}`); await new Promise(r => setTimeout(r, 2000)); }
  }
  throw new Error('Impossible de se connecter à la DB après retries');
}

async function start() {
  await waitDb();
  await sequelize.sync({ alter: true });
  console.log('DB synced');

  await Setting.findOrCreate({ where: { key: 'cutoff_time' }, defaults: { value: process.env.CUTOFF_TIME || '10:30' } });
  await Setting.findOrCreate({ where: { key: 'allow_cancel_until' }, defaults: { value: process.env.ALLOW_CANCEL_UNTIL || '10:00' } });

  const items = [
    { libelle: 'Tajine poulet', description: 'Citron confit/olives', type: 'plat' },
    { libelle: 'Poisson grillé', description: 'Légumes vapeur', type: 'plat' },
    { libelle: 'Salade marocaine', description: 'Tomate/oignon/poivron', type: 'entrée' },
  ];
  for (const it of items) await MenuItem.findOrCreate({ where: { libelle: it.libelle }, defaults: it });

  // seed 3 comptes: admin, manager, user
  const adminPwd = await bcrypt.hash('admin123', 10);
  await User.findOrCreate({ where: { matricule: 'admin' }, defaults: { nom: 'Administrateur', role: 'admin', hash_mdp: adminPwd, actif: true } });

  const managerPwd = await bcrypt.hash('manager123', 10);
  await User.findOrCreate({ where: { matricule: 'manager' }, defaults: { nom: 'Gestionnaire', role: 'manager', hash_mdp: managerPwd, actif: true } });

  const userPwd = await bcrypt.hash('test123', 10);
  await User.findOrCreate({ where: { matricule: 'E12345' }, defaults: { nom: 'Employé Test', role: 'user', hash_mdp: userPwd, actif: true } });

  const port = Number(process.env.PORT || 3001);
  app.listen(port, () => console.log(`Backend running on port ${port}`));
}

start().catch(err => { console.error(err); process.exit(1); });
