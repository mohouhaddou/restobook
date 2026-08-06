'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Business extends Model {}

Business.init({
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  // ── Lien vers l'organisation opérationnelle ──────────────────────────────
  organization_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
    comment: 'FK unique vers organizations — 1 org = 1 business profile',
  },

  // ── Identité publique ────────────────────────────────────────────────────
  name: {
    type: DataTypes.STRING(191),
    allowNull: false,
    comment: 'Nom public affiché dans Ifighak (peut différer du nom interne de l\'org)',
  },

  // Doit rester en phase avec PUBLIC_BIZ_TYPES (backend/src/modules/marketplace/routes.js)
  // et bizType() (backend/src/modules/auth/orgProvisioning.js) — un précise_type absent
  // d'ici fait planter Business.create() (ENUM MySQL) et empêche silencieusement tout
  // profil Business associé, donc toute visibilité marketplace, quel que soit le
  // statut d'approbation (voir migrate_widen_business_type.js pour l'historique).
  business_type: {
    type: DataTypes.ENUM(
      'restaurant',
      'cafe',
      'cantine',
      'hanout',
      'boulangerie',
      'patisserie',
      'boucherie',
      'pharmacie',
      'autre',
      'snack',
      'dark_kitchen',
      'traiteur',
      'fast_food',
      'epicerie',
      'alimentation',
      'droguerie',
      'glacier',
      'juice_bar',
      'salon_the',
      'primeur',
      'quincaillerie',
      'supermarche',
      'parapharmacie',
      'pharmacie_de_garde'
    ),
    allowNull: false,
    defaultValue: 'restaurant',
  },

  // ── Module Ifighak rattaché ──────────────────────────────────────────────
  module: {
    type: DataTypes.ENUM('resto', 'cantine', 'hanout', 'pharmacie', 'marketplace'),
    allowNull: false,
    defaultValue: 'resto',
    comment: 'Module Ifighak qui gère cet établissement',
  },

  // ── Workflow de validation ───────────────────────────────────────────────
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'suspended'),
    allowNull: false,
    defaultValue: 'draft',
    comment: 'draft→pending→approved | rejected | suspended',
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Renseigné par l\'admin lors du rejet',
  },
  reviewed_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: 'user.id du superadmin/admin qui a validé/rejeté',
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // ── Description ──────────────────────────────────────────────────────────
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // ── Localisation ─────────────────────────────────────────────────────────
  address: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },

  // ── Contacts ─────────────────────────────────────────────────────────────
  phone: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },
  whatsapp: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'Numéro WhatsApp (peut différer du téléphone principal)',
  },
  email: {
    type: DataTypes.STRING(191),
    allowNull: true,
  },

  // ── Médias ───────────────────────────────────────────────────────────────
  logo: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL du logo public Ifighak',
  },
  cover_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL de l\'image de couverture',
  },

  // ── Horaires ─────────────────────────────────────────────────────────────
  opening_hours: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Format: { lun: {open:"09:00", close:"22:00"}, ... } ou null=non défini',
  },

  // ── Visibilité ───────────────────────────────────────────────────────────
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Visible dans la marketplace publique Ifighak',
  },

  claim_status: {
    type: DataTypes.ENUM('claimed', 'unclaimed', 'claim_pending'),
    allowNull: false,
    defaultValue: 'claimed',
  },
  acquisition_candidate_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  knowledge_source: { type: DataTypes.STRING(80), allowNull: true },
  source_attribution: { type: DataTypes.STRING(191), allowNull: true },
  source_url: { type: DataTypes.STRING(500), allowNull: true },
  published_from_acquisition_at: { type: DataTypes.DATE, allowNull: true },

  // ── Pharmacie de garde ───────────────────────────────────────────────────
  is_pharmacy_guard: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Programmée de garde (actif seulement entre guard_start_at et guard_end_at)',
  },
  guard_start_at: { type: DataTypes.DATE, allowNull: true },
  guard_end_at:   { type: DataTypes.DATE, allowNull: true },
  guard_phone:    { type: DataTypes.STRING(32),  allowNull: true, comment: 'Ligne dédiée garde, si différente du téléphone principal' },
  guard_area:     { type: DataTypes.STRING(191), allowNull: true, comment: 'Secteur de garde (ex: Agdal-Hassan)' },
  is_open_24h:    { type: DataTypes.BOOLEAN, defaultValue: false },
  accepts_prescription_upload: { type: DataTypes.BOOLEAN, defaultValue: true },
  delivery_available: { type: DataTypes.BOOLEAN, allowNull: true, comment: 'Surcharge pharmacie de organization.accepts_delivery ; null = hérite' },
}, {
  sequelize,
  modelName: 'business',
  tableName: 'businesses',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['organization_id'] },
    { fields: ['business_type'] },
    { fields: ['module'] },
    { fields: ['status'] },
    { fields: ['city'] },
    { fields: ['is_public', 'status'] },
  ],
});

module.exports = Business;
