'use strict';

const jwt = require('jsonwebtoken');

// Auth optionnelle : un joueur est soit un client connecté (JWT), soit un
// invité identifié par un UUID côté client (header X-Play-Guest-Id). Jamais
// les deux, jamais aucun des deux (400). Ne remplace pas requireAuth/
// requireCustomerAccount — ce middleware est propre au module Play.
function resolvePlayer(req, res, next) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
      req.playerId = payload.id;
      req.isGuest = false;
      return next();
    } catch {
      return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
    }
  }

  const guestId = req.headers['x-play-guest-id'];
  if (guestId && /^[0-9a-f-]{36}$/i.test(guestId)) {
    req.playerGuestId = guestId;
    req.isGuest = true;
    return next();
  }

  return res.status(400).json({ error: 'Identifiant joueur manquant (JWT ou X-Play-Guest-Id)' });
}

module.exports = { resolvePlayer };
