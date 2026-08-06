'use strict';

const { Organization, SubscriptionPlan, UserSubscription, Business, User } = require('../../../models');
const { slugify, generateUniqueSlug: genUniqueSlug } = require('../../shared/utils/slug');

async function generateUniqueSlug(name) {
  return genUniqueSlug(Organization, name, { where: {}, maxLen: 60 });
}

// Plan slug → Organization.plan ENUM
const PLAN_TO_ORG_PLAN = { free_demo: 'trial', basic: 'starter', pro: 'pro', canteen: 'pro', enterprise: 'enterprise' };

// precise_type (frontend) → Organization.type ENUM
const PRECISE_TO_ORG_TYPE = {
  restaurant: 'restaurant', snack: 'snack', cafe: 'cafe', bakery: 'bakery',
  dark_kitchen: 'dark_kitchen', patisserie: 'bakery', traiteur: 'restaurant',
  fast_food: 'snack',
  epicerie: 'restaurant', alimentation: 'restaurant', droguerie: 'restaurant',
  boucherie: 'restaurant', boulangerie: 'bakery',
  salon_the: 'cafe', glacier: 'cafe', juice_bar: 'cafe',
  pharmacie: 'pharmacie',
  autre: 'restaurant',
};

// module_type → default Organization.type when precise_type absent
const MODULE_TO_ORG_TYPE = {
  RESTAURANT: 'restaurant',
  CANTEEN: 'canteen',
  CANTINE: 'canteen',
  HANOUT: 'hanout',
  CAFE: 'cafe',
  PHARMACIE: 'pharmacie',
};

// module_type → user role
const MODULE_TO_ROLE = {
  RESTAURANT: 'restaurant_owner',
  CANTEEN: 'canteen_admin',
  CANTINE: 'canteen_admin',
  HANOUT: 'restaurant_owner',
  CAFE: 'restaurant_owner',
  PHARMACIE: 'pharmacy_owner',
};

const VALID_MODULES = ['RESTAURANT', 'CANTEEN', 'CANTINE', 'HANOUT', 'CAFE', 'PHARMACIE', 'PROXIMITE'];

function bizType(module_type, precise_type) {
  const m = { RESTAURANT: 'restaurant', CANTEEN: 'cantine', HANOUT: 'hanout', PROXIMITE: 'epicerie', CAFE: 'cafe', PHARMACIE: 'pharmacie' };
  const PRECISE_TYPES = ['boulangerie', 'patisserie', 'boucherie', 'epicerie', 'droguerie', 'primeur', 'quincaillerie', 'supermarche', 'snack', 'fast_food', 'glacier', 'salon_the', 'parapharmacie', 'pharmacie_de_garde'];
  if (precise_type && PRECISE_TYPES.includes(precise_type)) return precise_type;
  return m[module_type] || 'autre';
}

function bizModule(module_type) {
  const m = { RESTAURANT: 'resto', CANTEEN: 'cantine', CANTINE: 'cantine', HANOUT: 'hanout', PROXIMITE: 'hanout', CAFE: 'resto', PHARMACIE: 'pharmacie' };
  return m[module_type] || 'resto';
}

/**
 * Crée l'organisation + business + abonnement (tous en attente de validation
 * superadmin) pour `user`, et met à jour son rôle/organization_id/actif.
 * Partagé par POST /pro-register (nouveau compte) et POST /pro-register-complete
 * (compte déjà authentifié via Google qui termine l'onboarding commerce).
 */
