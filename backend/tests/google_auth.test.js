'use strict';

/**
 * Tests — Auth Google (POST /api/auth/google + endpoints associés) — HTTP
 * Usage : node tests/google_auth.test.js
 *
 * Couvre les scénarios demandés :
 *  1. Nouveau consumer via Google → compte créé immédiatement
 *  2. Nouveau professionnel (business_owner) via Google → PAS de compte créé
 *     tant que le type de commerce n'est pas choisi (pending_signup_token),
 *     puis POST /auth/google/complete-pro-signup crée compte + organisation
 *  3. Nouveau livreur via Google → même principe, POST
 *     /auth/google/complete-courier-signup
 *  4. Utilisateur existant (email/mot de passe) qui se connecte avec Google → liaison
 *  5. Compte client pur + bouton Google pro → refusé (régression bug rapporté)
 *  6. Compte pro existant + bouton Google client → refusé (symétrique)
 *  7. Email Google non vérifié → refusé
 *  8. idToken invalide → refusé
 *  9. roleIntent non autorisé → refusé (validation)
 * 10. Garde-fou statique : rate limit /api/auth/google bien enregistré
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const { sequelize, User, Organization, Business, DeliveryPerson } = require('../models');
const googleAuth = require('../src/shared/auth/googleAuth');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/shared/auth/routes'));
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ url: `http://127.0.0.1:${port}/api/auth`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function post(baseUrl, body) {
  const res = await fetch(`${baseUrl}/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  return { status: res.status, body: json };
}

async function postPath(baseUrl, urlPath, body, token) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  return { status: res.status, body: json };
}

// Mock du vérificateur Google — remplace l'appel réseau réel vers les
// serveurs Google par une réponse programmée pour chaque scénario.
function mockGoogleProfile(profile) {
  googleAuth.verifyGoogleIdToken = async () => profile;
}
function mockGoogleReject(code) {
  googleAuth.verifyGoogleIdToken = async () => {
    const err = new Error('mock invalid');
    err.code = code || 'GOOGLE_TOKEN_INVALID';
    throw err;
  };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Auth Google (POST /api/auth/google)');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();
  const originalVerify = googleAuth.verifyGoogleIdToken;
  const sfx = crypto.randomBytes(4).toString('hex');

  try {
    // ── Test 1 : nouveau consumer ──────────────────────────────────────────
    console.log('Test 1 : Nouveau consumer via Google (création immédiate)');
    const consumerEmail = `consumer-${sfx}@gmail.test`;
    const consumerGoogleId = `g-consumer-${sfx}`;
    mockGoogleProfile({ googleId: consumerGoogleId, email: consumerEmail, emailVerified: true, name: 'Client Test', picture: 'https://pic/consumer.png' });

    const r1 = await post(server.url, { idToken: 'fake', roleIntent: 'consumer' });
    assert(r1.status === 200, 'POST /auth/google (nouveau consumer) → 200');
    assert(r1.body?.is_new === true, 'is_new = true');
    assert(r1.body?.account_found === true, 'account_found = true (créé du premier coup)');
    assert(r1.body?.user?.role === 'customer', "role = 'customer'");
    assert(!!r1.body?.token, 'un token JWT est renvoyé');

    const consumerRow = await User.findOne({ where: { google_id: consumerGoogleId } });
    assert(!!consumerRow, "l'utilisateur consumer existe en base");
    assert(consumerRow.actif === true, 'actif = true (accès immédiat)');
    assert(consumerRow.hash_mdp === null, 'hash_mdp = null (pas de mot de passe)');
    assert(consumerRow.auth_provider === 'google', "auth_provider = 'google'");
    assert(consumerRow.avatar_url === 'https://pic/consumer.png', 'avatar_url repris du profil Google');
    assert(!!consumerRow.last_login_at, 'last_login_at renseigné');

    // ── Test 2 : nouveau professionnel — proposition puis finalisation ──────
    console.log('\nTest 2 : Nouveau professionnel (business_owner) via Google — pas de compte avant le choix du commerce');
    const proEmail = `pro-${sfx}@gmail.test`;
    const proGoogleId = `g-pro-${sfx}`;
    mockGoogleProfile({ googleId: proGoogleId, email: proEmail, emailVerified: true, name: 'Pro Test', picture: 'https://pic/pro.png' });

    const r2 = await post(server.url, { idToken: 'fake', roleIntent: 'business_owner' });
    assert(r2.status === 200, 'POST /auth/google (nouveau business_owner) → 200');
    assert(r2.body?.account_found === false, "account_found = false (aucun compte connu)");
    assert(!!r2.body?.pending_signup_token, 'un pending_signup_token est renvoyé');
    assert(r2.body?.profile?.email === proEmail, 'le profil Google (email) est renvoyé pour affichage');
    assert(!r2.body?.token, "aucun token de session tant que l'onboarding n'est pas fait");

    const noRowYet = await User.findOne({ where: { google_id: proGoogleId } });
    assert(!noRowYet, "AUCUN utilisateur créé en base à ce stade (correction du bug rapporté)");

    const orgName = `Snack Google Test ${sfx}`;
    const r2complete = await postPath(server.url, '/google/complete-pro-signup', {
      pending_signup_token: r2.body.pending_signup_token,
      first_name: 'Pro', last_name: 'Test',
      org_name: orgName, module_type: 'RESTAURANT', precise_type: 'snack',
      plan_slug: 'free_demo', city: 'Casablanca',
    });
    // Régression : Business.business_type doit accepter tous les precise_type
    // de PUBLIC_BIZ_TYPES (snack, epicerie, droguerie...) — un ENUM MySQL
    // incomplet ici fait planter Business.create() silencieusement et rend
    // le commerce invisible en marketplace même une fois "activé".
    assert(r2complete.status === 201, 'POST /auth/google/complete-pro-signup (precise_type=snack) → 201');
    assert(r2complete.body?.pending === true, 'pending = true (validation superadmin requise)');
    assert(r2complete.body?.org_name === orgName, "org_name correspond à l'établissement créé");
    assert(!!r2complete.body?.token, 'un token de session est enfin renvoyé (compte + organisation créés ensemble)');
    assert(r2complete.body?.user?.role === 'restaurant_owner', "rôle déduit du module choisi (RESTAURANT → restaurant_owner), jamais deviné avant");

    const proRow = await User.findOne({ where: { google_id: proGoogleId } });
    assert(!!proRow, "l'utilisateur professionnel existe maintenant en base");
    assert(proRow.actif === false, "actif = false (en attente de validation superadmin)");
    assert(proRow.organization_id === r2complete.body?.org_id, "rattaché à l'organisation créée dans la foulée");
    assert(proRow.hash_mdp === null, 'hash_mdp = null');

    const createdOrg = await Organization.findByPk(r2complete.body.org_id);
    assert(!!createdOrg && createdOrg.active === false, "organisation créée, inactive jusqu'à validation superadmin");
    const createdBiz = await Business.findOne({ where: { organization_id: r2complete.body.org_id } });
    assert(!!createdBiz, 'le profil Business associé existe (pas de crash ENUM sur business_type=snack)');
    assert(createdBiz?.business_type === 'snack', "business_type = 'snack' correctement enregistré");

    // Rejouer le même pending_signup_token une fois le compte créé → refusé.
    const r2replay = await postPath(server.url, '/google/complete-pro-signup', {
      pending_signup_token: r2.body.pending_signup_token,
      first_name: 'Pro', last_name: 'Test', org_name: 'Autre nom', module_type: 'HANOUT', city: 'Rabat',
    });
    assert(r2replay.status === 409, 'rejouer le même pending_signup_token après création → 409');

    // ── Test 3 : nouveau livreur — proposition puis finalisation ────────────
    console.log('\nTest 3 : Nouveau livreur via Google — pas de compte avant la saisie ville/téléphone');
    const courierEmail = `courier-${sfx}@gmail.test`;
    const courierGoogleId = `g-courier-${sfx}`;
    mockGoogleProfile({ googleId: courierGoogleId, email: courierEmail, emailVerified: true, name: 'Livreur Test', picture: null });

    const r3 = await post(server.url, { idToken: 'fake', roleIntent: 'delivery' });
    assert(r3.status === 200, 'POST /auth/google (nouveau livreur) → 200');
    assert(r3.body?.account_found === false, 'account_found = false');
    assert(!!r3.body?.pending_signup_token, 'un pending_signup_token est renvoyé');
    const noCourierYet = await User.findOne({ where: { google_id: courierGoogleId } });
    assert(!noCourierYet, 'aucun utilisateur créé avant la saisie des infos livreur');

    const r3complete = await postPath(server.url, '/google/complete-courier-signup', {
      pending_signup_token: r3.body.pending_signup_token,
      phone: '+212600000000', city: 'Tanger',
    });
    assert(r3complete.status === 201, 'POST /auth/google/complete-courier-signup → 201');
    assert(!!r3complete.body?.token, 'un token de session est renvoyé');
    assert(r3complete.body?.user?.role === 'delivery', "role = 'delivery'");

    const courierRow = await User.findOne({ where: { google_id: courierGoogleId } });
    assert(!!courierRow, 'utilisateur livreur créé en base');
    assert(courierRow.actif === true, 'actif = true (connexion immédiate, blocage sur DeliveryPerson.is_active)');
    assert(courierRow.phone === '+212600000000', 'téléphone saisi bien enregistré');
    const dp = await DeliveryPerson.findOne({ where: { user_id: courierRow.id } });
    assert(!!dp, 'le profil DeliveryPerson associé existe');
    assert(dp.is_active === false, 'is_active = false (documents à vérifier avant dispatch)');

    // ── Test 4 : utilisateur existant (email/mot de passe) → liaison Google ─
    console.log('\nTest 4 : Compte existant (email/mot de passe) se connectant via Google');
    const localEmail = `local-${sfx}@test.local`;
    const localHash = await bcrypt.hash('S3cret!', 10);
    const localUser = await User.create({
      matricule: localEmail, nom: 'Compte Local', email: localEmail,
      role: 'restaurant_owner', actif: true, hash_mdp: localHash, organization_id: null,
      email_verified: true,
    });
    const linkGoogleId = `g-link-${sfx}`;
    mockGoogleProfile({ googleId: linkGoogleId, email: localEmail, emailVerified: true, name: 'Compte Local', picture: 'https://pic/local.png' });

    // roleIntent correspond au bouton réellement cliqué (espace pro) — un
    // compte existant se connecte toujours avec son rôle réel, jamais celui
    // suggéré par roleIntent.
    const r4 = await post(server.url, { idToken: 'fake', roleIntent: 'business_owner' });
    assert(r4.status === 200, 'POST /auth/google (compte existant) → 200');
    assert(r4.body?.is_new === false, 'is_new = false');
    assert(r4.body?.user?.id === localUser.id, "c'est bien le même compte qui se connecte");
    assert(r4.body?.user?.role === 'restaurant_owner', 'le rôle réel du compte est conservé (pas écrasé par roleIntent)');

    await localUser.reload();
    assert(localUser.google_id === linkGoogleId, 'google_id lié au compte existant');
    assert(localUser.hash_mdp === localHash, "l'ancien mot de passe reste intact (login classique toujours possible)");

    // ── Test 5 : régression du bug rapporté — compte client pur + bouton pro ─
    console.log('\nTest 5 : Compte client pur + bouton Google "pro" → refusé (ne pollue pas le contexte pro)');
    mockGoogleProfile({ googleId: consumerGoogleId, email: consumerEmail, emailVerified: true, name: 'Client Test', picture: null });
    const r5 = await post(server.url, { idToken: 'fake', roleIntent: 'business_owner' });
    assert(r5.status === 403, 'compte customer existant + roleIntent=business_owner → 403');

    // ── Test 6 : symétrique — compte pro + bouton Google "client" ───────────
    console.log('\nTest 6 : Compte pro existant + bouton Google "client" → refusé');
    mockGoogleProfile({ googleId: linkGoogleId, email: localEmail, emailVerified: true, name: 'Compte Local', picture: null });
    const r6 = await post(server.url, { idToken: 'fake', roleIntent: 'consumer' });
    assert(r6.status === 403, 'compte restaurant_owner existant + roleIntent=consumer → 403');

    // Un livreur existant doit en revanche pouvoir se reconnecter via le
    // bouton "pro" (même contexte d'auth que business_owner) sans être refusé.
    console.log('    (livreur existant + roleIntent=delivery → doit passer, même contexte pro)');
    mockGoogleProfile({ googleId: courierGoogleId, email: courierEmail, emailVerified: true, name: 'Livreur Test', picture: null });
    const r6b = await post(server.url, { idToken: 'fake', roleIntent: 'delivery' });
    assert(r6b.status === 200, 'livreur existant + roleIntent=delivery → 200 (pas bloqué)');
    assert(r6b.body?.user?.role === 'delivery', "rôle 'delivery' conservé");

    // ── Test 7 : email Google non vérifié ───────────────────────────────────
    console.log('\nTest 7 : Email Google non vérifié → refusé');
    mockGoogleProfile({ googleId: `g-unverified-${sfx}`, email: `unverified-${sfx}@test.local`, emailVerified: false, name: 'X', picture: null });
    const r7 = await post(server.url, { idToken: 'fake', roleIntent: 'consumer' });
    assert(r7.status === 403, 'email non vérifié → 403');
    const unverifiedRow = await User.findOne({ where: { google_id: `g-unverified-${sfx}` } });
    assert(!unverifiedRow, 'aucun compte créé pour un email non vérifié');

    // ── Test 8 : idToken invalide ────────────────────────────────────────────
    console.log('\nTest 8 : idToken invalide → refusé');
    mockGoogleReject('GOOGLE_TOKEN_INVALID');
    const r8 = await post(server.url, { idToken: 'garbage', roleIntent: 'consumer' });
    assert(r8.status === 401, 'idToken invalide → 401');

    // ── Test 9 : roleIntent non autorisé ────────────────────────────────────
    console.log('\nTest 9 : roleIntent non autorisé → refusé (validation)');
    mockGoogleProfile({ googleId: `g-badrole-${sfx}`, email: `badrole-${sfx}@test.local`, emailVerified: true, name: 'X', picture: null });
    const r9 = await post(server.url, { idToken: 'fake', roleIntent: 'superadmin' });
    assert(r9.status === 400, "roleIntent='superadmin' → 400 (rejeté par la validation)");
    const r9b = await post(server.url, { roleIntent: 'consumer' }); // idToken manquant
    assert(r9b.status === 400, 'idToken manquant → 400');

    // Jeton de pré-inscription forgé/invalide sur les endpoints de finalisation.
    const r9c = await postPath(server.url, '/google/complete-pro-signup', {
      pending_signup_token: 'forged.token.here',
      first_name: 'X', last_name: 'Y', org_name: 'Z', module_type: 'RESTAURANT', city: 'Rabat',
    });
    assert(r9c.status === 401, 'pending_signup_token forgé sur complete-pro-signup → 401');
    const r9d = await postPath(server.url, '/google/complete-courier-signup', {
      pending_signup_token: 'forged.token.here', phone: '+212600000001', city: 'Rabat',
    });
    assert(r9d.status === 401, 'pending_signup_token forgé sur complete-courier-signup → 401');

    // ── Test 10 : régression — /auth/pro-register (chemin classique) toujours OK ─
    console.log('\nTest 10 : Régression — POST /auth/pro-register (inscription classique) fonctionne toujours');
    const classicEmail = `classic-${sfx}@test.local`;
    const r10 = await postPath(server.url, '/pro-register', {
      email: classicEmail, password: 'S3cret!123', confirm_password: 'S3cret!123',
      first_name: 'Classique', last_name: 'Test',
      org_name: `Hanout Classique ${sfx}`, module_type: 'HANOUT', precise_type: 'epicerie',
      plan_slug: 'free_demo', city: 'Tanger',
    });
    assert(r10.status === 201, 'POST /auth/pro-register (classique) → 201');
    assert(r10.body?.pending === true, 'pending = true');
    const classicUser = await User.findOne({ where: { email: classicEmail } });
    assert(!!classicUser, "l'utilisateur classique existe en base");
    assert(classicUser.role === 'restaurant_owner', "rôle corrigé selon le module (HANOUT → restaurant_owner)");
    assert(!!classicUser.hash_mdp, 'hash_mdp renseigné (mot de passe classique)');
    assert(classicUser.organization_id === r10.body?.org_id, "rattaché à l'organisation créée");

    // Régression — /auth/courier-register (chemin classique) toujours OK.
    const classicCourierEmail = `classic-courier-${sfx}@test.local`;
    const r10b = await postPath(server.url, '/courier-register', {
      first_name: 'Classique', last_name: 'Livreur', email: classicCourierEmail,
      phone: '+212600000002', city: 'Fès', password: 'S3cret!123',
    });
    assert(r10b.status === 201, 'POST /auth/courier-register (classique) → 201');
    const classicCourier = await User.findOne({ where: { email: classicCourierEmail } });
    assert(!!classicCourier && classicCourier.role === 'delivery', "utilisateur livreur classique créé");
    const classicDp = await DeliveryPerson.findOne({ where: { user_id: classicCourier.id } });
    assert(!!classicDp, 'DeliveryPerson créé pour le livreur classique');

    // ── Test 11 : garde-fou statique — rate limit enregistré ────────────────
    console.log('\nTest 11 : Rate limit /api/auth/google enregistré (garde-fou statique)');
    const appContent = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    const indexContent = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
    assert(appContent.includes("/api/auth/google"), "src/app.js déclare un rate limit sur /api/auth/google");
    assert(indexContent.includes("/api/auth/google"), "index.js (process PM2) déclare un rate limit sur /api/auth/google");

  } finally {
    googleAuth.verifyGoogleIdToken = originalVerify;
    await server.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  if (fail > 0) {
    console.error(`${fail} test(s) échoué(s).`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch(e => { console.error('ERREUR test google_auth:', e); process.exit(1); });
