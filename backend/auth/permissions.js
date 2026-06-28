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
});

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

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
      PERMISSIONS.DELIVERY_MANAGE,
      PERMISSIONS.NOTIFICATIONS_READ,
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
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.NOTIFICATIONS_READ,
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
      PERMISSIONS.DELIVERY_MANAGE,
      PERMISSIONS.NOTIFICATIONS_READ,
    ],
  },
  employee: {
    label: 'Employee/User',
    permissions: [
      PERMISSIONS.CANTEEN_RESERVATION_CREATE,
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.NOTIFICATIONS_READ,
    ],
  },
  customer: {
    label: 'Customer',
    permissions: [
      PERMISSIONS.CUSTOMER_ACCOUNT,
      PERMISSIONS.RESTAURANT_ORDER_CREATE,
    ],
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
      PERMISSIONS.AI_NUTRITION_ANALYZE,
      PERMISSIONS.NOTIFICATIONS_READ,
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
  owner: ['owner', 'restaurant_owner', 'organization_admin'],
  admin: ['admin', 'organization_admin', 'canteen_admin'],
  manager: ['manager', 'restaurant_manager', 'canteen_admin'],
  staff: ['staff', 'kitchen_staff'],
  user: ['user', 'employee'],
  customer: ['customer'],
  delivery: ['delivery'],
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
  // Legacy values kept so existing database rows and tokens keep working.
  'owner',
  'admin',
  'manager',
  'staff',
  'user',
]);

module.exports = {
  PERMISSIONS,
  ROLE_DEFINITIONS,
  USER_ROLE_VALUES,
  normalizeRole,
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  isRoleCompatible,
};
