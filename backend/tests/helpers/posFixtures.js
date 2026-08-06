'use strict';

/**
 * Fixtures partagées pour les tests POS (backend/tests/pos_*.test.js).
 * Chaque test crée son propre org/business/users/produits jetables et les
 * nettoie en fin d'exécution — pas de DB de test dédiée dans ce repo.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const crypto = require('crypto');
const {
  Organization, Business, User, MenuItem, HanoutProduct, HanoutCreditCustomer,
  Order, OrderItem, HanoutOrder, HanoutOrderItem, HanoutCredit, HanoutCreditAuditLog,
  CashRegisterSession, PharmacyMedicine,
} = require('../../models');

function suffix() {
  return crypto.randomBytes(4).toString('hex');
}

const ENGINE_TYPE = { hanout: 'hanout', pharmacie: 'pharmacie', resto: 'restaurant' };
const ENGINE_BIZ_TYPE = { hanout: 'hanout', pharmacie: 'pharmacie', resto: 'restaurant' };
const ENGINE_MODULE = { hanout: 'hanout', pharmacie: 'pharmacie', resto: 'resto' };

async function createOrgAndBusiness(engine) {
  const sfx = suffix();
  const org = await Organization.create({
    slug: `pos-test-${engine}-${sfx}`,
    name: `POS Test ${engine} ${sfx}`,
    type: ENGINE_TYPE[engine] || 'restaurant',
    active: true,
  });
  const business = await Business.create({
    organization_id: org.id,
    name: org.name,
    business_type: ENGINE_BIZ_TYPE[engine] || 'restaurant',
    module: ENGINE_MODULE[engine] || 'resto',
    status: 'approved',
  });
  return { org, business, suffix: sfx };
}

async function createUser(org, role, sfx) {
  return User.create({
    matricule: `pos-${role}-${sfx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nom: `Test ${role}`,
    email: `pos-${role}-${sfx}@test.local`,
    role,
    hash_mdp: 'x',
    actif: true,
    organization_id: org.id,
  });
}

async function createRestoProduct(org, overrides = {}) {
  return MenuItem.create({
    libelle: overrides.libelle || 'Produit Test',
    prix: overrides.prix ?? 25,
    organization_id: org.id,
    track_stock: overrides.track_stock ?? false,
    stock_quantity: overrides.stock_quantity ?? null,
    actif: true,
  });
}

async function createHanoutProduct(org, overrides = {}) {
  return HanoutProduct.create({
    organization_id: org.id,
    name: overrides.name || 'Produit Test',
    price: overrides.price ?? 25,
    track_stock: overrides.track_stock ?? false,
    stock_quantity: overrides.stock_quantity ?? null,
    available: true,
  });
}

async function createPharmacyMedicine(org, overrides = {}) {
  return PharmacyMedicine.create({
    organization_id: org.id,
    name: overrides.name || 'Médicament Test',
    sale_price: overrides.sale_price ?? 25,
    purchase_price: overrides.purchase_price ?? 15,
  });
}

async function createCreditCustomer(org, overrides = {}) {
  return HanoutCreditCustomer.create({
    organization_id: org.id,
    name: overrides.name || 'Client Crédit Test',
    phone: overrides.phone || `06${Math.floor(Math.random() * 1e8)}`,
    credit_limit: overrides.credit_limit ?? 1000,
  });
}

function reqFor(org, user) {
  return { user: { organization_id: org.id, id: user.id, role: user.role }, org };
}

async function cleanup({ org, business, users = [], products = [], customers = [] }) {
  const orders = await Order.findAll({ where: { organization_id: org.id } });
  for (const o of orders) { await OrderItem.destroy({ where: { order_id: o.id } }); await o.destroy(); }

  const hanoutOrders = await HanoutOrder.findAll({ where: { organization_id: org.id } });
  for (const o of hanoutOrders) { await HanoutOrderItem.destroy({ where: { order_id: o.id } }); await o.destroy(); }

  await HanoutCreditAuditLog.destroy({ where: { organization_id: org.id } });
  await HanoutCredit.destroy({ where: { organization_id: org.id } });
  for (const c of customers) await c.destroy();

  await CashRegisterSession.destroy({ where: { organization_id: org.id } });
  for (const p of products) await p.destroy();
  for (const u of users) await u.destroy();
  await business.destroy();
  await org.destroy();
}

module.exports = {
  createOrgAndBusiness, createUser, createRestoProduct, createHanoutProduct,
  createPharmacyMedicine, createCreditCustomer, reqFor, cleanup,
};
