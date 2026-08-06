// backend/routes/superadmin.js — Gestion globale (SuperAdmin uniquement)
'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const { Organization, User, Reservation, MenuItem, Setting, Business, UserSubscription, PushToken, DeliveryPerson } = require('../../../models');

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
    { key: 'brand_logo_url', value: '/brand/ifilino_light.png', organization_id: org.id }
  ]);

  // Créer le compte Owner si demandé
  let owner = null;
  if (owner_matricule) {
    const hash = await bcrypt.hash(owner_password, 10);
    owner = await User.create({
      matricule: owner_matricule,
      nom: `Owner ${name}`,
      role: type === 'canteen' ? 'canteen_admin' : type === 'pharmacie' ? 'pharmacy_owner' : 'restaurant_owner',
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

/* ── Inscriptions professionnelles en attente ─────────────────────────── */

// GET /api/superadmin/registrations?status=pending
router.get('/registrations', ah(async (req, res) => {
  const { status = 'pending' } = req.query;
  const { Op } = require('sequelize');

  // Les inscriptions en attente = orgs avec registration_status:pending + user inactif
  const orgs = await Organization.findAll({
    where: { active: false },
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'users', attributes: ['id', 'nom', 'email', 'phone', 'role', 'actif', 'createdAt'] }],
    limit: 100,
  });

  const pending = orgs
    .filter(o => o.settings?.registration_status === status)
    .map(o => {
      const owner = (o.users || []).find(u => !u.actif && u.role !== 'customer');
      return {
        org_id:      o.id,
        org_name:    o.name,
        org_type:    o.type,
        module_type: o.settings?.module_type,
        precise_type: o.settings?.precise_type,
        plan:        o.plan,
        city:        o.city,
        address:     o.address,
        owner: owner ? { id: owner.id, nom: owner.nom, email: owner.email, phone: owner.phone, role: owner.role } : null,
        owner_info:  o.settings?.owner || null,
        created_at:  o.createdAt,
      };
    });

  res.json({ registrations: pending, count: pending.length });
}));

// POST /api/superadmin/registrations/:orgId/approve
router.post('/registrations/:orgId/approve', ah(async (req, res) => {
  const { orgId } = req.params;
  const { note } = req.body || {};

  const org = await Organization.findByPk(orgId, {
    include: [{ model: User, as: 'users', attributes: ['id', 'actif', 'role', 'nom', 'email', 'organization_id'] }],
  });
  if (!org) return res.status(404).json({ error: 'Organisation introuvable' });
  if (org.settings?.registration_status !== 'pending') {
    return res.status(400).json({ error: `Statut actuel : ${org.settings?.registration_status || 'inconnu'}` });
  }

  const jwt  = require('jsonwebtoken');
  const NS   = require('../../../services/NotificationService');
  const module_type = org.settings?.module_type || 'RESTAURANT';
  const isPublic    = module_type !== 'CANTEEN';

  // Activer l'organisation
  await org.update({
    active:         true,
    is_marketplace: isPublic,
    settings: { ...org.settings, registration_status: 'approved', approved_at: new Date().toISOString(), approved_by: req.user.id, approval_note: note || null },
  });

  // Activer l'utilisateur responsable
  const owner = (org.users || []).find(u => !u.actif && ['restaurant_owner','canteen_admin','pharmacy_owner'].includes(u.role));
  let token = null;
  if (owner) {
    await User.update({ actif: true }, { where: { id: owner.id } });
    token = jwt.sign(
      { id: owner.id, matricule: owner.email, role: owner.role, nom: owner.nom, organization_id: org.id, session_id: require('crypto').randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
  }

  // Activer l'abonnement
  await UserSubscription.update({ status: org.plan === 'trial' ? 'trial' : 'active' }, { where: { organization_id: org.id } });

  // Approuver le Business
  await Business.update(
    { status: 'approved', is_public: isPublic, reviewed_by: req.user.id, reviewed_at: new Date() },
    { where: { organization_id: org.id } }
  );

  // Notifier le propriétaire
  if (owner) {
    NS.create({
      type: 'PRO_REGISTRATION_APPROVED', recipient_id: owner.id, organization_id: org.id,
      title: '✅ Votre espace professionnel est activé !',
      message: `Bienvenue ${owner.nom || ''} ! Votre espace "${org.name}" a été validé. Vous pouvez maintenant vous connecter.`,
      entity_type: 'ACCOUNT', priority: 'high',
    }).catch(() => {});
  }

  res.json({ ok: true, message: `"${org.name}" approuvé`, org_id: org.id, owner_activated: !!owner });
}));

// POST /api/superadmin/registrations/:orgId/reject
router.post('/registrations/:orgId/reject', ah(async (req, res) => {
  const { orgId }  = req.params;
  const { reason } = req.body || {};
  if (!reason?.trim()) return res.status(400).json({ error: 'Une raison de rejet est requise' });

  const org = await Organization.findByPk(orgId, {
    include: [{ model: User, as: 'users', attributes: ['id', 'nom', 'email', 'role', 'actif'] }],
  });
  if (!org) return res.status(404).json({ error: 'Organisation introuvable' });
  if (org.settings?.registration_status !== 'pending') {
    return res.status(400).json({ error: `Statut actuel : ${org.settings?.registration_status || 'inconnu'}` });
  }

  const NS = require('../../../services/NotificationService');

  await org.update({
    settings: { ...org.settings, registration_status: 'rejected', rejected_at: new Date().toISOString(), rejected_by: req.user.id, rejection_reason: reason },
  });

  await Business.update(
    { status: 'rejected', rejection_reason: reason, reviewed_by: req.user.id, reviewed_at: new Date() },
    { where: { organization_id: org.id } }
  );

  const owner = (org.users || []).find(u => ['restaurant_owner','canteen_admin','pharmacy_owner'].includes(u.role));
  if (owner) {
    NS.create({
      type: 'PRO_REGISTRATION_REJECTED', recipient_id: owner.id, organization_id: org.id,
      title: '❌ Demande d\'inscription refusée',
      message: `Votre demande pour "${org.name}" a été refusée. Motif : ${reason}`,
      entity_type: 'ACCOUNT', priority: 'high',
    }).catch(() => {});
  }

  res.json({ ok: true, message: `"${org.name}" rejeté`, reason });
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

/* ── Push tokens (debug/admin) ─────────────────────────────────────────── */

// GET /api/superadmin/push-tokens?user_id=&role=&is_active=
router.get('/push-tokens', ah(async (req, res) => {
  const { user_id, role, is_active } = req.query;
  const where = {};
  if (user_id) where.user_id = Number(user_id);
  if (role) where.role = role;
  if (is_active !== undefined) where.is_active = is_active === 'true';

  const tokens = await PushToken.findAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'matricule', 'nom', 'role'] },
      { model: Business, as: 'business', attributes: ['id', 'name'] },
      { model: DeliveryPerson, as: 'driver', attributes: ['id'] },
    ],
    order: [['last_seen_at', 'DESC']],
    limit: 500,
  });

  res.json({
    tokens: tokens.map(t => ({
      id: t.id,
      user_id: t.user_id,
      user_name: t.user?.nom || t.user?.matricule || null,
      role: t.role,
      business_id: t.business_id,
      business_name: t.business?.name || null,
      driver_id: t.driver_id,
      device_id: t.device_id,
      platform: t.platform,
      session_id: t.session_id,
      is_active: t.is_active,
      last_seen_at: t.last_seen_at,
      revoked_at: t.revoked_at,
      created_at: t.createdAt,
    })),
  });
}));

// PATCH /api/superadmin/push-tokens/:id/deactivate
router.patch('/push-tokens/:id/deactivate', ah(async (req, res) => {
  const token = await PushToken.findByPk(req.params.id);
  if (!token) return res.status(404).json({ error: 'Token introuvable' });
  await token.update({ is_active: false, revoked_at: new Date() });
  res.json({ ok: true });
}));

module.exports = router;
