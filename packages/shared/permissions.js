'use strict';

// Source canonique de PERMISSIONS/ROLE_LABELS/ASSIGNABLE_ROLES, consommée par
// backend/src/modules/auth/permissions.js ET frontend/src/modules/core/permissions.js
// (voir docs/PLATFORM_SPLIT_WEB_MARKET.md, Phase 5a). Avant ce package, les
// deux copies dérivaient déjà : le frontend avait 12 permissions manquantes
// (COMICS_*, MEDIA_*, PHARMACY_ORDER_MANAGE) par rapport au backend.

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

const ROLE_LABELS = Object.freeze({
  superadmin: 'SuperAdmin',
  restaurant_owner: 'RestaurantOwner',
  restaurant_manager: 'RestaurantManager',
  canteen_admin: 'CanteenAdmin',
  organization_admin: 'OrganizationAdmin',
  employee: 'Employee',
  customer: 'Customer',
  kitchen_staff: 'KitchenStaff',
  delivery: 'Delivery',
  pharmacy_owner: 'Pharmacien titulaire',
  pharmacist: 'Pharmacien',
  pharmacy_cashier: 'Caissier(ère)',
  pharmacy_stock_manager: 'Responsable stock',
  pharmacy_delivery_manager: 'Responsable livraison',
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  user: 'User',
});

const ASSIGNABLE_ROLES = [
  'organization_admin',
  'restaurant_owner',
  'restaurant_manager',
  'canteen_admin',
  'kitchen_staff',
  'employee',
  'customer',
  'delivery',
  'pharmacy_owner',
  'pharmacist',
  'pharmacy_cashier',
  'pharmacy_stock_manager',
  'pharmacy_delivery_manager',
  'owner',
  'admin',
  'manager',
  'staff',
  'user',
];

module.exports = { PERMISSIONS, ROLE_LABELS, ASSIGNABLE_ROLES };
