'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
require('dotenv').config();
const BRANDING = require('./src/config/branding');

const app = express();
const httpServer = http.createServer(app);
app.set('trust proxy', 1);

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
app.use('/api/auth/google', rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion Google. Réessayez dans 15 minutes.' }
}));
app.use('/api', rateLimit({
  windowMs: 60 * 1000, max: 300,
  skip: (req) => req.path === '/health',
  message: { error: 'Trop de requêtes. Ralentissez.' }
}));

// ── Uploads statiques ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.get('/discover-social-image', async (req, res) => {
  const src = String(req.query.src || '');
  if (!/^\/uploads\/discover\/[A-Za-z0-9_.-]+\.(webp|png|jpe?g)$/i.test(src)) {
    return res.status(400).send('Invalid image');
  }

  const basename = path.basename(src);
  const inputPath = path.join(uploadDir, 'discover', basename);
  const outputDir = path.join(uploadDir, 'discover-social');
  const outputPath = path.join(outputDir, `${basename.replace(/\.[^.]+$/, '')}.jpg`);

  try {
    if (!fs.existsSync(inputPath)) return res.status(404).send('Image not found');
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputDir, { recursive: true });
      const sharp = require('sharp');
      await sharp(inputPath)
        .resize(1200, 630, { fit: 'cover', position: 'centre' })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(outputPath);
    }
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('jpg');
    return res.sendFile(outputPath);
  } catch (err) {
    console.error('[Discover social image]', err);
    return res.status(500).send('Image conversion failed');
  }
});

app.use('/uploads', express.static(uploadDir));
app.use('/brand',   express.static(path.join(__dirname, 'public', 'brand')));
// Sitemaps dynamiques — montés AVANT express.static ci-dessous : sinon un
// fichier sitemap*.xml resté sur disque (ancien statique) serait servi en
// priorité et la génération dynamique ne serait jamais atteinte.
app.use(require('./src/modules/seo/sitemapRoutes'));
// SEO — robots & sitemap servis à la racine du sous-chemin Nginx
// redirect:false — sinon un dossier statique portant le même nom qu'une route
// SEO (ex: public/play/ads.txt) fait rediriger express.static vers l'URL avec
// slash final AVANT même d'atteindre ssrRouter plus bas, empêchant toute page
// /play de recevoir son propre title/description/favicon (bug constaté en
// vérification live : GET /play renvoyait un 301 "Redirecting" au lieu de la
// page SEO Play).
app.use(express.static(path.join(__dirname, 'public'), { index: false, redirect: false }));

