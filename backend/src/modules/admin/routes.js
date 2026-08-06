// backend/routes/admin.js
'use strict';

const express = require('express');
const router = express.Router();
const { APP_NAME } = require('../../../config/branding');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { body, param } = require('express-validator');
const { requireAuth, requirePermission, requireOrganizationAccess, orgScope } = require('../../../middleware/auth');
const { PERMISSIONS, USER_ROLE_VALUES } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const { User, Setting, Organization } = require('../../../models');

const userCreateRules = [
  body('matricule').trim().notEmpty().isLength({ max: 64 }).withMessage('Matricule requis'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Email invalide'),
  body('role').optional().isIn(USER_ROLE_VALUES.filter(r => r !== 'superadmin')).withMessage('Rôle invalide'),
  body('password').optional().isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
];

const userUpdateRules = [
  param('id').isInt({ min: 1 }).withMessage('ID invalide'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Email invalide'),
  body('role').optional().isIn(USER_ROLE_VALUES.filter(r => r !== 'superadmin')).withMessage('Rôle invalide'),
  body('password').optional().isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
];

/* ── Utilitaires ─────────────────────────────────────────────────────────── */

const DEFAULT_TZ     = process.env.TZ || 'Africa/Casablanca';
const DEFAULT_CUTOFF = process.env.CUTOFF_TIME || '10:30';
const DEFAULT_CANCEL = process.env.ALLOW_CANCEL_UNTIL || '10:00';
const DEFAULT_HERO   = process.env.DEFAULT_HERO_URL || '/brand/ifilino_dark.png';
const DEFAULT_LOGO   = process.env.DEFAULT_LOGO_URL || '/brand/ifilino_light.png';

function isHHMM(v) { return typeof v === 'string' && /^[0-2]\d:[0-5]\d$/.test(v); }
function isHexColor(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }
function cleanNullable(v) {
  if (v === undefined) return undefined;
  const s = String(v || '').trim();
  return s || null;
}

function getPublicBase(req) {
  const envBase = process.env.PUBLIC_BASE_URL;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function absolutizeMaybe(u, req) {
  if (u == null) return null;
  let s = String(u).trim();
  if (!s) return null;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(s) && /\/+$/.test(s)) s = s.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(s)) return s;
  if (!s.startsWith('/')) s = '/' + s;
  return getPublicBase(req) + s;
}

async function readRawSettings(orgId) {
  const rows = await Setting.findAll({ where: { organization_id: orgId }, attributes: ['key', 'value'] });
  const dict = {};
  for (const r of rows) dict[r.key] = r.value;
  if (dict.hero_mage_url && !dict.hero_image_url) dict.hero_image_url = dict.hero_mage_url;
  return dict;
}

function buildSettingsResponse(dict, req) {
  const cutoff_time       = dict.cutoff_time       || DEFAULT_CUTOFF;
  const allow_cancel_until = dict.allow_cancel_until || DEFAULT_CANCEL;
  let hero_raw = dict.hero_image_url ?? null;
  if (!hero_raw || /^null|undefined$/i.test(String(hero_raw))) hero_raw = DEFAULT_HERO;
  const hero_image_url = absolutizeMaybe(hero_raw, req);
  let logo_raw = dict.brand_logo_url ?? null;
  if (!logo_raw || /^null|undefined$/i.test(String(logo_raw))) logo_raw = DEFAULT_LOGO;
  const brand_logo_url = absolutizeMaybe(logo_raw, req);
  const brand_name = dict.brand_name || APP_NAME;
  return { cutoff_time, allow_cancel_until, hero_image_url, brand_name, brand_logo_url };
}

async function upsertSetting(key, value, orgId) {
  if (value === undefined) return;
  const [s, created] = await Setting.findOrCreate({ where: { key, organization_id: orgId }, defaults: { value, organization_id: orgId } });
  if (!created) { s.value = value; await s.save(); }
}

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ── Protection commune ──────────────────────────────────────────────────── */
// admin + manager ont accès ; superadmin aussi via requireOrganizationAccess
router.use(requireAuth, requireOrganizationAccess);

/* ── Utilisateurs ─────────────────────────────────────────────────────────── */

// GET /api/admin/users
router.get('/users', requirePermission(PERMISSIONS.USERS_MANAGE), ah(async (req, res) => {
  const scope = orgScope(req);
  const users = await User.findAll({
    where: scope,
    order: [['matricule', 'ASC']],
    attributes: ['id', 'matricule', 'nom', 'email', 'role', 'actif', 'organization_id', 'createdAt']
  });
  res.json({ users });
}));

// POST /api/admin/users
router.post('/users', requirePermission(PERMISSIONS.USERS_MANAGE), userCreateRules, validate, ah(async (req, res) => {
  const { matricule, nom, email, role = 'user', password = 'changeme', actif = true } = req.body || {};
  if (!matricule) return res.status(400).json({ error: 'matricule requis' });

  const allowedRoles = USER_ROLE_VALUES.filter(r => r !== 'superadmin');
  if (role && !allowedRoles.includes(role)) return res.status(400).json({ error: 'role invalide' });

  if (email) {
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ error: 'email déjà utilisé' });
  }

  const orgId = req.user.role === 'superadmin' ? (req.body.organization_id || null) : req.user.organization_id;
  const hash_mdp = await bcrypt.hash(password, 10);
  const u = await User.create({ matricule, nom, email, role, hash_mdp, actif: !!actif, organization_id: orgId });
  res.json({ ok: true, id: u.id });
}));

