const jwt = require('jsonwebtoken');
require('dotenv').config();

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

function requireRole(roles) {
  const need = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Auth requise' });
    if (!need.includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
    next();
  };
}

module.exports = { requireAuth, requireRole };
