export const PERMISSIONS = Object.freeze({
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
});

export const ROLE_LABELS = Object.freeze({
  superadmin: 'SuperAdmin',
  restaurant_owner: 'RestaurantOwner',
  restaurant_manager: 'RestaurantManager',
  canteen_admin: 'CanteenAdmin',
  organization_admin: 'OrganizationAdmin',
  employee: 'Employee',
  customer: 'Customer',
  kitchen_staff: 'KitchenStaff',
  delivery: 'Delivery',
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  user: 'User',
});

export const ASSIGNABLE_ROLES = [
  'organization_admin',
  'restaurant_owner',
  'restaurant_manager',
  'canteen_admin',
  'kitchen_staff',
  'employee',
  'customer',
  'delivery',
  'owner',
  'admin',
  'manager',
  'staff',
  'user',
];
