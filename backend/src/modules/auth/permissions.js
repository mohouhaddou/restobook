'use strict';

const PERMISSIONS = Object.freeze({
  PLATFORM_MANAGE: 'platform.manage',
  ORGANIZATION_MANAGE: 'organization.manage',
  USERS_MANAGE: 'organization.users.manage',
  SETTINGS_MANAGE: 'organization.settings.manage',
  BRANDING_MANAGE: 'organization.branding.manage',
  AI_NUTRITION_ANALYZE: 'ai.nutrition.analyze',

  CANTEEN_MENU_MANAGE: 'canteen.menu.manage',
  CANTEEN_RESERVATION_CREATE: 'canteen.reservations.create',
  CANTEEN_RESERVATION_MANAGE: 'canteen.reservations.manage',
  CANTEEN_PREP_MANAGE: 'canteen.prep.manage',
  CANTEEN_STATS_VIEW: 'canteen.stats.view',

  RESTAURANT_MENU_MANAGE: 'restaurant.menu.manage',
  RESTAURANT_ORDER_CREATE: 'restaurant.orders.create',
  RESTAURANT_ORDER_MANAGE: 'restaurant.orders.manage',
  RESTAURANT_ORDER_STATUS: 'restaurant.orders.status',
  RESTAURANT_TABLES_MANAGE: 'restaurant.tables.manage',
  RESTAURANT_PROFILE_MANAGE: 'restaurant.profile.manage',
  RESTAURANT_STATS_VIEW: 'restaurant.stats.view',

  DELIVERY_MANAGE: 'delivery.manage',
  CUSTOMER_ACCOUNT: 'customer.account',
  NOTIFICATIONS_READ: 'notifications.read',
  LOYALTY_MANAGE: 'loyalty.manage',
  PLAY_MANAGE: 'play.manage',
  GAMING_MANAGE: 'gaming.manage',
  ADS_MANAGE: 'ads.manage',
  MEDIA_VIEW: 'media.view',
  MEDIA_CREATE: 'media.create',
  MEDIA_UPDATE: 'media.update',
  MEDIA_DELETE: 'media.delete',
  MEDIA_PUBLISH: 'media.publish',
  MEDIA_RESTORE: 'media.restore',
  MEDIA_ADMIN: 'media.admin',
  COMICS_READ: 'comics.read',
  COMICS_PUBLISH: 'comics.publish',
  COMICS_MODERATE: 'comics.moderate',
  COMICS_ADMIN: 'comics.admin',

  HANOUT_PRODUCT_MANAGE: 'hanout.products.manage',
  HANOUT_ORDER_MANAGE:   'hanout.orders.manage',
  HANOUT_STATS_VIEW:     'hanout.stats.view',

  HANOUT_CREDIT_VIEW:           'hanout.credit.view',
  HANOUT_CREDIT_MANAGE:         'hanout.credit.manage',
  HANOUT_CREDIT_PAYMENT_MANAGE: 'hanout.credit.payment.manage',
  HANOUT_CREDIT_DELETE:         'hanout.credit.delete',

  // ── POS / Caisse ─────────────────────────────────────────────────────────
  POS_SELL:              'pos.sell',
  POS_SESSION_OPEN:      'pos.session.open',
  POS_SESSION_CLOSE:     'pos.session.close',
  POS_SESSION_CLOSE_ANY: 'pos.session.close_any',
  POS_HISTORY_VIEW:      'pos.history.view',
  POS_REFUND:            'pos.refund',
  POS_REPORT_VIEW:       'pos.report.view',

  // ── Pharmacie ────────────────────────────────────────────────────────────
  PHARMACY_PROFILE_MANAGE:   'pharmacy.profile.manage',
  PHARMACY_PRODUCT_MANAGE:   'pharmacy.products.manage',
  PHARMACY_ORDER_MANAGE:     'pharmacy.orders.manage',
  PHARMACY_LOT_MANAGE:       'pharmacy.lots.manage',
  PHARMACY_SALE_CREATE:      'pharmacy.sales.create',
  PHARMACY_SALE_DISCOUNT:    'pharmacy.sales.discount',
  PHARMACY_PRESCRIPTION_VIEW:     'pharmacy.prescriptions.view',
  PHARMACY_PRESCRIPTION_VALIDATE: 'pharmacy.prescriptions.validate',
  PHARMACY_CUSTOMER_MANAGE:  'pharmacy.customers.manage',
  PHARMACY_CUSTOMER_VIEW_SENSITIVE: 'pharmacy.customers.view_sensitive',
  PHARMACY_SUPPLIER_MANAGE:  'pharmacy.suppliers.manage',
  PHARMACY_PURCHASE_MANAGE:  'pharmacy.purchases.manage',
  PHARMACY_DELIVERY_MANAGE:  'pharmacy.delivery.manage',
  PHARMACY_STATS_VIEW:       'pharmacy.stats.view',

  PHARMACY_CREDIT_VIEW:           'pharmacy.credit.view',
  PHARMACY_CREDIT_MANAGE:         'pharmacy.credit.manage',
  PHARMACY_CREDIT_PAYMENT_MANAGE: 'pharmacy.credit.payment.manage',
  PHARMACY_CREDIT_DELETE:         'pharmacy.credit.delete',
});

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// ── Regroupement Web / Market ───────────────────────────────────────────────
// Cartographie des permissions existantes vers les deux back-offices cibles
// (voir docs/PLATFORM_SPLIT_WEB_MARKET.md). N'introduit aucun nouveau rôle ni
// changement de schéma DB — sert uniquement à gater les routes /web-admin/*
// et /market-admin/* (voir requireWebAdmin/requireMarketAdmin dans
// src/middleware/auth.js) et, plus tard, la navigation superadmin.
const PERMISSION_GROUPS = Object.freeze({
  web: [
    PERMISSIONS.PLAY_MANAGE,
    PERMISSIONS.GAMING_MANAGE,
    PERMISSIONS.ADS_MANAGE,
    PERMISSIONS.COMICS_READ,
    PERMISSIONS.COMICS_PUBLISH,
    PERMISSIONS.COMICS_MODERATE,
    PERMISSIONS.COMICS_ADMIN,
  ],
  market: [
    PERMISSIONS.CANTEEN_MENU_MANAGE,
    PERMISSIONS.CANTEEN_RESERVATION_CREATE,
    PERMISSIONS.CANTEEN_RESERVATION_MANAGE,
    PERMISSIONS.CANTEEN_PREP_MANAGE,
    PERMISSIONS.CANTEEN_STATS_VIEW,
    PERMISSIONS.RESTAURANT_MENU_MANAGE,
    PERMISSIONS.RESTAURANT_ORDER_CREATE,
    PERMISSIONS.RESTAURANT_ORDER_MANAGE,
    PERMISSIONS.RESTAURANT_ORDER_STATUS,
    PERMISSIONS.RESTAURANT_TABLES_MANAGE,
    PERMISSIONS.RESTAURANT_PROFILE_MANAGE,
    PERMISSIONS.RESTAURANT_STATS_VIEW,
    PERMISSIONS.DELIVERY_MANAGE,
    PERMISSIONS.LOYALTY_MANAGE,
    PERMISSIONS.HANOUT_PRODUCT_MANAGE,
    PERMISSIONS.HANOUT_ORDER_MANAGE,
    PERMISSIONS.HANOUT_STATS_VIEW,
    PERMISSIONS.HANOUT_CREDIT_VIEW,
    PERMISSIONS.HANOUT_CREDIT_MANAGE,
    PERMISSIONS.HANOUT_CREDIT_PAYMENT_MANAGE,
    PERMISSIONS.HANOUT_CREDIT_DELETE,
    PERMISSIONS.POS_SELL,
    PERMISSIONS.POS_SESSION_OPEN,
    PERMISSIONS.POS_SESSION_CLOSE,
    PERMISSIONS.POS_SESSION_CLOSE_ANY,
    PERMISSIONS.POS_HISTORY_VIEW,
    PERMISSIONS.POS_REFUND,
    PERMISSIONS.POS_REPORT_VIEW,
    PERMISSIONS.PHARMACY_PROFILE_MANAGE,
    PERMISSIONS.PHARMACY_PRODUCT_MANAGE,
    PERMISSIONS.PHARMACY_ORDER_MANAGE,
    PERMISSIONS.PHARMACY_LOT_MANAGE,
    PERMISSIONS.PHARMACY_SALE_CREATE,
    PERMISSIONS.PHARMACY_SALE_DISCOUNT,
    PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW,
    PERMISSIONS.PHARMACY_PRESCRIPTION_VALIDATE,
    PERMISSIONS.PHARMACY_CUSTOMER_MANAGE,
    PERMISSIONS.PHARMACY_CUSTOMER_VIEW_SENSITIVE,
    PERMISSIONS.PHARMACY_SUPPLIER_MANAGE,
    PERMISSIONS.PHARMACY_PURCHASE_MANAGE,
    PERMISSIONS.PHARMACY_DELIVERY_MANAGE,
    PERMISSIONS.PHARMACY_STATS_VIEW,
    PERMISSIONS.PHARMACY_CREDIT_VIEW,
    PERMISSIONS.PHARMACY_CREDIT_MANAGE,
    PERMISSIONS.PHARMACY_CREDIT_PAYMENT_MANAGE,
    PERMISSIONS.PHARMACY_CREDIT_DELETE,
  ],
  // Permissions transverses aux deux back-offices (auth, orgs, paiements,
  // média, notifications...) — jamais dupliquées, montées dans les deux.
  shared: [
    PERMISSIONS.PLATFORM_MANAGE,
    PERMISSIONS.ORGANIZATION_MANAGE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.BRANDING_MANAGE,
    PERMISSIONS.AI_NUTRITION_ANALYZE,
    PERMISSIONS.CUSTOMER_ACCOUNT,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.MEDIA_VIEW,
    PERMISSIONS.MEDIA_CREATE,
    PERMISSIONS.MEDIA_UPDATE,
    PERMISSIONS.MEDIA_DELETE,
    PERMISSIONS.MEDIA_PUBLISH,
    PERMISSIONS.MEDIA_RESTORE,
    PERMISSIONS.MEDIA_ADMIN,
  ],
});

