'use strict';

const jwt = require('jsonwebtoken');

// Auth optionnelle pour les favoris/la progression de lecture Kids — même identité client (JWT)
// que le reste du site (marketplace, iFilino Play). Contrairement à resolvePlayer.js (Play), pas
// de header invité obligatoire : un visiteur non connecté n'appelle jamais ces routes, il reste
// en localStorage côté frontend (voir useStoryEngagement.js), donc `isGuest` suffit ici sans 400.
function resolveReader(req, res, next) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
      req.readerId = payload.id;
      req.isGuest = false;
      return next();
    } catch {
      return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
    }
  }
  req.isGuest = true;
  return next();
}

module.exports = { resolveReader };
