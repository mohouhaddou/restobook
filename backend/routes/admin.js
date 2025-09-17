// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/user');
const Setting = require('../models/setting');

router.use(requireAuth, requireRole('admin'));

/* ---------- Utilisateurs (CRUD) ---------- */
router.get('/users', async (req, res) => {
  const users = await User.findAll({
    order: [['matricule','ASC']],
    attributes: ['id','matricule','nom','email','role','actif','createdAt']
  });
  res.json({ users });
});

router.post('/users', async (req, res) => {
  const { matricule, nom, email, role = 'user', password = 'changeme', actif = true } = req.body || {};
  if (!matricule) return res.status(400).json({ error: 'matricule requis' });
  if (!['admin','manager','user'].includes(role)) return res.status(400).json({ error: 'role invalide' });
  const hash_mdp = await bcrypt.hash(password, 10);
  const u = await User.create({ matricule, nom, email, role, hash_mdp, actif });
  res.json({ ok: true, id: u.id });
});

router.patch('/users/:id', async (req, res) => {
  const u = await User.findByPk(req.params.id);
  if (!u) return res.status(404).json({ error: 'introuvable' });
  const { nom, email, role, actif, password } = req.body || {};
  if (role && !['admin','manager','user'].includes(role)) return res.status(400).json({ error: 'role invalide' });
  if (nom !== undefined) u.nom = nom;
  if (email !== undefined) u.email = email;
  if (role !== undefined) u.role = role;
  if (actif !== undefined) u.actif = !!actif;
  if (password) u.hash_mdp = await bcrypt.hash(password, 10);
  await u.save();
  res.json({ ok: true });
});

router.delete('/users/:id', async (req, res) => {
  const u = await User.findByPk(req.params.id);
  if (!u) return res.status(404).json({ error: 'introuvable' });
  await u.destroy();
  res.json({ ok: true });
});

/* ---------- Paramètres (heures + héro) ---------- */
function isHHMM(v){ return typeof v === 'string' && /^[0-2]\d:[0-5]\d$/.test(v); }
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
const absolutize = (p) => (p && !/^https?:\/\//i.test(p)) ? `${PUBLIC_BASE}${p.startsWith('/')?p:`/${p}`}` : p;

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  const rows = await Setting.findAll({ attributes: ['key','value'] });
  const dict = {};
  for (const r of rows) dict[r.key] = r.value;

  dict.cutoff_time = dict.cutoff_time || process.env.CUTOFF_TIME || '10:30';
  dict.allow_cancel_until = dict.allow_cancel_until || process.env.ALLOW_CANCEL_UNTIL || '10:00';
  // image héro par défaut (si aucune personnalisée)
  dict.hero_image_url = dict.hero_image_url || '/img/hero.jpg';

  // Vous pouvez renvoyer absolu si nécessaire :
  const response = {
    cutoff_time: dict.cutoff_time,
    allow_cancel_until: dict.allow_cancel_until,
    hero_image_url: absolutize(dict.hero_image_url),
  };

  res.json({ settings: response, timezone: process.env.TZ || 'Africa/Casablanca' });
});

// PUT /api/admin/settings  { cutoff_time?, allow_cancel_until?, hero_image_url? }
router.put('/settings', async (req, res) => {
  const { cutoff_time, allow_cancel_until, hero_image_url } = req.body || {};
  if (cutoff_time !== undefined && !isHHMM(cutoff_time))
    return res.status(400).json({ error: 'cutoff_time invalide (HH:MM)' });
  if (allow_cancel_until !== undefined && !isHHMM(allow_cancel_until))
    return res.status(400).json({ error: 'allow_cancel_until invalide (HH:MM)' });

  const upsert = async (key, value) => {
    if (value === undefined) return;
    const [s, created] = await Setting.findOrCreate({ where: { key }, defaults: { value } });
    if (!created) { s.value = value; await s.save(); }
  };

  await upsert('cutoff_time', cutoff_time);
  await upsert('allow_cancel_until', allow_cancel_until);

  // accepter /uploads/... ou http(s)://...
  if (hero_image_url !== undefined) {
    if (hero_image_url && !/^https?:\/\//i.test(hero_image_url) && !hero_image_url.startsWith('/uploads/'))
      return res.status(400).json({ error: 'hero_image_url doit être une URL http(s) ou un chemin /uploads/...' });
    await upsert('hero_image_url', hero_image_url || '/img/hero.jpg');
  }

  res.json({ ok: true });
});

/* ---------- Upload de l'image héro ---------- */
const brandingDir = path.join(__dirname, '..', 'uploads', 'branding');
if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });

const storageBranding = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brandingDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
    cb(null, `hero_${Date.now()}_${safe}`);
  }
});
const uploadBranding = multer({
  storage: storageBranding,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Type de fichier non supporté'), ok);
  }
});

// POST /api/admin/branding/hero  (multipart/form-data, champ "image")
router.post('/branding/hero', uploadBranding.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    const webPath = `/uploads/branding/${req.file.filename}`.replace(/\\/g,'/');

    // persistons dans settings.hero_image_url
    const [s, created] = await Setting.findOrCreate({ where: { key: 'hero_image_url' }, defaults: { value: webPath } });
    if (!created) { s.value = webPath; await s.save(); }

    return res.json({ ok: true, hero_image_url: absolutize(webPath) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Upload héro impossible' });
  }
});

module.exports = router;