// ── Modèles ──────────────────────────────────────────────────────────────────
const {
  sequelize,
  User, MenuItem, DailyMenu, DailyMenuItem,
  Reservation, Setting, Notification, Organization,
  DeliveryPerson,
} = require('./models');

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, version: '3.0.0' }));
app.use('/api', require('./routes'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/subscriptions',  require('./routes/subscriptions'));
app.use('/api', require('./routes/public'));

// ── SEO — pages publiques SSR (sitemaps montés plus haut, avant express.static) ──
// Monté après les routes /api/* et avant le fallback SPA ci-dessous : toute
// route non reconnue ici (ou dont la ressource n'existe pas en base) appelle
// next() et retombe donc sur exactement le même comportement qu'avant cette
// fonctionnalité (index.html) — le back-office authentifié n'est jamais
// concerné. Voir backend/src/modules/seo/.
app.use(require('./src/modules/seo/ssrRouter'));

// ── Fallback SPA — remplace l'ancien `try_files ... /index.html` de nginx
// (voir nginx/ifilino.conf) pour toute page non gérée par le SSR ci-dessus :
// dashboard, POS, infra monitoring, etc. Comportement identique à avant.
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error handler centralisé ──────────────────────────────────────────────────
app.use(require('./src/middleware/errorHandler'));

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: ALLOWED, methods: ['GET','POST'] },
  // Chemin aligné sur le bloc nginx `location ^~ /api/` (seul bloc qui relaie
  // déjà les en-têtes Upgrade/Connection pour le WebSocket) — avec le chemin
  // par défaut '/socket.io', nginx ne route la requête nulle part (elle
  // retombe sur le catch-all SPA) et le temps réel ne fonctionne jamais en
  // production. Le frontend (OrdersPage.jsx, useInfraSocket.js) attend déjà
  // ce chemin via VITE_API_URL + '/socket.io'.
  path: '/api/socket.io',
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

  // Rejoindre la room du centre de supervision Infrastructure — contrairement
  // aux joins ci-dessus, celui-ci est authentifié (métriques serveur sensibles) :
  // le JWT est vérifié et le rôle superadmin exigé avant tout socket.join().
  socket.on('superadmin:join', (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role === 'superadmin') {
        socket.join('superadmin:infra');
        socket.join('superadmin:delivery');
        socket.join('superadmin:ai-import');
      }
    } catch { /* token invalide/expiré — aucune room rejointe, silencieux */ }
  });

  // ── Module delivery (tracking GPS temps réel, Phase 2) ──────────────────────
  // Comme superadmin:join ci-dessus (et contrairement à restaurant:join/track:join
  // qui restent volontairement publics pour le suivi invité) : le JWT est vérifié
  // côté serveur et l'id de room dérivé du token, jamais fourni par le client.
  socket.on('courier:join', async (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role !== 'delivery' && payload.role !== 'pharmacy_delivery_manager') return;
      const dp = await DeliveryPerson.findOne({ where: { user_id: payload.id }, include: [{ model: User, as: 'user', attributes: ['nom'] }] });
      if (!dp) return;
      socket.data.deliveryPersonId = dp.id;
      socket.data.deliveryUserId = payload.id;
      // Récupéré une fois au join plutôt qu'à chaque ping GPS (toutes les 2-5s) —
      // évite une jointure supplémentaire sur le chemin le plus chaud du module.
      socket.data.courierFirstName = dp.user?.nom ? dp.user.nom.split(' ')[0] : null;
      socket.join(`courier:${dp.id}`);
    } catch { /* token invalide/expiré — aucune room rejointe, silencieux */ }
  });

  // Room personnelle pour le badge de notifications temps réel (voir
  // NotificationService.create) — JWT vérifié côté serveur, comme
  // superadmin:join/courier:join, jamais un id fourni tel quel par le client.
  socket.on('user:join', (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload?.id) socket.join(`user:${payload.id}`);
    } catch { /* token invalide/expiré — aucune room rejointe, silencieux */ }
  });

  socket.on('business:delivery:join', (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!payload.organization_id) return;
      socket.join(`org_delivery:${payload.organization_id}`);
    } catch { /* token invalide/expiré — aucune room rejointe, silencieux */ }
  });

  // Ping GPS — n'accepte jamais un delivery_person_id fourni par le client :
  // seul un socket ayant déjà réussi 'courier:join' (donc déjà authentifié)
  // peut pousser une position, résolue depuis socket.data.
  socket.on('courier:position:push', async (position) => {
    if (!socket.data.deliveryPersonId) return;
    try {
      const lat = Number(position?.lat), lng = Number(position?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      const dp = await DeliveryPerson.findByPk(socket.data.deliveryPersonId);
      if (!dp) return;

      const { recordPing, buildPositionPayload } = require('./src/modules/delivery/services/locationService');
      const { trackingCode } = require('./src/modules/delivery/services/orderEngine');
      const { activeAssignment } = await recordPing(dp, {
        lat, lng,
        speed_kmh: position?.speed_kmh, heading_deg: position?.heading_deg, accuracy_m: position?.accuracy_m,
      });

      const payload = buildPositionPayload({
        deliveryPersonId: dp.id, lat, lng,
        speed_kmh: position?.speed_kmh, heading_deg: position?.heading_deg,
        activeAssignment, courierFirstName: socket.data.courierFirstName,
      });
      if (activeAssignment && activeAssignment.order) {
        io.to(`track:${trackingCode(activeAssignment.order)}`).emit('courier:position', payload);
        io.to(`org_delivery:${activeAssignment.order.organization_id}`).emit('courier:position', payload);
      }
      io.to('superadmin:delivery').emit('courier:position', payload);
    } catch { /* ping invalide — ignoré silencieusement, le prochain arrivera dans 2-5s */ }
  });

  socket.on('disconnect', () => {});
});

// Collecte centralisée Infrastructure — un seul poller pour tous les
// SuperAdmin connectés, voir src/modules/infra/poller.js.
require('./src/modules/infra/poller').start(io);

// Régénération périodique des sitemaps SEO (30 min) — même logique de poller
// in-process que les jobs ci-dessous, pas de nouvelle dépendance cron.
require('./src/modules/seo/sitemapService').startPeriodicRefresh();

// Planification des articles Gaming Hub (draft -> published à scheduled_at) —
// même logique de poller in-process, vérifié toutes les 60s.
require('./src/modules/gaminghub/schedulerJob').start();
require('./src/modules/comics/schedulerJob').start();

// Balayage périodique des offres de dispatch expirées (Phase 3) — pas de
// timer par offre : plus simple et auto-réparant si le process redémarre
// pendant qu'une offre est en attente (voir dispatchEngine.js).
require('./src/modules/delivery/services/dispatchEngine').startSweep();

// Alertes d'expiration des documents livreur (Phase 6) — même logique de
// poller in-process, pas de nouvelle dépendance cron/queue.
require('./src/modules/delivery/services/documentExpiryJob').start();

// Purge des notifications expirées (Notification Center Phase 1) — même
// logique de poller in-process.
require('./src/modules/notifications/expiryJob').start();

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
    require('./src/modules/media/mediaMaintenanceJob').start();
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
    await upsertSettingIfMissing('brand_name', org.name || BRANDING.APP_NAME, org.id);
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
