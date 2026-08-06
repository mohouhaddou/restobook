const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { User, Organization, UserSubscription, SubscriptionPlan, Business, AuthFailedLogin } = require('../../../models');
const { requireAuth } = require('../../../middleware/auth');
const { getPermissionsForRole, normalizeRole, hasPermission, PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const { Op } = require('sequelize');
const NotificationService = require('../../../services/NotificationService');
const googleAuth = require('./googleAuth');
const { VALID_MODULES, provisionOrganization } = require('./orgProvisioning');
const { provisionCourier } = require('./courierProvisioning');

// Champs "établissement" communs à /pro-register (nouveau compte) et
// /pro-register-complete + /google/complete-pro-signup (compte déjà identifié
// par mot de passe ou par Google, il ne reste que le commerce à décrire).
const proOnboardingRules = [
  body('first_name').trim().notEmpty().withMessage('Prénom requis').isLength({ max: 100 }),
  body('last_name').trim().notEmpty().withMessage('Nom requis').isLength({ max: 100 }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('whatsapp').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('org_name').trim().notEmpty().withMessage('Nom de l\'établissement requis').isLength({ max: 191 }),
  body('description').optional({ checkFalsy: true }).trim(),
  body('phone_org').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('module_type').isIn(VALID_MODULES).withMessage('Module invalide'),
  body('precise_type').optional({ checkFalsy: true }).trim(),
  body('plan_slug').optional({ checkFalsy: true }).trim().isLength({ max: 64 }),
  body('address').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  body('city').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('district').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('latitude').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  body('formatted_address').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('geocoding_source').optional({ checkFalsy: true }).isIn(['nominatim', 'manual', 'gps']),
];

const loginRules = [
  body('matricule').trim().notEmpty().withMessage('Matricule requis'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
];

// Alimente le compteur "tentatives échouées (24h)" de la page Sécurité du
// module Infrastructure — fire-and-forget, ne doit jamais bloquer le login.
function recordFailedLogin(identifier, req) {
  AuthFailedLogin.create({ identifier: identifier || null, ip: req.ip || null }).catch(() => {});
}

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

function serializeAuthUser(user, org = null, business = null) {
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
    org_type:           org?.type             || user.org_type || null,
    org_is_marketplace: org ? !!org.is_marketplace : null,
    org_is_internal:    org ? !!org.is_internal    : null,
    org_business_type:  business?.business_type   || null,
    org_module:         business?.module          || null,
    org_slug:           org?.slug                 || null,
    preferred_language: user.preferred_language || 'en',
    avatar_url:         user.avatar_url || null,
  };
}

async function loadBusiness(orgId) {
  if (!orgId) return null;
  try { return await Business.findOne({ where: { organization_id: orgId }, attributes: ['business_type', 'module'] }); }
  catch { return null; }
}

async function notifyAdminsNewUser(newUser) {
  const admins = await User.findAll({ where: { role: { [Op.in]: ['admin', 'organization_admin', 'canteen_admin'] }, actif: true }, attributes: ['id'] });
  if (!admins.length) return;
  // Une notification par admin via NotificationService (pas de bulkCreate) —
  // bénéficie de la dédup/expiration/temps réel/push par destinataire.
  await Promise.all(admins.map(a => NotificationService.create({
    recipient_id: a.id,
    type: 'SIGNUP_REQUEST', entity_type: 'ACCOUNT',
    title: 'Nouvelle demande d’inscription',
    message: `${newUser.nom || newUser.matricule} demande l’activation du compte.`,
    data: { user_id: newUser.id, matricule: newUser.matricule, nom: newUser.nom, email: newUser.email },
  }).catch(() => {})));
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
    if (!user || !user.hash_mdp) { recordFailedLogin(identifier, req); return res.status(401).json({ error: 'Identifiants invalides' }); }

    if (!user.actif) {
      await bcrypt.compare(String(password), user.hash_mdp).catch(() => {});
      // Distinguer compte en attente de validation vs compte bloqué
      const pendingOrg = user.organization_id
        ? await Organization.findByPk(user.organization_id, { attributes: ['settings'] })
        : null;
      const isPending = pendingOrg?.settings?.registration_status === 'pending';
      return res.status(403).json({
        error: isPending
          ? 'Votre demande est en cours de traitement. Un administrateur validera votre espace dans les 24h.'
          : 'Votre compte est inactif. Veuillez contacter un administrateur.',
        pending: isPending,
      });
    }

    const ok = await bcrypt.compare(String(password), user.hash_mdp);
    if (!ok) { recordFailedLogin(identifier, req); return res.status(401).json({ error: 'Identifiants invalides' }); }

    const org = user.organization_id
      ? await Organization.findByPk(user.organization_id, { attributes: ['id','slug','type','is_marketplace','is_internal'] })
      : null;
    const business = await loadBusiness(user.organization_id);

    const payload = {
      id: user.id,
      matricule: user.matricule,
      role: user.role,
      nom: user.nom,
      organization_id: user.organization_id || null,
      session_id: require('crypto').randomUUID(),
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({
      token,
      user: serializeAuthUser(user, org, business)
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
      attributes: ['id', 'matricule', 'nom', 'email', 'role', 'actif', 'organization_id', 'preferred_language', 'avatar_url']
    });
    const org = u?.organization_id
      ? await Organization.findByPk(u.organization_id, { attributes: ['id','slug','type','is_marketplace','is_internal'] })
      : null;
    const business = await loadBusiness(u?.organization_id);
    return res.json({ user: serializeAuthUser(u, org, business) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur /me' });
  }
});

router.patch('/me', requireAuth, [
  body('preferred_language').optional().isIn(['fr','ar','en']),
  body('nom').optional().trim().isLength({ min: 1, max: 120 }),
  body('avatar_url').optional({ nullable: true }).isString().isLength({ max: 500 }),
], validate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (req.body.preferred_language !== undefined) user.preferred_language = req.body.preferred_language;
    if (req.body.nom !== undefined) user.nom = req.body.nom;
    if (req.body.avatar_url !== undefined) user.avatar_url = req.body.avatar_url || null;
    await user.save();
    const org = user.organization_id
      ? await Organization.findByPk(user.organization_id, { attributes: ['id','slug','type','is_marketplace','is_internal'] })
      : null;
    const business = await loadBusiness(user.organization_id);
    return res.json({ ok: true, user: serializeAuthUser(user, org, business) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur mise à jour profil' });
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

    const payload = { id: user.id, matricule: user.matricule, role: user.role, nom: user.nom, organization_id: null, session_id: require('crypto').randomUUID() };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    // Notification de bienvenue in-app
    require('../../../services/NotificationService').onCustomerAccountCreated(user).catch(() => {});

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
// AUTH GOOGLE — Google Identity Services (connexion + inscription unifiées)
// ════════════════════════════════════════════════════════════════════════════

const googleAuthRules = [
  body('idToken').isString().notEmpty().withMessage('idToken requis'),
  body('roleIntent').isIn(['consumer', 'business_owner', 'delivery']).withMessage('roleIntent invalide'),
];

// roleIntent qui partagent le contexte d'auth "pro" côté frontend (même
// localStorage/AuthContext que les comptes staff/admin) — seul 'consumer' vit
// dans un contexte séparé (CustomerAuthContext). C'est la seule frontière qui
// compte pour bloquer un compte existant de "changer de monde" via roleIntent.
const PRO_SIDE_ROLE_INTENTS = ['business_owner', 'delivery'];

router.post('/google', googleAuthRules, validate, async (req, res) => {
  try {
    const { idToken, roleIntent } = req.body;

    let profile;
    try {
      profile = await googleAuth.verifyGoogleIdToken(idToken);
    } catch (e) {
      if (e.code === 'GOOGLE_NOT_CONFIGURED') {
        console.error('[auth/google] GOOGLE_CLIENT_ID manquant côté serveur');
        return res.status(500).json({ error: 'Connexion Google indisponible pour le moment.' });
      }
      return res.status(401).json({ error: 'Jeton Google invalide ou expiré.' });
    }

    if (!profile.emailVerified) {
      return res.status(403).json({ error: 'Votre adresse email Google n\'est pas vérifiée.' });
    }

    let user = await User.findOne({ where: { google_id: profile.googleId } });

    if (!user) {
      user = await User.findOne({ where: { email: profile.email } });
      if (user && !user.google_id) {
        user.google_id = profile.googleId;
        if (!user.avatar_url && profile.picture) user.avatar_url = profile.picture;
        if (!user.email_verified) user.email_verified = true;
        await user.save();
      }
    }

    // ── Compte inexistant ────────────────────────────────────────────────
    // Pour un nouveau compte pro ou livreur, on ne crée RIEN tant que
    // l'utilisateur n'a pas choisi son type de commerce (ou saisi ses infos
    // livreur) — impossible de deviner un rôle/organisation à partir du seul
    // profil Google. On propose la création via un jeton signé de courte
    // durée, complété par POST /auth/google/complete-pro-signup ou
    // /complete-courier-signup. Seul 'consumer' n'a besoin d'aucune info
    // supplémentaire : la création reste immédiate.
    if (!user) {
      if (PRO_SIDE_ROLE_INTENTS.includes(roleIntent)) {
        const pendingSignupToken = googleAuth.signPendingSignupToken({
          googleId: profile.googleId, email: profile.email, name: profile.name,
          picture: profile.picture, roleIntent,
        });
        return res.json({
          account_found: false,
          roleIntent,
          profile: { email: profile.email, name: profile.name, picture: profile.picture },
          pending_signup_token: pendingSignupToken,
        });
      }

      user = await User.create({
        matricule: profile.email,
        nom: profile.name || profile.email,
        email: profile.email,
        role: 'customer',
        actif: true,
        hash_mdp: null,
        organization_id: null,
        auth_provider: 'google',
        google_id: profile.googleId,
        avatar_url: profile.picture,
        email_verified: true,
      });
      NotificationService.onCustomerAccountCreated(user).catch(() => {});

      user.last_login_at = new Date();
      await user.save();
      const tokenPayload = { id: user.id, matricule: user.matricule, role: user.role, nom: user.nom, organization_id: null, session_id: require('crypto').randomUUID() };
      return res.json({
        token: jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' }),
        user: serializeAuthUser(user),
        is_new: true,
        account_found: true,
        needs_onboarding: false,
      });
    }

    // ── Compte existant : toujours connecté avec son rôle réel ──────────────
    // roleIntent ne sert qu'à la création, jamais à changer de monde un compte
    // déjà là. Un compte client pur n'a pas de tableau de bord pro et ne doit
    // jamais atterrir dans le contexte d'auth professionnel (localStorage
    // séparé côté frontend) — inversement, un compte pro/staff/livreur n'a pas
    // la permission CUSTOMER_ACCOUNT et ne doit pas être poussé côté client.
    if (roleIntent === 'consumer' && !hasPermission(user.role, PERMISSIONS.CUSTOMER_ACCOUNT)) {
      return res.status(403).json({
        error: 'Ce compte Google est un compte professionnel. Connectez-vous depuis l\'espace professionnel (/login).',
      });
    }
    if (PRO_SIDE_ROLE_INTENTS.includes(roleIntent) && hasPermission(user.role, PERMISSIONS.CUSTOMER_ACCOUNT)) {
      return res.status(403).json({
        error: 'Ce compte Google est déjà utilisé comme compte client. Connectez-vous depuis l\'espace client, ou utilisez un autre compte Google.',
      });
    }

    // Compte inactif : distinguer "onboarding pro en cours" (laisser passer,
    // organization_id encore nul) de "bloqué/en attente de validation" (refuser).
    if (!user.actif && user.organization_id) {
      return res.status(403).json({ error: 'Votre compte est en attente de validation ou inactif.' });
    }

    user.last_login_at = new Date();
    await user.save();

    const org = user.organization_id
      ? await Organization.findByPk(user.organization_id, { attributes: ['id', 'slug', 'type', 'is_marketplace', 'is_internal'] })
      : null;
    const business = await loadBusiness(user.organization_id);

    const tokenPayload = {
      id: user.id, matricule: user.matricule, role: user.role, nom: user.nom,
      organization_id: user.organization_id || null,
      session_id: require('crypto').randomUUID(),
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      token,
      user: serializeAuthUser(user, org, business),
      is_new: false,
      account_found: true,
      // Compte pro créé par un ancien flux (avant introduction du jeton de
      // pré-inscription) qui n'a jamais terminé son onboarding — superadmin
      // exclu : un compte global n'a jamais d'organisation par conception.
      needs_onboarding: roleIntent === 'business_owner' && !user.organization_id && user.role !== 'superadmin',
    });
  } catch (e) {
    console.error('[auth/google]', e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
    return res.status(500).json({ error: 'Erreur authentification Google' });
  }
});

// ── Finalise l'inscription d'un nouveau compte professionnel Google ─────────
// (compte non créé lors de POST /auth/google — voir pending_signup_token).
router.post('/google/complete-pro-signup', proOnboardingRules, [
  body('pending_signup_token').isString().notEmpty().withMessage('pending_signup_token requis'),
], validate, async (req, res) => {
  try {
    let payload;
    try {
      payload = googleAuth.verifyPendingSignupToken(req.body.pending_signup_token, 'business_owner');
    } catch (e) {
      return res.status(401).json({ error: 'Jeton de pré-inscription invalide ou expiré, recommencez avec Google.' });
    }

    const existing = await User.findOne({
      where: { [Op.or]: [{ email: payload.email }, { matricule: payload.email }, { google_id: payload.googleId }] },
    });
    if (existing) return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });

    const user = await User.create({
      matricule: payload.email,
      nom: payload.name || payload.email,
      email: payload.email,
      role: 'employee', // provisoire — corrigé juste dessous par provisionOrganization selon module_type
      actif: false,
      hash_mdp: null,
      organization_id: null,
      auth_provider: 'google',
      google_id: payload.googleId,
      avatar_url: payload.picture,
      email_verified: true,
      last_login_at: new Date(),
    });

    const result = await provisionOrganization({ user, payload: req.body });

    const tokenPayload = { id: user.id, matricule: user.matricule, role: user.role, nom: user.nom, organization_id: user.organization_id, session_id: require('crypto').randomUUID() };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.status(201).json({ ...result, token, user: serializeAuthUser(user) });
  } catch (e) {
    console.error('[auth/google/complete-pro-signup]', e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
    return res.status(500).json({ error: 'Erreur finalisation compte professionnel' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INSCRIPTION LIVREUR — libre-service (réseau iFilino)
// ════════════════════════════════════════════════════════════════════════════

const courierRegisterRules = [
  body('first_name').trim().notEmpty().isLength({ max: 100 }).withMessage('Prénom requis'),
  body('last_name').trim().notEmpty().isLength({ max: 100 }).withMessage('Nom requis'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('phone').trim().notEmpty().isLength({ max: 30 }).withMessage('Téléphone requis'),
  body('city').trim().notEmpty().isLength({ max: 100 }).withMessage('Ville requise'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
];

router.post('/courier-register', courierRegisterRules, validate, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, city, password } = req.body || {};
    const normEmail = String(email).trim().toLowerCase();
    const fullName  = `${String(first_name).trim()} ${String(last_name).trim()}`.trim();

    const exists = await User.findOne({ where: { [Op.or]: [{ matricule: normEmail }, { email: normEmail }] } });
    if (exists) return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });

    const hash     = await bcrypt.hash(String(password), 10);
    const verifTok = require('crypto').randomBytes(32).toString('hex');
    const verifExp = new Date(Date.now() + 24 * 3600 * 1000);

    const user = await User.create({
      matricule:                  normEmail,
      nom:                        fullName,
      email:                      normEmail,
      phone:                      String(phone).trim(),
      role:                       'delivery',
      actif:                      true, // connexion immédiate — le blocage se fait sur DeliveryPerson.is_active (documents à vérifier)
      hash_mdp:                   hash,
      organization_id:            null,
      email_verified:             false,
      email_verification_token:   verifTok,
      email_verification_expires: verifExp,
    });

    const { message } = await provisionCourier({ user, city: String(city).trim() });

    const payload = { id: user.id, matricule: user.matricule, role: user.role, nom: user.nom, organization_id: null, session_id: require('crypto').randomUUID() };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.status(201).json({ token, user: serializeAuthUser(user), message });
  } catch (e) {
    console.error('[courier-register]', e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Email déjà utilisé.' });
    return res.status(500).json({ error: 'Erreur inscription livreur' });
  }
});

// ── Finalise l'inscription d'un nouveau compte livreur Google (compte non
// créé lors de POST /auth/google — voir pending_signup_token) ──────────────
router.post('/google/complete-courier-signup', [
  body('pending_signup_token').isString().notEmpty().withMessage('pending_signup_token requis'),
  body('phone').trim().notEmpty().isLength({ max: 30 }).withMessage('Téléphone requis'),
  body('city').trim().notEmpty().isLength({ max: 100 }).withMessage('Ville requise'),
], validate, async (req, res) => {
  try {
    let payload;
    try {
      payload = googleAuth.verifyPendingSignupToken(req.body.pending_signup_token, 'delivery');
    } catch (e) {
      return res.status(401).json({ error: 'Jeton de pré-inscription invalide ou expiré, recommencez avec Google.' });
    }

    const existing = await User.findOne({
      where: { [Op.or]: [{ email: payload.email }, { matricule: payload.email }, { google_id: payload.googleId }] },
    });
    if (existing) return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });

    const city = String(req.body.city).trim();
    const user = await User.create({
      matricule: payload.email,
      nom: payload.name || payload.email,
      email: payload.email,
      phone: String(req.body.phone).trim(),
      role: 'delivery',
      actif: true, // connexion immédiate — le blocage se fait sur DeliveryPerson.is_active
      hash_mdp: null,
      organization_id: null,
      auth_provider: 'google',
      google_id: payload.googleId,
      avatar_url: payload.picture,
      email_verified: true,
      last_login_at: new Date(),
    });

    const { message } = await provisionCourier({ user, city });

    const tokenPayload = { id: user.id, matricule: user.matricule, role: user.role, nom: user.nom, organization_id: null, session_id: require('crypto').randomUUID() };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.status(201).json({ token, user: serializeAuthUser(user), message });
  } catch (e) {
    console.error('[auth/google/complete-courier-signup]', e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
    return res.status(500).json({ error: 'Erreur finalisation compte livreur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INSCRIPTION PROFESSIONNELLE — v2 (Ifilino multi-module)
// ════════════════════════════════════════════════════════════════════════════

const proRegisterRules = [
  // Compte
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
  body('confirm_password').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Les mots de passe ne correspondent pas');
    return true;
  }),
  // Propriétaire
  body('first_name').trim().notEmpty().withMessage('Prénom requis').isLength({ max: 100 }),
  body('last_name').trim().notEmpty().withMessage('Nom requis').isLength({ max: 100 }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('whatsapp').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  // Établissement
  body('org_name').trim().notEmpty().withMessage('Nom de l\'établissement requis').isLength({ max: 191 }),
  body('description').optional({ checkFalsy: true }).trim(),
  body('phone_org').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  // Module + type
  body('module_type').isIn(VALID_MODULES).withMessage('Module invalide'),
  body('precise_type').optional({ checkFalsy: true }).trim(),
  // Plan
  body('plan_slug').optional({ checkFalsy: true }).trim().isLength({ max: 64 }),
  // Adresse + coords
  body('address').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  body('city').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('district').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('latitude').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  body('formatted_address').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('geocoding_source').optional({ checkFalsy: true }).isIn(['nominatim','manual','gps']),
];

router.post('/pro-register', proRegisterRules, validate, async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;
    const normEmail = String(email).trim().toLowerCase();
    const fullName  = `${String(first_name).trim()} ${String(last_name).trim()}`.trim();

    // Unicité email
    const existing = await User.findOne({
      where: { [Op.or]: [{ email: normEmail }, { matricule: normEmail }] }
    });
    if (existing) return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });

    // Créer l'utilisateur responsable (inactif jusqu'à approbation, sans org pour l'instant)
    const hash     = await bcrypt.hash(String(password), 10);
    const verifTok = require('crypto').randomBytes(32).toString('hex');
    const verifExp = new Date(Date.now() + 48 * 3600 * 1000);

    const user = await User.create({
      matricule:                  normEmail,
      nom:                        fullName,
      email:                      normEmail,
      phone:                      req.body.phone || null,
      role:                       'employee',
      actif:                      false,
      hash_mdp:                   hash,
      organization_id:            null,
      email_verified:             false,
      email_verification_token:   verifTok,
      email_verification_expires: verifExp,
    });

    const result = await provisionOrganization({ user, payload: req.body });
    return res.status(201).json(result);
  } catch (e) {
    console.error('[pro-register]', e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Email ou identifiant déjà utilisé.' });
    return res.status(500).json({ error: 'Erreur création compte professionnel' });
  }
});

router.post('/pro-register-complete', requireAuth, proOnboardingRules, validate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    // Vérifié depuis la base, pas depuis le JWT : le token émis lors de
    // POST /auth/google porte encore organization_id=null tant qu'il n'est
    // pas rafraîchi, donc un retry avec le même token doit rester bloqué
    // dès que l'organisation a réellement été créée en base.
    if (user.organization_id) {
      return res.status(409).json({ error: 'Un établissement est déjà associé à ce compte.' });
    }

    const result = await provisionOrganization({ user, payload: req.body });
    return res.status(201).json(result);
  } catch (e) {
    console.error('[pro-register-complete]', e);
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Conflit de nommage, réessayez.' });
    return res.status(500).json({ error: 'Erreur finalisation compte professionnel' });
  }
});

// GET /api/auth/check-pending?email=...  — permet au frontend de vérifier statut
router.get('/check-pending', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email requis' });
  const normEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({
    where: { email: normEmail },
    attributes: ['id', 'actif', 'organization_id'],
  });
  if (!user) return res.json({ status: 'not_found' });
  if (user.actif) return res.json({ status: 'active' });
  return res.json({ status: 'pending', user_id: user.id });
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
    require('../../../services/NotificationService').create({
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