async function provisionOrganization({ user, payload }) {
  const {
    first_name, last_name, phone = null, whatsapp = null,
    org_name, description = null, phone_org = null,
    module_type, precise_type = null,
    plan_slug = 'free_demo',
    address = null, city = null, district = null,
    latitude = null, longitude = null,
    formatted_address = null, geocoding_source = null,
  } = payload;

  const fullName = `${String(first_name).trim()} ${String(last_name).trim()}`.trim();

  const plan = await SubscriptionPlan.findOne({ where: { slug: plan_slug, is_active: true } });
  const orgPlan = PLAN_TO_ORG_PLAN[plan_slug] || 'trial';
  const slug = await generateUniqueSlug(org_name);

  const orgType = (precise_type && PRECISE_TO_ORG_TYPE[precise_type])
    ? PRECISE_TO_ORG_TYPE[precise_type]
    : MODULE_TO_ORG_TYPE[module_type];

  const isCanteen = ['CANTEEN', 'CANTINE'].includes(module_type);
  const isPublic = !isCanteen;
  const isInternal = isCanteen;

  let planExpiresAt = null;
  if (plan && Number(plan.price_monthly) === 0) {
    const d = new Date(); d.setDate(d.getDate() + 30);
    planExpiresAt = d;
  }

  const org = await Organization.create({
    slug,
    name: String(org_name).trim(),
    type: orgType,
    plan: orgPlan,
    plan_expires_at: planExpiresAt,
    active: false,
    is_marketplace: false,
    is_internal: isInternal,
    address, city, district,
    phone: phone_org || null,
    description,
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null,
    formatted_address: formatted_address || null,
    geocoding_source: geocoding_source || null,
    geocoding_updated_at: (formatted_address || geocoding_source) ? new Date() : null,
    settings: {
      onboarding_complete: false,
      module_type,
      precise_type,
      registration_status: 'pending',
      owner: { first_name: String(first_name).trim(), last_name: String(last_name).trim(), phone, whatsapp },
      is_public: isPublic,
    },
  });

  const role = MODULE_TO_ROLE[module_type];
  user.nom = fullName || user.nom;
  user.phone = phone || user.phone;
  user.role = role;
  user.actif = false; // en attente de validation superadmin
  user.organization_id = org.id;
  await user.save();

  if (plan) {
    const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);
    await UserSubscription.create({
      organization_id: org.id,
      plan_id: plan.id,
      status: 'pending',
      billing_cycle: 'monthly',
      started_at: new Date(),
      trial_ends_at: Number(plan.price_monthly) === 0 ? trialEnd : null,
      expires_at: Number(plan.price_monthly) > 0 ? new Date(Date.now() + 30 * 86400000) : null,
    });
  }

  await Business.create({
    organization_id: org.id,
    name: String(org_name).trim(),
    business_type: bizType(module_type, precise_type),
    module: bizModule(module_type),
    status: 'pending',
    description,
    address, city, district,
    phone: phone_org || null,
    whatsapp,
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null,
    formatted_address: formatted_address || null,
    geocoding_source: geocoding_source || null,
    geocoding_updated_at: (formatted_address || geocoding_source) ? new Date() : null,
    is_public: false,
  });

  const { Op } = require('sequelize');
  const superAdmins = await User.findAll({ where: { role: 'superadmin', actif: true }, attributes: ['id'] });
  if (superAdmins.length) {
    const NS = require('../../../services/NotificationService');
    await Promise.all(superAdmins.map(sa => NS.create({
      type: 'PRO_REGISTRATION_PENDING',
      recipient_id: sa.id,
      title: '🆕 Nouvelle demande d\'inscription',
      message: `${fullName} demande la création de "${org.name}" (${module_type}).`,
      entity_type: 'ACCOUNT',
      action_url: '/orgs',
      priority: 'high',
      data: { user_id: user.id, org_id: org.id, module_type, org_name: org.name },
    }).catch(() => {})));
  }

  if (user.email) {
    require('../../../services/EmailService').sendProRegistrationPending({
      to: user.email,
      name: fullName,
      org_name: org.name,
      module: module_type,
    }).catch(() => {});
  }

  return {
    pending: true,
    user_id: user.id,
    org_id: org.id,
    org_name: org.name,
    module_type,
    message: 'Demande soumise. Un administrateur validera votre espace dans les 24h.',
  };
}

module.exports = {
  slugify,
  generateUniqueSlug,
  PLAN_TO_ORG_PLAN,
  PRECISE_TO_ORG_TYPE,
  MODULE_TO_ORG_TYPE,
  MODULE_TO_ROLE,
  VALID_MODULES,
  bizType,
  bizModule,
  provisionOrganization,
};
