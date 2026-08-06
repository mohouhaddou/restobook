'use strict';

const { normalizeRole } = require('../../modules/auth/permissions');

const DRIVER_ROLES = new Set(['delivery', 'pharmacy_delivery_manager']);

/**
 * Réduit les rôles applicatifs granulaires (restaurant_owner, canteen_admin,
 * pharmacist, ...) au bucket de routage push demandé : customer|driver|business|admin.
 * Tout rôle staff d'organisation qui n'est ni client ni livreur ni superadmin
 * est bucketé "business" — c'est délibérément permissif (nouveaux rôles staff
 * futurs tombent dans "business" par défaut plutôt que d'être exclus du push).
 */
function pushRoleFor(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'superadmin') return 'admin';
  if (normalized === 'customer') return 'customer';
  if (DRIVER_ROLES.has(normalized)) return 'driver';
  return 'business';
}

module.exports = { pushRoleFor };
