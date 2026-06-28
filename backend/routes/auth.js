const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { User, Notification, Organization, UserSubscription, SubscriptionPlan } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getPermissionsForRole, normalizeRole } = require('../auth/permissions');
const validate = require('../middleware/validate');
const { Op } = require('sequelize');

const loginRules = [
  body('matricule').trim().notEmpty().withMessage('Matricule requis'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
];

const signupRules = [
  body('matricule').trim().notEmpty().isLength({ max: 64 }).withMessage('Matricule requis (max 64 car.)'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Email invalide'),
  body('nom').optional().trim().isLength({ max: 191 }).withMessage('Nom trop long'),
];

const changePwdRules = [
  body('current_password').notEmpty().withMessage('Mot de passe actuel requis'),
  body('new_password').isLength({ min: 6 }).withMessage('Nouveau mot de passe minimum 6 caractères'),
];

function serializeAuthUser(user, org = null) {
  if (!user) return null;
  return {
    id: user.id,
    matricule: user.matricule,
    nom: user.nom,
    email: user.email || null,
    role: user.role,
    normalized_role: normalizeRole(user.role),
    permissions: getPermissionsForRole(user.role),
    organization_id: user.organization_id || null,
    // Type de l'organisation : permet au frontend de différencier cantine vs restaurant
    org_type: org?.type || user.org_type || null,
    org_is_marketplace: org ? !!org.is_marketplace : null,
    org_is_internal:    org ? !!org.is_internal    : null,
  };
}

async function notifyAdminsNewUser(newUser) {
  const admins = await User.findAll({ where: { role: { [Op.in]: ['admin', 'organization_admin', 'canteen_admin'] }, actif: true }, attributes: ['id'] });
  if (!admins.length) return;
  const rows = admins.map(a => ({
    recipient_id: a.id,
    type: 'signup_request',
    title: 'Nouvelle demande d’inscription',
    message: `${newUser.nom || newUser.matricule} demande l’activation du compte.`,
    data: { user_id: newUser.id, matricule: newUser.matricule, nom: newUser.nom, email: newUser.email },
  }));
  await Notification.bulkCreate(rows);
}

router.post('/login', loginRules, validate, async (req, res) => {
  try {
    const { matricule, password } = req.body || {};
    if (!matricule || !password) return res.status(400).json({ error: 'Champs manquants' });

    // Accepte matricule OU email comme identifiant
    const identifier = String(matricule).trim();
    const user = await User.findOne({
      where: { [Op.or]: [{ matricule: identifier }, { email: identifier.toLowerCase() }] }
    });
    if (!user || !user.hash_mdp) return res.status(401).json({ error: 'Identifiants invalides' });

    if (!user.actif) {
      await bcrypt.compare(String(password), user.hash_mdp).catch(() => {});
      return res.status(403).json({ error: 'Votre compte est inactif. Veuillez contacter un administrateur.' });
    }

    const ok = await bcrypt.compare(String(password), user.hash_mdp);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

    const org = user.organization_id
      ? await Organization.findByPk(user.organization_id, { attributes: ['id','type','is_marketplace','is_internal'] })
      : null;

    const payload = {
      id: user.id,
      matricule: user.matricule,
      role: user.role,
      nom: user.nom,
      organization_id: user.organization_id || null
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({
      token,
      user: serializeAuthUser(user, org)
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur login' });
  }
});



router.post('/change-password', requireAuth, changePwdRules, validate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Champs requis: current_password et new_password' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    const userId = req.user?.id;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Vérifier le mot de passe actuel
    const ok = await bcrypt.compare(current_password, user.hash_mdp || '');
    if (!ok) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });

    // (Optionnel) éviter de remettre le même mot de passe
    const same = await bcrypt.compare(new_password, user.hash_mdp || '');
    if (same) return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l’actuel' });

    // Mettre à jour
    user.hash_mdp = await bcrypt.hash(new_password, 10);
    await user.save();

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur changement de mot de passe' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const u = await User.findByPk(req.user.id, {
      attributes: ['id', 'matricule', 'nom', 'email', 'role', 'actif', 'organization_id']
    });
    const org = u?.organization_id
      ? await Organization.findByPk(u.organization_id, { attributes: ['id','type','is_marketplace','is_internal'] })
      : null;
    return res.json({ user: serializeAuthUser(u, org) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur /me' });
  }
});

router.post('/signup', signupRules, validate, async (req, res) => {
  try {
    if (process.env.ALLOW_SELF_SIGNUP !== 'true') {
      return res.status(403).json({ error: "L'inscription est désactivée." });
    }

    const { matricule, password, confirm_password, nom = '', email = '' } = req.body || {};
    if (!matricule || !password) return res.status(400).json({ error: 'Champs requis : matricule, password.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    if (confirm_password !== undefined && password !== confirm_password) return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' });

    const normMatricule = String(matricule).trim();
    const normNom = String(nom).trim() || null;
    const normEmail = String(email).trim().toLowerCase() || null;
    if (normEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });

    const exists = await User.findOne({ where: { [Op.or]: [{ matricule: normMatricule }, ...(normEmail ? [{ email: normEmail }] : [])] } });
    if (exists) return res.status(409).json({ error: 'Utilisateur existant (matricule/email déjà utilisés).' });

    const hash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      matricule: normMatricule,
      nom: normNom,
      email: normEmail,
      role: 'user',
      actif: false, // ⬅️ inactif par défaut : nécessite activation admin
      hash_mdp: hash
    });

    // Notifier les admins
    await notifyAdminsNewUser(user);

    return res.status(201).json({
      ok: true,
      user: { id: user.id, matricule: user.matricule, nom: user.nom, email: user.email, role: user.role, actif: user.actif }
    });
  } catch (e) {
    console.error(e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Conflit d’unicité (matricule/email déjà pris).' });
    return res.status(500).json({ error: 'Erreur signup' });
  }
});