const ROLE_DEFINITIONS = Object.freeze({
  superadmin: {
    label: 'SuperAdmin plateforme',
    permissions: ALL_PERMISSIONS,
  },
  restaurant_owner: {
    label: 'RestaurantOwner',
    permissions: [
      PERMISSIONS.ORGANIZATION_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.BRANDING_MANAGE,
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.RESTAURANT_MENU_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_CREATE,
      PERMISSIONS.RESTAURANT_ORDER_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_STATUS,
      PERMISSIONS.RESTAURANT_TABLES_MANAGE,
      PERMISSIONS.RESTAURANT_PROFILE_MANAGE,
      PERMISSIONS.RESTAURANT_STATS_VIEW,
      PERMISSIONS.LOYALTY_MANAGE,
      PERMISSIONS.DELIVERY_MANAGE,
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.HANOUT_PRODUCT_MANAGE,
      PERMISSIONS.HANOUT_ORDER_MANAGE,
      PERMISSIONS.HANOUT_STATS_VIEW,
      PERMISSIONS.HANOUT_CREDIT_VIEW,
      PERMISSIONS.HANOUT_CREDIT_MANAGE,
      PERMISSIONS.HANOUT_CREDIT_PAYMENT_MANAGE,
      PERMISSIONS.HANOUT_CREDIT_DELETE,
      PERMISSIONS.POS_SELL,
      PERMISSIONS.POS_SESSION_OPEN,
      PERMISSIONS.POS_SESSION_CLOSE,
      PERMISSIONS.POS_SESSION_CLOSE_ANY,
      PERMISSIONS.POS_HISTORY_VIEW,
      PERMISSIONS.POS_REFUND,
      PERMISSIONS.POS_REPORT_VIEW,
    ],
  },
  restaurant_manager: {
    label: 'RestaurantManager',
    permissions: [
      PERMISSIONS.RESTAURANT_MENU_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_CREATE,
      PERMISSIONS.RESTAURANT_ORDER_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_STATUS,
      PERMISSIONS.RESTAURANT_TABLES_MANAGE,
      PERMISSIONS.RESTAURANT_STATS_VIEW,
      PERMISSIONS.LOYALTY_MANAGE,
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.POS_SELL,
      PERMISSIONS.POS_SESSION_OPEN,
      PERMISSIONS.POS_SESSION_CLOSE,
      PERMISSIONS.POS_SESSION_CLOSE_ANY,
      PERMISSIONS.POS_HISTORY_VIEW,
      PERMISSIONS.POS_REFUND,
      PERMISSIONS.POS_REPORT_VIEW,
    ],
  },
  canteen_admin: {
    label: 'CanteenAdmin',
    permissions: [
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.BRANDING_MANAGE,
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.CANTEEN_MENU_MANAGE,
      PERMISSIONS.CANTEEN_RESERVATION_CREATE,
      PERMISSIONS.CANTEEN_RESERVATION_MANAGE,
      PERMISSIONS.CANTEEN_PREP_MANAGE,
      PERMISSIONS.CANTEEN_STATS_VIEW,
      PERMISSIONS.NOTIFICATIONS_READ,
    ],
  },
  organization_admin: {
    label: 'OrganizationAdmin',
    permissions: [
      PERMISSIONS.ORGANIZATION_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.BRANDING_MANAGE,
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.CANTEEN_MENU_MANAGE,
      PERMISSIONS.CANTEEN_RESERVATION_CREATE,
      PERMISSIONS.CANTEEN_RESERVATION_MANAGE,
      PERMISSIONS.CANTEEN_PREP_MANAGE,
      PERMISSIONS.CANTEEN_STATS_VIEW,
      PERMISSIONS.RESTAURANT_MENU_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_CREATE,
      PERMISSIONS.RESTAURANT_ORDER_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_STATUS,
      PERMISSIONS.RESTAURANT_TABLES_MANAGE,
      PERMISSIONS.RESTAURANT_PROFILE_MANAGE,
      PERMISSIONS.RESTAURANT_STATS_VIEW,
      PERMISSIONS.LOYALTY_MANAGE,
      PERMISSIONS.DELIVERY_MANAGE,
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.HANOUT_PRODUCT_MANAGE,
      PERMISSIONS.HANOUT_ORDER_MANAGE,
      PERMISSIONS.HANOUT_STATS_VIEW,
      PERMISSIONS.HANOUT_CREDIT_VIEW,
      PERMISSIONS.HANOUT_CREDIT_MANAGE,
      PERMISSIONS.HANOUT_CREDIT_PAYMENT_MANAGE,
      PERMISSIONS.HANOUT_CREDIT_DELETE,
      PERMISSIONS.POS_SELL,
      PERMISSIONS.POS_SESSION_OPEN,
      PERMISSIONS.POS_SESSION_CLOSE,
      PERMISSIONS.POS_SESSION_CLOSE_ANY,
      PERMISSIONS.POS_HISTORY_VIEW,
      PERMISSIONS.POS_REFUND,
      PERMISSIONS.POS_REPORT_VIEW,
    ],
  },
  employee: {
    label: 'Employee/User',
    permissions: [
      PERMISSIONS.CANTEEN_RESERVATION_CREATE,
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.NOTIFICATIONS_READ,
      // Caissier POS : vente + ouverture de sa propre caisse + historique, pas de fermeture/remboursement
      PERMISSIONS.POS_SELL,
      PERMISSIONS.POS_SESSION_OPEN,
      PERMISSIONS.POS_HISTORY_VIEW,
    ],
  },
  customer: {
    label: 'Customer',
    permissions: [
      PERMISSIONS.CUSTOMER_ACCOUNT,
      PERMISSIONS.RESTAURANT_ORDER_CREATE,
    ],
  },
  reader: {
    label: 'Comics Reader',
    permissions: [PERMISSIONS.CUSTOMER_ACCOUNT, PERMISSIONS.COMICS_READ],
  },
  publisher: {
    label: 'Comics Publisher',
    permissions: [PERMISSIONS.COMICS_READ, PERMISSIONS.COMICS_PUBLISH, PERMISSIONS.MEDIA_VIEW, PERMISSIONS.MEDIA_CREATE, PERMISSIONS.MEDIA_UPDATE],
  },
  moderator: {
    label: 'Comics Moderator',
    permissions: [PERMISSIONS.COMICS_READ, PERMISSIONS.COMICS_MODERATE, PERMISSIONS.MEDIA_VIEW],
  },
  administrator: {
    label: 'Comics Administrator',
    permissions: [PERMISSIONS.COMICS_READ, PERMISSIONS.COMICS_PUBLISH, PERMISSIONS.COMICS_MODERATE, PERMISSIONS.COMICS_ADMIN],
  },
  kitchen_staff: {
    label: 'KitchenStaff',
    permissions: [
      PERMISSIONS.CANTEEN_PREP_MANAGE,
      PERMISSIONS.CANTEEN_RESERVATION_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_STATUS,
      PERMISSIONS.RESTAURANT_ORDER_MANAGE,
      PERMISSIONS.NOTIFICATIONS_READ,
    ],
  },
  delivery: {
    label: 'Delivery',
    permissions: [PERMISSIONS.DELIVERY_MANAGE],
  },
  manager: {
    label: 'Manager (legacy)',
    permissions: [
      PERMISSIONS.CANTEEN_MENU_MANAGE,
      PERMISSIONS.CANTEEN_RESERVATION_MANAGE,
      PERMISSIONS.CANTEEN_PREP_MANAGE,
      PERMISSIONS.CANTEEN_STATS_VIEW,
      PERMISSIONS.RESTAURANT_MENU_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_CREATE,
      PERMISSIONS.RESTAURANT_ORDER_MANAGE,
      PERMISSIONS.RESTAURANT_ORDER_STATUS,
      PERMISSIONS.RESTAURANT_TABLES_MANAGE,
      PERMISSIONS.RESTAURANT_STATS_VIEW,
      PERMISSIONS.LOYALTY_MANAGE,
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.POS_SELL,
      PERMISSIONS.POS_SESSION_OPEN,
      PERMISSIONS.POS_SESSION_CLOSE,
      PERMISSIONS.POS_SESSION_CLOSE_ANY,
      PERMISSIONS.POS_HISTORY_VIEW,
      PERMISSIONS.POS_REFUND,
      PERMISSIONS.POS_REPORT_VIEW,
    ],
  },

  // ── Pharmacie ────────────────────────────────────────────────────────────
  pharmacy_owner: {
    label: 'PharmacyOwner',
    permissions: [
      PERMISSIONS.ORGANIZATION_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.BRANDING_MANAGE,
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.PHARMACY_PROFILE_MANAGE,
      PERMISSIONS.PHARMACY_PRODUCT_MANAGE,
      PERMISSIONS.PHARMACY_ORDER_MANAGE,
      PERMISSIONS.PHARMACY_LOT_MANAGE,
      PERMISSIONS.PHARMACY_SALE_CREATE,
      PERMISSIONS.PHARMACY_SALE_DISCOUNT,
      PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW,
      PERMISSIONS.PHARMACY_PRESCRIPTION_VALIDATE,
      PERMISSIONS.PHARMACY_CUSTOMER_MANAGE,
      PERMISSIONS.PHARMACY_CUSTOMER_VIEW_SENSITIVE,
      PERMISSIONS.PHARMACY_SUPPLIER_MANAGE,
      PERMISSIONS.PHARMACY_PURCHASE_MANAGE,
      PERMISSIONS.PHARMACY_DELIVERY_MANAGE,
      PERMISSIONS.PHARMACY_STATS_VIEW,
      PERMISSIONS.PHARMACY_CREDIT_VIEW,
      PERMISSIONS.PHARMACY_CREDIT_MANAGE,
      PERMISSIONS.PHARMACY_CREDIT_PAYMENT_MANAGE,
      PERMISSIONS.PHARMACY_CREDIT_DELETE,
    ],
  },
  pharmacist: {
    label: 'Pharmacist',
    permissions: [
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.PHARMACY_PRODUCT_MANAGE,
      PERMISSIONS.PHARMACY_ORDER_MANAGE,
      PERMISSIONS.PHARMACY_LOT_MANAGE,
      PERMISSIONS.PHARMACY_SALE_CREATE,
      PERMISSIONS.PHARMACY_SALE_DISCOUNT,
      PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW,
      PERMISSIONS.PHARMACY_PRESCRIPTION_VALIDATE,
      PERMISSIONS.PHARMACY_CUSTOMER_MANAGE,
      PERMISSIONS.PHARMACY_CUSTOMER_VIEW_SENSITIVE,
      PERMISSIONS.PHARMACY_STATS_VIEW,
      PERMISSIONS.PHARMACY_CREDIT_VIEW,
      PERMISSIONS.PHARMACY_CREDIT_MANAGE,
      PERMISSIONS.PHARMACY_CREDIT_PAYMENT_MANAGE,
    ],
  },
  pharmacy_cashier: {
    label: 'PharmacyCashier',
    permissions: [
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.PHARMACY_SALE_CREATE,
      PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW,
      PERMISSIONS.PHARMACY_CUSTOMER_MANAGE,
      PERMISSIONS.PHARMACY_CREDIT_VIEW,
      PERMISSIONS.PHARMACY_CREDIT_PAYMENT_MANAGE,
    ],
  },
  pharmacy_stock_manager: {
    label: 'PharmacyStockManager',
    permissions: [
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.PHARMACY_PRODUCT_MANAGE,
      PERMISSIONS.PHARMACY_LOT_MANAGE,
      PERMISSIONS.PHARMACY_SUPPLIER_MANAGE,
      PERMISSIONS.PHARMACY_PURCHASE_MANAGE,
      PERMISSIONS.PHARMACY_STATS_VIEW,
    ],
  },
  pharmacy_delivery_manager: {
    label: 'PharmacyDeliveryManager',
    permissions: [
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.PHARMACY_DELIVERY_MANAGE,
      PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW,
    ],
  },
});

