// backend/routes/superadmin.js — Gestion globale (SuperAdmin uniquement)
'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { Organization, User, Reservation, MenuItem, Setting } = require('../models');

router.use(requireAuth, requireSuperAdmin);

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ── Organisations ─────────────────────────────────────────────────────── */

// GET /api/superadmin/organizations
router.get('/organizations', ah(async (req, res) => {
  const orgs = await Organization.findAll({
    order: [['name', 'ASC']],
    include: [{ model: User, as: 'users', attributes: ['id', 'role', 'actif'] }]
  });
  const payload = orgs.map(o => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    type: o.type,
    plan: o.plan,
    plan_expires_at: o.plan_expires_at,
    active: o.active,
    user_count: (o.users || []).length,
    active_users: (o.users || []).filter(u => u.actif).length,
    created_at: o.createdAt
  }));
  res.json({ organizations: payload });
}));

// POST /api/superadmin/organizations
router.post('/organizations', ah(async (req, res) => {
  const { slug, name, type = 'canteen', plan = 'trial', owner_matricule, owner_password = 'changeme' } = req.body || {};
  if (!slug || !name) return res.status(400).json({ error: 'slug et name requis' });
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'slug invalide (minuscules, chiffres, tirets)' });

  const exists = await Organization.findOne({ where: { slug } });
  if (exists) return res.status(409).json({ error: 'slug déjà utilisé' });

  const org = await Organization.create({ slug, name, type, plan, active: true });

  // Créer les settings par défaut
  await Setting.bulkCreate([
    { key: 'cutoff_time', value: '10:30', organization_id: org.id },
    { key: 'allow_cancel_until', value: '10:00', organization_id: org.id },
    { key: 'brand_name', value: name, organization_id: org.id },
    { key: 'brand_logo_url', value: '/brand/restobook_light.png', organization_id: org.id },
    { key: 'theme_primary', value: type === 'restaurant' ? '#B45309' : '#EA580C', organization_id: org.id },
    { key: 'theme_accent', value: type === 'restaurant' ? '#2563EB' : '#16A34A', organization_id: org.id }
  ]);

  // Créer le compte Owner si demandé
  let owner = null;
  if (owner_matricule) {
    const hash = await bcrypt.hash(owner_password, 10);
    owner = await User.create({
      matricule: owner_matricule,
      nom: `Owner ${name}`,
      role: type === 'canteen' ? 'canteen_admin' : 'restaurant_owner',
      hash_mdp: hash,
      actif: true,
      organization_id: org.id
    });
  }

  res.status(201).json({
    ok: true,
    organization: { id: org.id, slug: org.slug, name: org.name, type: org.type, plan: org.plan },
    owner: owner ? { id: owner.id, matricule: owner.matricule } : null
  });
}));

// PATCH /api/superadmin/organizations/:id
router.patch('/organizations/:id', ah(async (req, res) => {
  const org = await Organization.findByPk(req.params.id);
  if (!org) return res.status(404).json({ error: 'Organisation introuvable' });

  const { name, type, plan, plan_expires_at, active } = req.body || {};
  if (name !== undefined)           org.name            = name;
  if (type !== undefined)           org.type            = type;
  if (plan !== undefined)           org.plan            = plan;
  if (plan_expires_at !== undefined) org.plan_expires_at = plan_expires_at || null;
  if (active !== undefined)         org.active          = !!active;

  await org.save();
  res.json({ ok: true });
}));

// DELETE /api/superadmin/organizations/:id
router.delete('/organizations/:id', ah(async (req, res) => {
  const org = await Organization.findByPk(req.params.id);
  if (!org) return res.status(404).json({ error: 'Organisation introuvable' });
  if (org.slug === 'default') return res.status(400).json({ error: 'Impossible de supprimer l\'organisation par défaut' });

  // Stats avant suppression
  const userCount = await User.count({ where: { organization_id: org.id } });
  const resvCount = await Reservation.count({ where: { organization_id: org.id } });

  if (resvCount > 0 && !req.query.force) {
    return res.status(409).json({
      error: `Organisation non vide (${userCount} users, ${resvCount} réservations). Ajoutez ?force=true pour forcer.`
    });
  }

  // Supprimer toutes les données de l'org
  await Reservation.destroy({ where: { organization_id: org.id } });
  await MenuItem.destroy({ where: { organization_id: org.id } });
  await Setting.destroy({ where: { organization_id: org.id } });
  await User.destroy({ where: { organization_id: org.id } });
  await org.destroy();

  res.json({ ok: true, deleted: { users: userCount, reservations: resvCount } });
}));

// POST /api/superadmin/organizations/:id/suspend
router.post('/organizations/:id/suspend', ah(async (req, res) => {
  const org = await Organization.findByPk(req.params.id);
  if (!org) return res.status(404).json({ error: 'Organisation introuvable' });
  org.active = false;
  await org.save();
  res.json({ ok: true, message: `Organisation "${org.name}" suspendue` });
}));

// POST /api/superadmin/organizations/:id/restore
router.post('/organizations/:id/restore', ah(async (req, res) => {
  const org = await Organization.findByPk(req.params.id);
  if (!org) return res.status(404).json({ error: 'Organisation introuvable' });
  org.active = true;
  await org.save();
  res.json({ ok: true, message: `Organisation "${org.name}" réactivée` });
}));

/* ── Utilisateurs globaux ──────────────────────────────────────────────── */

// GET /api/superadmin/users  (tous les users de toutes les orgs)
router.get('/users', ah(async (req, res) => {
  const { org_id, role } = req.query;
  const where = {};
  if (org_id) where.organization_id = org_id;
  if (role)   where.role = role;

  const users = await User.findAll({
    where,
    include: [{ model: Organization, as: 'organization', attributes: ['id', 'slug', 'name'] }],
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'matricule', 'nom', 'email', 'role', 'actif', 'organization_id', 'createdAt'],
    limit: 200
  });
  res.json({ users });
}));

/* ── Stats globales ────────────────────────────────────────────────────── */

// GET /api/superadmin/stats
router.get('/stats', ah(async (req, res) => {
  const [orgCount, userCount, resvCount] = await Promise.all([
    Organization.count(),
    User.count({ where: { role: { [require('sequelize').Op.ne]: 'superadmin' } } }),
    Reservation.count()
  ]);
  const activeOrgs = await Organization.count({ where: { active: true } });

  res.json({
    organizations: { total: orgCount, active: activeOrgs, suspended: orgCount - activeOrgs },
    users: { total: userCount },
    reservations: { total: resvCount }
  });
}));

module.exports = router;