// PATCH /api/admin/users/:id
router.patch('/users/:id', requirePermission(PERMISSIONS.USERS_MANAGE), userUpdateRules, validate, ah(async (req, res) => {
  const scope = orgScope(req);
  const u = await User.findOne({ where: { id: req.params.id, ...scope } });
  if (!u) return res.status(404).json({ error: 'introuvable' });

  const { nom, email, role, actif, password } = req.body || {};
  const allowedRoles = USER_ROLE_VALUES.filter(r => r !== 'superadmin');
  if (role && !allowedRoles.includes(role)) return res.status(400).json({ error: 'role invalide' });

  if (email && email !== u.email) {
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ error: 'email déjà utilisé' });
  }

  if (nom !== undefined)   u.nom  = nom;
  if (email !== undefined) u.email = email;
  if (role !== undefined)  u.role  = role;
  if (actif !== undefined) u.actif = !!actif;
  if (password)            u.hash_mdp = await bcrypt.hash(password, 10);

  await u.save();
  res.json({ ok: true });
}));

// DELETE /api/admin/users/:id
router.delete('/users/:id', requirePermission(PERMISSIONS.USERS_MANAGE), ah(async (req, res) => {
  const scope = orgScope(req);
  const u = await User.findOne({ where: { id: req.params.id, ...scope } });
  if (!u) return res.status(404).json({ error: 'introuvable' });
  await u.destroy();
  res.json({ ok: true });
}));

// POST /api/admin/users/:id/activate
router.post('/users/:id/activate', requirePermission(PERMISSIONS.USERS_MANAGE), ah(async (req, res) => {
  const scope = orgScope(req);
  const user = await User.findOne({ where: { id: req.params.id, ...scope } });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  user.actif = true;
  await user.save();
  return res.json({ ok: true });
}));

// POST /api/admin/users/:id/reject
router.post('/users/:id/reject', requirePermission(PERMISSIONS.USERS_MANAGE), ah(async (req, res) => {
  const scope = orgScope(req);
  const user = await User.findOne({ where: { id: req.params.id, ...scope } });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  await user.destroy();
  return res.json({ ok: true });
}));

/* ── Paramètres ──────────────────────────────────────────────────────────── */

// GET /api/admin/settings
router.get('/settings', requirePermission(PERMISSIONS.SETTINGS_MANAGE), ah(async (req, res) => {
  const orgId = req.user.organization_id;
  const dict = await readRawSettings(orgId);
  const settings = buildSettingsResponse(dict, req);
  res.json({ settings, timezone: DEFAULT_TZ });
}));

// PUT /api/admin/settings
router.put('/settings', requirePermission(PERMISSIONS.SETTINGS_MANAGE), ah(async (req, res) => {
  const { cutoff_time, allow_cancel_until, hero_image_url, brand_name, brand_logo_url } = req.body || {};
  const orgId = req.user.organization_id;

  if (cutoff_time !== undefined && !isHHMM(cutoff_time))
    return res.status(400).json({ error: 'cutoff_time invalide (HH:MM)' });
  if (allow_cancel_until !== undefined && !isHHMM(allow_cancel_until))
    return res.status(400).json({ error: 'allow_cancel_until invalide (HH:MM)' });

  await upsertSetting('cutoff_time', cutoff_time, orgId);
  await upsertSetting('allow_cancel_until', allow_cancel_until, orgId);

  if (hero_image_url !== undefined) {
    if (hero_image_url && !/^https?:\/\//i.test(hero_image_url) && !hero_image_url.startsWith('/uploads/') && !hero_image_url.startsWith('/img/'))
      return res.status(400).json({ error: 'hero_image_url invalide' });
    const cleaned = (hero_image_url && hero_image_url.replace(/\/+$/, '')) || null;
    await upsertSetting('hero_image_url', cleaned, orgId);
  }

  if (brand_name !== undefined) await upsertSetting('brand_name', cleanNullable(brand_name) || APP_NAME, orgId);
  if (brand_logo_url !== undefined) {
    if (brand_logo_url && !/^https?:\/\//i.test(brand_logo_url) && !brand_logo_url.startsWith('/uploads/') && !brand_logo_url.startsWith('/brand/') && !brand_logo_url.startsWith('/restobook/brand/'))
      return res.status(400).json({ error: 'brand_logo_url invalide' });
    const cleaned = (brand_logo_url && brand_logo_url.replace(/\/+$/, '')) || null;
    await upsertSetting('brand_logo_url', cleaned, orgId);
  }
  res.json({ ok: true });
}));

/* ── Upload image héro ───────────────────────────────────────────────────── */

const brandingDir = path.join(__dirname, '../../../uploads', 'branding');
if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });

const storageBranding = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brandingDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
    cb(null, `${req.brandingKind || 'hero'}_${Date.now()}_${safe}`);
  }
});
const uploadBranding = multer({
  storage: storageBranding,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.mimetype);
    cb(ok ? null : new Error('Type de fichier non supporté'), ok);
  }
});

// POST /api/admin/branding/hero
router.post('/branding/hero', requirePermission(PERMISSIONS.BRANDING_MANAGE), (req, res, next) => { req.brandingKind = 'hero'; next(); }, uploadBranding.single('image'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  const webPath = `/uploads/branding/${req.file.filename}`.replace(/\\/g, '/');
  await upsertSetting('hero_image_url', webPath, req.user.organization_id);
  return res.json({ ok: true, hero_image_url: absolutizeMaybe(webPath, req) });
}));

// POST /api/admin/branding/logo
router.post('/branding/logo', requirePermission(PERMISSIONS.BRANDING_MANAGE), (req, res, next) => { req.brandingKind = 'logo'; next(); }, uploadBranding.single('image'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  const webPath = `/uploads/branding/${req.file.filename}`.replace(/\\/g, '/');
  await upsertSetting('brand_logo_url', webPath, req.user.organization_id);
  return res.json({ ok: true, brand_logo_url: absolutizeMaybe(webPath, req) });
}));

module.exports = router;
