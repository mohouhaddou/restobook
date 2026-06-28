'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : true;

app.use(cors({ origin: ALLOWED, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
}));
app.use('/api/auth/signup', rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: { error: 'Trop de tentatives d\'inscription. Réessayez plus tard.' }
}));
app.use('/api', rateLimit({
  windowMs: 60 * 1000, max: 300,
  skip: (req) => req.path === '/health',
  message: { error: 'Trop de requêtes. Ralentissez.' }
}));

// ── Uploads statiques ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));
app.use('/brand', express.static(path.join(__dirname, 'public', 'brand')));

// ── Modèles ──────────────────────────────────────────────────────────────────
const {
  sequelize,
  User, MenuItem, DailyMenu, DailyMenuItem,
  Reservation, Setting, Notification, Organization
} = require('./models');

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, version: '3.0.0' }));
app.use('/api', require('./routes'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/subscriptions',  require('./routes/subscriptions'));
app.use('/api', require('./routes/public'));

// ── Error handler centralisé ──────────────────────────────────────────────────
app.use(require('./middleware/errorHandler'));

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: ALLOWED, methods: ['GET','POST'] },
  path: '/socket.io',
});
global.io = io;

io.on('connection', (socket) => {
  // Rejoindre la room d'une organisation (restaurant dashboard)
  socket.on('restaurant:join', (orgId) => {
    if (orgId) socket.join(`org:${orgId}`);
  });

  // Rejoindre la room de suivi d'une commande (client)
  socket.on('track:join', (pickupCode) => {
    if (pickupCode) socket.join(`track:${String(pickupCode).toUpperCase()}`);
  });

  socket.on('disconnect', () => {});
});

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function waitDb(maxRetries = 10) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await sequelize.authenticate();
      console.log(`[${new Date().toISOString()}] DB auth OK`);
      return;
    } catch (e) {
      console.log(`[${new Date().toISOString()}] Tentative DB ${i}/${maxRetries}: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Impossible de se connecter à la DB');
}

async function start() {
  await waitDb();

  const isPrimary = process.env.PM2_INSTANCE_INDEX === '0' || !process.env.PM2_INSTANCE_INDEX;
  if (isPrimary) {
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync();
      console.log(`[${new Date().toISOString()}] DB synced (dev only)`);
    }
    await seed();
  }

  const port = Number(process.env.PORT || 3001);
  httpServer.listen(port, () => console.log(`[${new Date().toISOString()}] Backend + Socket.IO on port ${port}`));
}

async function upsertSettingIfMissing(key, value, orgId) {
  await Setting.findOrCreate({
    where: { key, organization_id: orgId },
    defaults: { key, value, organization_id: orgId }
  });
}

async function seedOrganizationBranding() {
  const orgs = await Organization.findAll({ attributes: ['id', 'name', 'type'] });
  for (const org of orgs) {
    const isRestaurant = org.type !== 'canteen';
    await upsertSettingIfMissing('brand_name', org.name || 'RestoBook', org.id);
    await upsertSettingIfMissing('brand_logo_url', '/brand/restobook_light.png', org.id);
    await upsertSettingIfMissing('theme_primary', isRestaurant ? '#B45309' : '#EA580C', org.id);
    await upsertSettingIfMissing('theme_accent',  isRestaurant ? '#2563EB' : '#16A34A', org.id);
  }
}

async function seed() {
  const bcrypt = require('bcryptjs');

  const [org] = await Organization.findOrCreate({
    where: { slug: 'default' },
    defaults: { name: 'Organisation par défaut', type: 'canteen', plan: 'pro', active: true }
  });

  const settingsDefaults = [
    { key: 'cutoff_time',       value: process.env.CUTOFF_TIME || '10:30' },
    { key: 'allow_cancel_until', value: process.env.ALLOW_CANCEL_UNTIL || '10:00' },
  ];
  for (const { key, value } of settingsDefaults) {
    await Setting.findOrCreate({ where: { key, organization_id: org.id }, defaults: { value, organization_id: org.id } });
  }

  await seedOrganizationBranding();

  const items = [
    { libelle: 'Tajine poulet',   description: 'Citron confit/olives', type: 'plat' },
    { libelle: 'Poisson grillé',  description: 'Légumes vapeur',       type: 'plat' },
    { libelle: 'Salade marocaine', description: 'Tomate/oignon/poivron', type: 'entrée' },
  ];
  for (const it of items) {
    await MenuItem.findOrCreate({
      where: { libelle: it.libelle, organization_id: org.id },
      defaults: { ...it, organization_id: org.id }
    });
  }

  const accounts = [
    { matricule: 'superadmin', nom: 'Super Administrateur', role: 'superadmin', pwd: 'super123', orgId: null },
    { matricule: 'admin',      nom: 'Administrateur',       role: 'admin',      pwd: 'admin123',   orgId: org.id },
    { matricule: 'manager',    nom: 'Gestionnaire',          role: 'manager',    pwd: 'manager123', orgId: org.id },
    { matricule: 'E12345',     nom: 'Employé Test',          role: 'user',       pwd: 'test123',    orgId: org.id },
  ];
  for (const a of accounts) {
    const hash = await bcrypt.hash(a.pwd, 10);
    await User.findOrCreate({
      where: { matricule: a.matricule },
      defaults: { nom: a.nom, role: a.role, hash_mdp: hash, actif: true, organization_id: a.orgId }
    });
  }
}

start().catch(err => { console.error(err); process.exit(1); });
