'use strict';

const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const PENDING_SIGNUP_PURPOSE = 'google_pending_signup';
const PENDING_SIGNUP_TTL = '30m';

let client = null;
function getClient() {
  if (!client) client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return client;
}

/**
 * Vérifie un ID token Google auprès des serveurs Google (signature, expiration,
 * audience). Ne fait jamais confiance à un payload décodé côté client.
 * Retourne { googleId, email, emailVerified, name, picture }.
 * Lève une erreur avec e.code = 'GOOGLE_TOKEN_INVALID' si le token est invalide,
 * expiré, ou n'a pas la bonne audience.
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('idToken manquant');
    err.code = 'GOOGLE_TOKEN_INVALID';
    throw err;
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    const err = new Error('GOOGLE_CLIENT_ID non configuré côté serveur');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }

  let ticket;
  try {
    ticket = await getClient().verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (e) {
    const err = new Error('Jeton Google invalide ou expiré');
    err.code = 'GOOGLE_TOKEN_INVALID';
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    const err = new Error('Jeton Google incomplet');
    err.code = 'GOOGLE_TOKEN_INVALID';
    throw err;
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    emailVerified: !!payload.email_verified,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}

/**
 * Signe un jeton temporaire (30 min) attestant qu'un profil Google a été
 * vérifié par nos soins, pour un compte qui n'existe pas encore. Utilisé
 * entre POST /auth/google (« ce compte n'existe pas, voulez-vous le créer ? »)
 * et POST /auth/google/complete-pro-signup ou complete-courier-signup, une
 * fois que l'utilisateur a choisi son type de commerce (ou saisi ses infos
 * livreur) — jamais de confiance dans des champs googleId/email renvoyés tels
 * quels par le frontend, ils transitent uniquement via ce jeton signé serveur.
 */
function signPendingSignupToken({ googleId, email, name, picture, roleIntent }) {
  return jwt.sign(
    { purpose: PENDING_SIGNUP_PURPOSE, googleId, email, name, picture, roleIntent },
    process.env.JWT_SECRET,
    { expiresIn: PENDING_SIGNUP_TTL }
  );
}

/**
 * Vérifie le jeton émis par signPendingSignupToken. Lève une erreur avec
 * e.code = 'PENDING_SIGNUP_TOKEN_INVALID' si absent, expiré, falsifié, ou
 * émis pour un roleIntent différent de celui attendu.
 */
function verifyPendingSignupToken(token, expectedRoleIntent) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    const err = new Error('Jeton de pré-inscription invalide ou expiré');
    err.code = 'PENDING_SIGNUP_TOKEN_INVALID';
    throw err;
  }
  if (payload.purpose !== PENDING_SIGNUP_PURPOSE || payload.roleIntent !== expectedRoleIntent) {
    const err = new Error('Jeton de pré-inscription invalide');
    err.code = 'PENDING_SIGNUP_TOKEN_INVALID';
    throw err;
  }
  return payload;
}

module.exports = { verifyGoogleIdToken, signPendingSignupToken, verifyPendingSignupToken };
