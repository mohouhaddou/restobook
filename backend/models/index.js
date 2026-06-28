'use strict';

const sequelize = require('./db');

// ── Chargement des modèles ────────────────────────────────────────────────────
const Organization   = require('./organization');
const User           = require('./user');
const MenuItem       = require('./menuItem');
const MenuCategory   = require('./menuCategory');
const DailyMenu      = require('./dailyMenu');
const DailyMenuItem  = require('./dailyMenuItem');
const Reservation    = require('./reservation');
const Setting        = require('./setting');
const Notification   = require('./notification');
const Order          = require('./order');
const OrderItem      = require('./orderItem');
const TableReservation = require('./tableReservation');
const Address        = require('./address');
const Coupon         = require('./coupon');
const Review         = require('./review');
const Delivery       = require('./delivery');
const Cart            = require('./cart');
const CartItem        = require('./cartItem');
const RestaurantTable = require('./restaurantTable');
const LoyaltyPoints      = require('./loyaltyPoints');
const LoyaltyBadge       = require('./loyaltyBadge');
const UserBadge          = require('./userBadge');
const LoyaltyReward      = require('./loyaltyReward');
const LoyaltyRedemption  = require('./loyaltyRedemption');
const SubscriptionPlan   = require('./subscriptionPlan');
const UserSubscription   = require('./userSubscription');

// ── Associations ──────────────────────────────────────────────────────────────

// Organization → Users
Organization.hasMany(User, { foreignKey: 'organization_id', as: 'users' });
User.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → MenuItems
Organization.hasMany(MenuItem, { foreignKey: 'organization_id', as: 'menuItems' });
MenuItem.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → MenuCategories
Organization.hasMany(MenuCategory, { foreignKey: 'organization_id', as: 'categories' });
MenuCategory.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// MenuCategory → MenuItems
MenuCategory.hasMany(MenuItem, { foreignKey: 'category_id', as: 'items' });
MenuItem.belongsTo(MenuCategory, { foreignKey: 'category_id', as: 'category' });

// Organization → DailyMenus
Organization.hasMany(DailyMenu, { foreignKey: 'organization_id', as: 'dailyMenus' });
DailyMenu.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → Reservations
Organization.hasMany(Reservation, { foreignKey: 'organization_id', as: 'reservations' });
Reservation.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → Settings
Organization.hasMany(Setting, { foreignKey: 'organization_id', as: 'orgSettings' });
Setting.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → Notifications
Organization.hasMany(Notification, { foreignKey: 'organization_id', as: 'notifications' });
Notification.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → Orders
Organization.hasMany(Order, { foreignKey: 'organization_id', as: 'orders' });
Order.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → Reviews
Organization.hasMany(Review, { foreignKey: 'organization_id', as: 'reviews' });
Review.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → Coupons
Organization.hasMany(Coupon, { foreignKey: 'organization_id', as: 'coupons' });
Coupon.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → TableReservations
Organization.hasMany(TableReservation, { foreignKey: 'organization_id', as: 'tableReservations' });
TableReservation.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// User → Reservations
User.hasMany(Reservation, { foreignKey: 'user_id', as: 'reservations' });
Reservation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User → Orders
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User → Addresses
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User → Reviews
User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User (delivery partner) → Deliveries
User.hasMany(Delivery, { foreignKey: 'partner_id', as: 'deliveries' });
Delivery.belongsTo(User, { foreignKey: 'partner_id', as: 'partner' });

// User → Carts
User.hasMany(Cart, { foreignKey: 'user_id', as: 'carts' });
Cart.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// MenuItem → DailyMenuItems
MenuItem.hasMany(DailyMenuItem, { foreignKey: 'menu_item_id', as: 'dailyMenuItems' });
DailyMenuItem.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menu_item' });

// DailyMenu → DailyMenuItems
DailyMenu.hasMany(DailyMenuItem, { foreignKey: 'daily_menu_id', as: 'items' });
DailyMenuItem.belongsTo(DailyMenu, { foreignKey: 'daily_menu_id', as: 'daily_menu' });

// MenuItem → Reservations
MenuItem.hasMany(Reservation, { foreignKey: 'menu_item_id', as: 'reservations' });
Reservation.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menu_item' });

// Order → OrderItems
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// MenuItem → OrderItems
MenuItem.hasMany(OrderItem, { foreignKey: 'menu_item_id', as: 'orderItems' });
OrderItem.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menu_item' });

// Order → Delivery
Order.hasOne(Delivery, { foreignKey: 'order_id', as: 'delivery' });
Delivery.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Order → Review
Order.hasOne(Review, { foreignKey: 'order_id', as: 'review' });
Review.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Cart → CartItems
Cart.hasMany(CartItem, { foreignKey: 'cart_id', as: 'items' });
CartItem.belongsTo(Cart, { foreignKey: 'cart_id', as: 'cart' });

// MenuItem → CartItems
MenuItem.hasMany(CartItem, { foreignKey: 'menu_item_id', as: 'cartItems' });
CartItem.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menu_item' });

// Organization → RestaurantTables
Organization.hasMany(RestaurantTable, { foreignKey: 'organization_id', as: 'tables' });
RestaurantTable.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// User → LoyaltyPoints
User.hasMany(LoyaltyPoints, { foreignKey: 'user_id', as: 'loyaltyPoints' });
LoyaltyPoints.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User → UserBadges → LoyaltyBadges
User.hasMany(UserBadge, { foreignKey: 'user_id', as: 'userBadges' });
UserBadge.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
LoyaltyBadge.hasMany(UserBadge, { foreignKey: 'badge_id', as: 'userBadges' });
UserBadge.belongsTo(LoyaltyBadge, { foreignKey: 'badge_id', as: 'badge' });

// Organization → LoyaltyRewards
Organization.hasMany(LoyaltyReward, { foreignKey: 'organization_id', as: 'rewards' });
LoyaltyReward.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// User → LoyaltyRedemptions
User.hasMany(LoyaltyRedemption, { foreignKey: 'user_id', as: 'redemptions' });
LoyaltyRedemption.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
LoyaltyReward.hasMany(LoyaltyRedemption, { foreignKey: 'reward_id', as: 'redemptions' });
LoyaltyRedemption.belongsTo(LoyaltyReward, { foreignKey: 'reward_id', as: 'reward' });

// Order → RestaurantTable
Order.belongsTo(RestaurantTable, { foreignKey: 'table_id', as: 'table' });
RestaurantTable.hasMany(Order, { foreignKey: 'table_id', as: 'orders' });

// Organization → UserSubscriptions → SubscriptionPlan
Organization.hasMany(UserSubscription, { foreignKey: 'organization_id', as: 'subscriptions' });
UserSubscription.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
SubscriptionPlan.hasMany(UserSubscription, { foreignKey: 'plan_id', as: 'subscriptions' });
UserSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id', as: 'plan' });

// ── Export ────────────────────────────────────────────────────────────────────
module.exports = {
  sequelize,
  Organization,
  User,
  MenuItem,
  MenuCategory,
  DailyMenu,
  DailyMenuItem,
  Reservation,
  Setting,
  Notification,
  Order,
  OrderItem,
  TableReservation,
  Address,
  Coupon,
  Review,
  Delivery,
  Cart,
  CartItem,
  RestaurantTable,
  LoyaltyPoints,
  LoyaltyBadge,
  UserBadge,
  LoyaltyReward,
  LoyaltyRedemption,
  SubscriptionPlan,
  UserSubscription,
};