// ── Inscription client marketplace (email + téléphone + mot de passe) ─────────
const customerRegisterRules = [
  body('nom').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
];

router.post('/customer-register', customerRegisterRules, validate, async (req, res) => {
  try {
    const { nom, email, phone, password } = req.body || {};
    const normEmail = String(email).trim().toLowerCase();

    const exists = await User.findOne({ where: { [Op.or]: [{ matricule: normEmail }, { email: normEmail }] } });
    if (exists) return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });

    const hash      = await bcrypt.hash(String(password), 10);
    const verifTok  = require('crypto').randomBytes(32).toString('hex');
    const verifExp  = new Date(Date.now() + 24 * 3600 * 1000);
    const user = await User.create({
      matricule:                  normEmail,
      nom:                        String(nom).trim(),
      email:                      normEmail,
      phone:                      phone || null,
      role:                       'customer',
      actif:                      true,
      hash_mdp:                   hash,
      organization_id:            null,
      email_verified:             false,
      email_verification_token:   verifTok,
      email_verification_expires: verifExp,
    });

    const payload = { id: user.id, matricule: user.matricule, role: user.role, nom: user.nom, organization_id: null };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    // Notification de bienvenue in-app
    require('../services/NotificationService').onCustomerAccountCreated(user).catch(() => {});

    return res.status(201).json({
      token,
      user: serializeAuthUser(user)
    });
  } catch (e) {
    console.error(e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Email déjà utilisé.' });
    return res.status(500).json({ error: 'Erreur inscription' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INSCRIPTION PROFESSIONNELLE
// ════════════════════════════════════════════════════════════════════════════

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function generateUniqueSlug(name) {
  let base = slugify(name) || 'org';
  let slug = base; let n = 0;
  while (await Organization.findOne({ where: { slug } })) { n++; slug = `${base}-${n}`; }
  return slug;
}

// Map plan_slug → Organization.plan ENUM
const PLAN_TO_ORG_PLAN = { free_demo:'trial', basic:'starter', pro:'pro', canteen:'pro', enterprise:'enterprise' };

// Map establishment_type (frontend) → Organization.type ENUM
const ESTAB_TO_ORG_TYPE = {
  restaurant:'restaurant', snack:'snack', cafe:'cafe', bakery:'bakery',
  dark_kitchen:'dark_kitchen', patisserie:'bakery', traiteur:'restaurant',
  fast_food:'snack', autre:'restaurant',
};

const proRegisterRules = [
  body('nom').trim().notEmpty().withMessage('Nom complet requis').isLength({ max: 191 }),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
  body('confirm_password').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Les mots de passe ne correspondent pas');
    return true;
  }),
  body('module_type').isIn(['RESTAURANT', 'CANTEEN']).withMessage('Module invalide'),
  body('org_name').trim().notEmpty().withMessage('Nom de l\'établissement requis').isLength({ max: 191 }),
  body('establishment_type').optional().trim(),
  body('plan_slug').optional().trim().isLength({ max: 64 }),
];

router.post('/pro-register', proRegisterRules, validate, async (req, res) => {
  try {
    const {
      nom, email, phone = null, password,
      module_type,
      org_name, establishment_type = 'restaurant', organization_type = null,
      address = null, city = null, phone_org = null, description = null,
      approx_users = null,
      accepts_qr_table = false, accepts_online = false,
      accepts_delivery = false, accepts_takeaway = false, accepts_reservation = false,
      canteen_services = [],
      plan_slug = 'free_demo',
    } = req.body;

    const normEmail = String(email).trim().toLowerCase();

    // Vérifier unicité email
    const existing = await User.findOne({
      where: { [Op.or]: [{ email: normEmail }, { matricule: normEmail }] }
    });
    if (existing) return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });

    // Récupérer le plan
    const plan = await SubscriptionPlan.findOne({ where: { slug: plan_slug, is_active: true } });

    const isRestaurant = module_type === 'RESTAURANT';

    // Créer l'organisation
    const orgType = isRestaurant ? (ESTAB_TO_ORG_TYPE[establishment_type] || 'restaurant') : 'canteen';
    const orgPlan = PLAN_TO_ORG_PLAN[plan_slug] || 'trial';
    const slug = await generateUniqueSlug(org_name);

    // Expiration du plan
    let planExpiresAt = null;
    if (plan && plan.price_monthly === 0) {
      const d = new Date(); d.setDate(d.getDate() + 30);
      planExpiresAt = d;
    }

    const org = await Organization.create({
      slug, name: String(org_name).trim(), type: orgType, plan: orgPlan,
      plan_expires_at: planExpiresAt,
      active: true,
      is_marketplace: isRestaurant,
      is_internal: !isRestaurant,
      address, city, phone: phone_org, description,
      accepts_delivery: !!(accepts_delivery || accepts_online),
      accepts_takeaway: !!accepts_takeaway,
      accepts_dine_in: !!(accepts_qr_table || accepts_reservation),
      settings: {
        onboarding_complete: false,
        module_type,
        ...(isRestaurant ? { establishment_type } : { organization_type, approx_users, canteen_services }),
      },
    });

    // Créer l'utilisateur responsable
    const role      = isRestaurant ? 'restaurant_owner' : 'canteen_admin';
    const hash      = await bcrypt.hash(String(password), 10);
    const verifTok  = require('crypto').randomBytes(32).toString('hex');
    const verifExp  = new Date(Date.now() + 24 * 3600 * 1000);
    const user = await User.create({
      matricule: normEmail,
      nom: String(nom).trim(),
      email: normEmail,
      phone: phone || null,
      role, actif: true, hash_mdp: hash,
      organization_id:            org.id,
      email_verified:             false,
      email_verification_token:   verifTok,
      email_verification_expires: verifExp,
    });

    // Créer l'abonnement
    if (plan) {
      const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);
      await UserSubscription.create({
        organization_id: org.id,
        plan_id: plan.id,
        status: plan.price_monthly === 0 ? 'trial' : 'active',
        billing_cycle: 'monthly',
        started_at: new Date(),
        trial_ends_at: plan.price_monthly === 0 ? trialEnd : null,
        expires_at: plan.price_monthly > 0 ? new Date(Date.now() + 30 * 86400000) : null,
      });
    }

    // Générer le token JWT
    const payload = { id: user.id, matricule: user.matricule, role: user.role, nom: user.nom, organization_id: org.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    // Notifications de bienvenue in-app
    require('../services/NotificationService').onProAccountCreated(user, org).catch(() => {});

    return res.status(201).json({
      token,
      user: serializeAuthUser(user, org),
      org: { id: org.id, slug: org.slug, name: org.name, type: org.type },
      module_type,
    });
  } catch (e) {
    console.error('[pro-register]', e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Email ou identifiant déjà utilisé.' });
    return res.status(500).json({ error: 'Erreur création compte professionnel' });
  }
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token manquant' });
  try {
    const user = await User.findOne({
      where: {
        email_verification_token: token,
        email_verified: false,
        email_verification_expires: { [Op.gt]: new Date() },
      },
    });
    if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré.' });

    user.email_verified             = true;
    user.email_verification_token   = null;
    user.email_verification_expires = null;
    await user.save();

    // Notification confirmation in-app
    require('../services/NotificationService').create({
      type:         'EMAIL_VERIFIED',
      recipient_id: user.id,
      title:        '✅ Email confirmé',
      message:      'Votre adresse email a été vérifiée avec succès.',
      entity_type:  'ACCOUNT',
      priority:     'low',
    }).catch(() => {});

    // Redirection vers le frontend avec message
    const APP_URL = process.env.APP_URL || '';
    return res.redirect(`${APP_URL}/account?verified=1`);
  } catch (e) {
    console.error('[verify-email]', e);
    return res.status(500).json({ error: 'Erreur vérification' });
  }
});

// GET /api/auth/plans — plans d'abonnement publics
router.get('/plans', async (_req, res) => {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['price_monthly', 'ASC']],
    });
    res.json({ plans });
  } catch (e) {
    res.status(500).json({ error: 'Erreur plans' });
  }
});

module.exports = router;
