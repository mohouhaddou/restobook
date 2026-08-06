'use strict';

/**
 * Petit serveur HTTP éphémère pour tester le module dashboard bout-en-bout
 * (middleware requireCustomerAccount + validation express-validator inclus).
 * Contrairement aux tests POS (qui appellent le service directement), les
 * routes dashboard n'ont pas de couche service séparée — la logique vit dans
 * les handlers Express, d'où ce mini-harnais HTTP plutôt qu'un appel direct.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const jwt = require('jsonwebtoken');

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboard', require('../../src/market/dashboard/routes'));
  app.use('/api/marketplace', require('../../src/market/marketplace/routes'));
  app.use('/api/loyalty', require('../../src/market/marketplace/loyaltyRoutes'));
  app.use('/api/superadmin/loyalty', require('../../src/shared/admin/loyaltyProgramRoutes'));
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
  });

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api/dashboard`,
        marketplaceUrl: `http://127.0.0.1:${port}/api/marketplace`,
        loyaltyUrl: `http://127.0.0.1:${port}/api/loyalty`,
        superadminLoyaltyUrl: `http://127.0.0.1:${port}/api/superadmin/loyalty`,
        close: () => new Promise(r => server.close(r)),
      });
    });
  });
}

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, role: user.role, nom: user.nom, organization_id: user.organization_id || null },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function api(baseUrl, token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  return { status: res.status, body: json };
}

module.exports = { startServer, tokenFor, api };