const LEGACY_ROLE_ALIASES = Object.freeze({
  owner: 'organization_admin',
  admin: 'organization_admin',
  staff: 'kitchen_staff',
  user: 'employee',
});

const ROLE_COMPATIBILITY = Object.freeze({
  superadmin: ['superadmin'],
  owner: ['owner', 'restaurant_owner', 'organization_admin', 'pharmacy_owner'],
  admin: ['admin', 'organization_admin', 'canteen_admin'],
  manager: ['manager', 'restaurant_manager', 'canteen_admin'],
  staff: ['staff', 'kitchen_staff'],
  user: ['user', 'employee'],
  customer: ['customer'],
  delivery: ['delivery', 'pharmacy_delivery_manager'],
  reader: ['reader', 'customer'],
  publisher: ['publisher'],
  moderator: ['moderator'],
  administrator: ['administrator', 'superadmin'],
});

function normalizeRole(role) {
  return LEGACY_ROLE_ALIASES[role] || role || null;
}

function getRoleDefinition(role) {
  return ROLE_DEFINITIONS[normalizeRole(role)] || null;
}

function getPermissionsForRole(role) {
  return getRoleDefinition(role)?.permissions || [];
}

function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

function hasAnyPermission(role, permissions) {
  const needed = Array.isArray(permissions) ? permissions : [permissions];
  const granted = new Set(getPermissionsForRole(role));
  return needed.some(permission => granted.has(permission));
}

function isRoleCompatible(actualRole, acceptedRoles) {
  const accepted = Array.isArray(acceptedRoles) ? acceptedRoles : [acceptedRoles];
  return accepted.some(role => {
    const compatible = ROLE_COMPATIBILITY[role] || [role];
    return compatible.includes(actualRole) || compatible.includes(normalizeRole(actualRole));
  });
}

const USER_ROLE_VALUES = Object.freeze([
  'superadmin',
  'restaurant_owner',
  'restaurant_manager',
  'canteen_admin',
  'organization_admin',
  'employee',
  'customer',
  'kitchen_staff',
  'delivery',
  'pharmacy_owner',
  'pharmacist',
  'pharmacy_cashier',
  'pharmacy_stock_manager',
  'pharmacy_delivery_manager',
  'reader',
  'publisher',
  'moderator',
  'administrator',
  // Legacy values kept so existing database rows and tokens keep working.
  'owner',
  'admin',
  'manager',
  'staff',
  'user',
]);

module.exports = {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_DEFINITIONS,
  USER_ROLE_VALUES,
  normalizeRole,
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  isRoleCompatible,
};
