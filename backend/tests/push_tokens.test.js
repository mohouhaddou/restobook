'use strict';

/**
 * Tests — Routage push FCM (push_tokens / NotificationRouter)
 * Usage : node tests/push_tokens.test.js
 *
 * Couvre les scénarios du plan "Refonte push FCM" :
 *  1. login A puis logout puis login B sur le même device → B ne reçoit
 *     jamais les push de A (une seule ligne active par device_id).
 *  2. customer sur device 1 / driver sur device 2 → notifications séparées.
 *  3. sendToCustomer n'atteint que le client concerné.
 *  4. sendToDriver n'atteint que le livreur assigné.
 *  5. logout livreur (revokeSession) → il ne reçoit plus rien.
 *  6. refresh du token FCM (même device_id, nouveau fcm_token) → l'ancien
 *     token devient inactif.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize, User, DeliveryPerson, PushToken } = require('../models');
const fx = require('./helpers/posFixtures');
const NotificationRouter = require('../src/shared/services/NotificationRouter');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function tokenFor(user, sessionId) {
  return jwt.sign(
    { id: user.id, role: user.role, nom: user.nom, organization_id: user.organization_id || null, session_id: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', require('../src/modules/notifications/routes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}/api/notifications`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function api(baseUrl, token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Push tokens / NotificationRouter');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();
  const sfx = crypto.randomBytes(4).toString('hex');

  const { org, business } = await fx.createOrgAndBusiness('resto');
  const staff = await fx.createUser(org, 'restaurant_owner', sfx);

  const customerA = await User.create({ matricule: `cust-a-${sfx}`, nom: 'Client A', email: `cust-a-${sfx}@test.local`, role: 'customer', hash_mdp: 'x', actif: true, organization_id: null });
  const customerB = await User.create({ matricule: `cust-b-${sfx}`, nom: 'Client B', email: `cust-b-${sfx}@test.local`, role: 'customer', hash_mdp: 'x', actif: true, organization_id: null });
  const driverUser = await User.create({ matricule: `drv-${sfx}`, nom: 'Livreur Test', email: `drv-${sfx}@test.local`, role: 'delivery', hash_mdp: 'x', actif: true, organization_id: null });
  const driver = await DeliveryPerson.create({ user_id: driverUser.id, mode: 'network', status: 'offline', is_active: true });

  const deviceShared = `device-shared-${sfx}`;
  const deviceDriver = `device-driver-${sfx}`;

  const createdTokenIds = [];

  try {
    console.log('Test 1 : login A → login B sur le même device → A perd son token actif');
    const sessionA = crypto.randomUUID();
    const tokenA = tokenFor(customerA, sessionA);
    const regA = await api(server.baseUrl, tokenA, 'POST', '/push-tokens', { fcm_token: `fcm-a-${sfx}`, device_id: deviceShared, platform: 'web' });
    assert(regA.status === 201, 'Enregistrement token client A → 201');

    const rowA = await PushToken.findOne({ where: { device_id: deviceShared, user_id: customerA.id } });
    createdTokenIds.push(rowA.id);
    assert(rowA.is_active === true, 'Token A actif juste après login');

    const sessionB = crypto.randomUUID();
    const tokenB = tokenFor(customerB, sessionB);
    const regB = await api(server.baseUrl, tokenB, 'POST', '/push-tokens', { fcm_token: `fcm-b-${sfx}`, device_id: deviceShared, platform: 'web' });
    assert(regB.status === 201, 'Enregistrement token client B (même device) → 201');
    const rowB = await PushToken.findOne({ where: { device_id: deviceShared, user_id: customerB.id } });
    createdTokenIds.push(rowB.id);

    await rowA.reload();
    assert(rowA.is_active === false, 'Token A désactivé après login de B sur le même device');
    assert(rowB.is_active === true, 'Token B actif');

    const sendA = await NotificationRouter.sendToCustomer(customerA.id, { title: 't', body: 'b' });
    assert(sendA.tokensCount === 0, 'sendToCustomer(A) ne cible plus aucun token (device repris par B)');

    console.log('\nTest 2 : customer (device 1) et driver (device 2) → notifications strictement séparées');
    const driverSession = crypto.randomUUID();
    const driverToken = tokenFor(driverUser, driverSession);
    const regDriver = await api(server.baseUrl, driverToken, 'POST', '/push-tokens', { fcm_token: `fcm-drv-${sfx}`, device_id: deviceDriver, platform: 'android' });
    assert(regDriver.status === 201, 'Enregistrement token livreur → 201');
    const rowDriver = await PushToken.findOne({ where: { device_id: deviceDriver } });
    createdTokenIds.push(rowDriver.id);
    assert(rowDriver.role === 'driver' && rowDriver.driver_id === driver.id, 'Token livreur bucketé role=driver + driver_id résolu automatiquement (jamais depuis le body)');

    const sendB = await NotificationRouter.sendToCustomer(customerB.id, { title: 't', body: 'b' });
    assert(sendB.tokensCount === 1, 'sendToCustomer(B) atteint exactement 1 token (le sien)');
    const sendDriverAsCustomer = await NotificationRouter.sendToCustomer(driverUser.id, { title: 't', body: 'b' });
    assert(sendDriverAsCustomer.tokensCount === 0, "sendToCustomer sur l'id du livreur ne trouve rien (son token est role=driver, pas customer)");

    console.log('\nTest 3 : sendToDriver n\'atteint que le livreur assigné');
    const otherDriverUser = await User.create({ matricule: `drv2-${sfx}`, nom: 'Livreur 2', email: `drv2-${sfx}@test.local`, role: 'delivery', hash_mdp: 'x', actif: true, organization_id: null });
    const otherDriver = await DeliveryPerson.create({ user_id: otherDriverUser.id, mode: 'network', status: 'offline', is_active: true });
    const sendDriver = await NotificationRouter.sendToDriver(driver.id, { title: 't', body: 'b' });
    assert(sendDriver.tokensCount === 1, 'sendToDriver(driver assigné) → 1 token');
    const sendOtherDriver = await NotificationRouter.sendToDriver(otherDriver.id, { title: 't', body: 'b' });
    assert(sendOtherDriver.tokensCount === 0, "sendToDriver(autre livreur, sans token) → 0");
    await otherDriver.destroy();
    await otherDriverUser.destroy();

    console.log('\nTest 4 : sendToBusiness n\'atteint que le commerce concerné (pas les clients/livreurs)');
    const staffSession = crypto.randomUUID();
    const staffToken = tokenFor(staff, staffSession);
    const regStaff = await api(server.baseUrl, staffToken, 'POST', '/push-tokens', { fcm_token: `fcm-staff-${sfx}`, device_id: `device-staff-${sfx}`, platform: 'web' });
    assert(regStaff.status === 201, 'Enregistrement token staff → 201');
    const rowStaff = await PushToken.findOne({ where: { user_id: staff.id } });
    createdTokenIds.push(rowStaff.id);
    assert(rowStaff.role === 'business' && rowStaff.business_id === business.id, 'Token staff bucketé role=business + business_id résolu automatiquement');

    const sendBiz = await NotificationRouter.sendToBusiness(business.id, { title: 't', body: 'b' });
    assert(sendBiz.tokensCount === 1, 'sendToBusiness(ce commerce) → 1 token (le staff), pas les clients/livreurs');

    console.log('\nTest 5 : logout livreur (revoke) → il ne reçoit plus rien');
    const revoke = await api(server.baseUrl, driverToken, 'POST', '/push-tokens/revoke');
    assert(revoke.status === 200, 'POST /push-tokens/revoke → 200');
    const sendDriverAfterLogout = await NotificationRouter.sendToDriver(driver.id, { title: 't', body: 'b' });
    assert(sendDriverAfterLogout.tokensCount === 0, 'Après logout, sendToDriver ne trouve plus aucun token actif pour ce livreur');

    console.log('\nTest 6 : refresh du token FCM (même device, nouveau token) → ancien inactif');
    const sessionRefresh = crypto.randomUUID();
    const refreshToken = tokenFor(customerB, sessionRefresh);
    const deviceRefresh = `device-refresh-${sfx}`;
    const firstReg = await api(server.baseUrl, refreshToken, 'POST', '/push-tokens', { fcm_token: `fcm-refresh-1-${sfx}`, device_id: deviceRefresh });
    assert(firstReg.status === 201, 'Premier enregistrement (avant refresh) → 201');
    const firstRow = await PushToken.findOne({ where: { device_id: deviceRefresh, fcm_token: `fcm-refresh-1-${sfx}` } });
    createdTokenIds.push(firstRow.id);

    const secondReg = await api(server.baseUrl, refreshToken, 'POST', '/push-tokens', { fcm_token: `fcm-refresh-2-${sfx}`, device_id: deviceRefresh });
    assert(secondReg.status === 201, 'Second enregistrement (nouveau token FCM, même device) → 201');
    const secondRow = await PushToken.findOne({ where: { device_id: deviceRefresh, fcm_token: `fcm-refresh-2-${sfx}` } });
    createdTokenIds.push(secondRow.id);

    await firstRow.reload();
    assert(firstRow.is_active === false, "L'ancien token FCM devient inactif après refresh");
    assert(secondRow.is_active === true, 'Le nouveau token FCM est actif');

  } finally {
    await server.close();
    await PushToken.destroy({ where: { id: createdTokenIds } });
    await driver.destroy();
    await driverUser.destroy();
    await customerA.destroy();
    await customerB.destroy();
    await fx.cleanup({ org, business, users: [staff], products: [], customers: [] });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });
