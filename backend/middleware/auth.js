'use strict';

const jwt = require('jsonwebtoken');
const {
  getPermissionsForRole,
  hasAnyPermission,
  isRoleCompatible,
  normalizeRole,
} = require('../auth/permissions');
require('dotenv').config();

/**
 * Vérifie le token JWT et attache req.user au payload décodé.
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      ...payload,
      normalized_role: normalizeRole(payload.role),
      permissions: getPermissionsForRole(payload.role),
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

/**
 * Vérifie que l'utilisateur possède au moins un des rôles listés.
 * Usage : requireRole('admin') ou requireRole(['admin', 'manager'])
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Auth requise' });
    if (!isRoleCompatible(req.user.role, roles)) return res.status(403).json({ error: 'Accès refusé (rôle insuffisant)' });
    next();
  };
}

/**
 * Vérifie que l'utilisateur possède au moins une des permissions listées.
 * Usage : requirePermission('restaurant.orders.manage')
 */
function requirePermission(permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Auth requise' });
    if (!hasAnyPermission(req.user.role, permissions)) {
      return res.status(403).json({ error: 'Accès refusé (permission insuffisante)' });
    }
    next();
  };
}

/**
 * Réservé aux superadmins uniquement.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Auth requise' });
  if (!isRoleCompatible(req.user.role, 'superadmin')) return res.status(403).json({ error: 'Accès réservé au SuperAdmin' });
  next();
}

/**
 * Vérifie que l'utilisateur appartient à une organisation
 * et que cette organisation est active.
 * Les superadmins passent toujours (ils n'ont pas d'org).
 */
async function requireOrganizationAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Auth requise' });
  if (isRoleCompatible(req.user.role, 'superadmin')) return next(); // superadmin = accès global

  if (!req.user.organization_id) {
    return res.status(403).json({ error: 'Aucune organisation associée à ce compte' });
  }

  try {
    const { Organization } = require('../models');
    const org = await Organization.findByPk(req.user.organization_id);
    if (!org) return res.status(403).json({ error: 'Organisation introuvable' });
    if (!org.active) return res.status(403).json({ error: 'Organisation suspendue' });

    req.org = org; // disponible dans les routes suivantes
    next();
  } catch (e) {
    console.error('requireOrganizationAccess:', e.message);
    return res.status(500).json({ error: 'Erreur vérification organisation' });
  }
}

/**
 * Helper : retourne { organization_id: req.user.organization_id }
 * pour composer les clauses WHERE de façon sécurisée.
 * Si superadmin sans org cible, retourne {} (accès global).
 */
function orgScope(req) {
  if (isRoleCompatible(req.user?.role, 'superadmin') && !req.user?.organization_id) return {};
  return { organization_id: req.user?.organization_id || null };
}

module.exports = {
  requireAuth,
  requireRole,
  requirePermission,
  requireSuperAdmin,
  requireOrganizationAccess,
  orgScope,
};
