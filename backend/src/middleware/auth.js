'use strict';

const jwt = require('jsonwebtoken');
const {
  PERMISSIONS,
  PERMISSION_GROUPS,
  getPermissionsForRole,
  hasAnyPermission,
  isRoleCompatible,
  normalizeRole,
} = require('../../auth/permissions');
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
 * Réservés aux deux futurs back-offices distincts (ifilino-web / ifilino-market
 * — voir docs/PLATFORM_SPLIT_WEB_MARKET.md). Aujourd'hui, seul le rôle
 * superadmin porte les permissions de PERMISSION_GROUPS.web/market (aucun
 * rôle "web_admin"/"market_admin" dédié n'existe encore, ce qui éviterait un
 * changement du ENUM `role` en DB) : ces middlewares se comportent donc
 * comme requireSuperAdmin pour l'instant, mais vérifient déjà le bon
 * périmètre de permissions pour rester corrects le jour où des rôles plus
 * fins seront introduits.
 */
function requireWebAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Auth requise' });
  if (isRoleCompatible(req.user.role, 'superadmin')) return next();
  if (hasAnyPermission(req.user.role, PERMISSION_GROUPS.web)) return next();
  return res.status(403).json({ error: 'Accès réservé à l\'administration Web' });
}

function requireMarketAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Auth requise' });
  if (isRoleCompatible(req.user.role, 'superadmin')) return next();
  if (hasAnyPermission(req.user.role, PERMISSION_GROUPS.market)) return next();
  return res.status(403).json({ error: 'Accès réservé à l\'administration Marketplace' });
}

/**
 * Vérifie qu'un token valide est fourni et que le rôle associé a la permission
 * CUSTOMER_ACCOUNT (rôle "customer" côté marketplace/dashboard consommateur).
 * Contrairement à requireAuth, req.user reste le payload JWT brut (id, role,
 * ...) sans enrichissement — c'est le contrat déjà utilisé par les pages
 * client existantes (ex. GET /marketplace/me).
 */
function requireCustomerAccount(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Connexion requise' });
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    if (!hasAnyPermission(req.user.role, PERMISSIONS.CUSTOMER_ACCOUNT)) {
      return res.status(403).json({ error: 'Accès réservé aux clients' });
    }
    next();
  } catch { res.status(401).json({ error: 'Session expirée, reconnectez-vous' }); }
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
    const { Organization } = require('../../models');
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
  requireCustomerAccount,
  requireSuperAdmin,
  requireWebAdmin,
  requireMarketAdmin,
  requireOrganizationAccess,
  orgScope,
};
