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
const LoyaltyTransaction = require('./loyaltyTransaction');
const Review         = require('./review');
const ReviewPhoto    = require('./reviewPhoto');
const ReviewVote     = require('./reviewVote');
const ReviewReport   = require('./reviewReport');
const BusinessReply  = require('./businessReply');
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
const Business           = require('./business');
const HanoutCategory     = require('./hanoutCategory');
const HanoutProduct      = require('./hanoutProduct');
const HanoutOrder        = require('./hanoutOrder');
const PharmacyOrder      = require('./pharmacyOrder');
const PharmacyOrderItem  = require('./pharmacyOrderItem');
const HanoutOrderItem    = require('./hanoutOrderItem');
const HanoutCreditCustomer = require('./hanoutCreditCustomer');
const HanoutCredit         = require('./hanoutCredit');
const HanoutCreditPayment  = require('./hanoutCreditPayment');
const HanoutCreditAuditLog = require('./hanoutCreditAuditLog');
const PharmacyProfile           = require('./pharmacyProfile');
const PharmacyMedicine          = require('./pharmacyMedicine');
const PharmacyMedicineLot       = require('./pharmacyMedicineLot');
const PharmacySupplier          = require('./pharmacySupplier');
const PharmacyPurchaseOrder     = require('./pharmacyPurchaseOrder');
const PharmacyPurchaseOrderItem = require('./pharmacyPurchaseOrderItem');
const PharmacyCustomer          = require('./pharmacyCustomer');
const PharmacyPrescription      = require('./pharmacyPrescription');
const PharmacyPrescriptionItem  = require('./pharmacyPrescriptionItem');
const PharmacySale              = require('./pharmacySale');
const PharmacySaleItem          = require('./pharmacySaleItem');
const PharmacyCredit            = require('./pharmacyCredit');
const PharmacyCreditPayment     = require('./pharmacyCreditPayment');
const PharmacyCreditAuditLog    = require('./pharmacyCreditAuditLog');
const PharmacyRequest           = require('./pharmacyRequest');
const ProductOption      = require('./productOption');
const ProductOptionValue = require('./productOptionValue');
const ProductBrand       = require('./productBrand');
const ProductCategory    = require('./productCategory');
const GlobalProduct      = require('./globalProduct');
const ProductVariant     = require('./productVariant');
const OrderItemOption    = require('./orderItemOption');
const CashRegisterSession = require('./cashRegisterSession');
const Favorite            = require('./favorite');
const ShoppingList        = require('./shoppingList');
const ShoppingListItem    = require('./shoppingListItem');
const CashbackAccount     = require('./cashbackAccount');
const CashbackTransaction = require('./cashbackTransaction');
const CouponUsage         = require('./couponUsage');
const LoyaltyRule              = require('./loyaltyRule');
const BusinessLoyaltySettings  = require('./businessLoyaltySettings');
const LoyaltyGlobalLimits      = require('./loyaltyGlobalLimits');
const LoyaltyRuleAuditLog      = require('./loyaltyRuleAuditLog');
const InfraAuditLog       = require('./infraAuditLog');
const InfraAlertRule      = require('./infraAlertRule');
const InfraAlert          = require('./infraAlert');
const InfraMetricSnapshot = require('./infraMetricSnapshot');
const AuthFailedLogin     = require('./authFailedLogin');
const MarketplaceHeroSlide = require('./marketplaceHeroSlide');
const HeroSlideEvent       = require('./heroSlideEvent');
const StoreHeroSlide       = require('./storeHeroSlide');
const StoreHeroSlideEvent  = require('./storeHeroSlideEvent');
const PortalHeroSlide      = require('./portalHeroSlide');
const PortalHeroSlideEvent = require('./portalHeroSlideEvent');
const PushToken              = require('./pushToken');
const DeliveryPerson         = require('./deliveryPerson');
const DeliveryLocation       = require('./deliveryLocation');
const DeliveryStatusHistory  = require('./deliveryStatusHistory');
const DeliveryLog            = require('./deliveryLog');
const DeliveryTracking       = require('./deliveryTracking');
const DeliveryZone           = require('./deliveryZone');
const DeliveryZoneCourier    = require('./deliveryZoneCourier');
const DeliveryPricingRule    = require('./deliveryPricingRule');
const DeliveryVehicle        = require('./deliveryVehicle');
const DeliveryDocument       = require('./deliveryDocument');
const City                   = require('./city');
const Category               = require('./category');
const Article                = require('./article');
const ArticleTranslation     = require('./articleTranslation');
const NewsletterSubscriber   = require('./newsletterSubscriber');

const PlayGame            = require('./playGame');
const PlayProvider        = require('./playProvider');
const PlayBadge           = require('./playBadge');
const PlayUserBadge       = require('./playUserBadge');
const PlayLevel           = require('./playLevel');
const PlayXp              = require('./playXp');
const PlayQuiz            = require('./playQuiz');
const PlayQuestion        = require('./playQuestion');
const PlayAnswer          = require('./playAnswer');
const PlayDailyMission    = require('./playDailyMission');
const PlayUserMission     = require('./playUserMission');
const PlayReward          = require('./playReward');
const PlayUserReward      = require('./playUserReward');
const PlaySession         = require('./playSession');
const PlayScore           = require('./playScore');
const PlayStatistic       = require('./playStatistic');
const TrafficEvent        = require('./trafficEvent');

const GamingPublisher            = require('./gamingPublisher');
const GamingPlatform             = require('./gamingPlatform');
const GamingCategory             = require('./gamingCategory');
const GamingTag                  = require('./gamingTag');
const GamingGame                 = require('./gamingGame');
const GamingFaq                  = require('./gamingFaq');
const GamingVideo                = require('./gamingVideo');
const GamingUpdate               = require('./gamingUpdate');
const GamingNews                 = require('./gamingNews');
const GamingRelatedGame          = require('./gamingRelatedGame');
const GamingSimilarHtml5Game     = require('./gamingSimilarHtml5Game');
const GamingArticle              = require('./gamingArticle');
const GamingArticleTranslation   = require('./gamingArticleTranslation');

const AdCampaign          = require('./adCampaign');
const AdPlacement         = require('./adPlacement');
const AdCampaignPlacement = require('./adCampaignPlacement');
const AdTargetingRule     = require('./adTargetingRule');
const AdImpression        = require('./adImpression');
const AdClick             = require('./adClick');
const AdDailyStatistic    = require('./adDailyStatistic');
const PortalContent       = require('./portalContent');
const PortalContentTranslation = require('./portalContentTranslation');
const DigitalProduct      = require('./digitalProduct');
const Purchase            = require('./purchase');
const GeneratedFile       = require('./generatedFile');
const PaymentProviderConfig = require('./paymentProviderConfig');
const StudyLesson         = require('./studyLesson');
const StudyLessonTranslation = require('./studyLessonTranslation');
const StudyLessonResource = require('./studyLessonResource');
const Media                 = require('./media');
const MediaLink             = require('./mediaLink');
const MediaCollection       = require('./mediaCollection');
const MediaCollectionItem   = require('./mediaCollectionItem');
const MediaTag              = require('./mediaTag');
const MediaTagMap           = require('./mediaTagMap');
const MediaTranslation      = require('./mediaTranslation');
const MediaVersion          = require('./mediaVersion');
const MediaEvent            = require('./mediaEvent');

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

// User → Notifications (personnelles, recipient_id)
User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });

// User → PushToken (tokens Push FCM, plusieurs par utilisateur : plusieurs appareils/onglets ;
// au plus 1 ligne active par device_id, voir NotificationRouter.registerToken)
User.hasMany(PushToken, { foreignKey: 'user_id', as: 'pushTokens' });
PushToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Business.hasMany(PushToken, { foreignKey: 'business_id', as: 'pushTokens' });
PushToken.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });
DeliveryPerson.hasMany(PushToken, { foreignKey: 'driver_id', as: 'pushTokens' });
PushToken.belongsTo(DeliveryPerson, { foreignKey: 'driver_id', as: 'driver' });

// Organization → Orders
Organization.hasMany(Order, { foreignKey: 'organization_id', as: 'orders' });
Order.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → Reviews
Organization.hasMany(Review, { foreignKey: 'organization_id', as: 'reviews' });
Review.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Organization → Coupons
Organization.hasMany(Coupon, { foreignKey: 'organization_id', as: 'coupons' });
Coupon.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
User.hasMany(Coupon, { foreignKey: 'user_id', as: 'personalCoupons' });
Coupon.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Fidélité : historique des transactions de points ──────────────────────────
User.hasMany(LoyaltyTransaction, { foreignKey: 'user_id', as: 'loyaltyTransactions' });
LoyaltyTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Organization.hasMany(LoyaltyTransaction, { foreignKey: 'organization_id', as: 'loyaltyTransactions' });
LoyaltyTransaction.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
Order.hasMany(LoyaltyTransaction, { foreignKey: 'order_id', as: 'loyaltyTransactions' });
LoyaltyTransaction.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Organization → TableReservations
Organization.hasMany(TableReservation, { foreignKey: 'organization_id', as: 'tableReservations' });
TableReservation.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// User → TableReservations (rattachement optionnel quand le client est connecté — voir marketplace/routes.js table-reserve)
User.hasMany(TableReservation, { foreignKey: 'user_id', as: 'tableReservations' });
TableReservation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

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
// Delivery.order_id référence Order.id OU HanoutOrder.id selon pos_order_type
// (deux séquences auto-incrémentées indépendantes qui se chevauchent — voir
// backend/src/modules/delivery/services/orderEngine.js). Le `scope` sur le
// hasOne filtre côté Delivery (deliveries.pos_order_type='order'), donc
// Order.findOne({include:[{model:Delivery,as:'delivery'}]}) ne remonte
// jamais par erreur une ligne appartenant à une HanoutOrder de même id.
// Le sens belongsTo (Delivery → order) n'a pas cette protection (Order n'a
// pas de colonne discriminante) : le code du module delivery résout donc
// toujours le bon modèle via orderEngine.resolveOrderModel(pos_order_type)
// plutôt que d'utiliser `delivery.order` pour toute nouvelle requête.
Order.hasOne(Delivery, { foreignKey: 'order_id', as: 'delivery', scope: { pos_order_type: 'order' }, constraints: false });
Delivery.belongsTo(Order, { foreignKey: 'order_id', as: 'order', constraints: false });

// Symétrique pour le moteur hanout — voir commentaire ci-dessus.
HanoutOrder.hasOne(Delivery, { foreignKey: 'order_id', as: 'delivery', scope: { pos_order_type: 'hanout_order' }, constraints: false });
Delivery.belongsTo(HanoutOrder, { foreignKey: 'order_id', as: 'hanoutOrder', constraints: false });

// Symétrique pour le moteur pharmacie — voir commentaire ci-dessus.
PharmacyOrder.hasOne(Delivery, { foreignKey: 'order_id', as: 'delivery', scope: { pos_order_type: 'pharmacy_order' }, constraints: false });
Delivery.belongsTo(PharmacyOrder, { foreignKey: 'order_id', as: 'pharmacyOrder', constraints: false });

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

// ── Business (profil public Ifighak) ─────────────────────────────────────────
Organization.hasOne(Business, { foreignKey: 'organization_id', as: 'business' });
Business.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Business.hasMany(Review, { foreignKey: 'business_id', as: 'reviews' });
Review.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });

Review.hasMany(ReviewPhoto, { foreignKey: 'review_id', as: 'photos', onDelete: 'CASCADE' });
ReviewPhoto.belongsTo(Review, { foreignKey: 'review_id', as: 'review' });

Review.hasMany(ReviewVote, { foreignKey: 'review_id', as: 'votes', onDelete: 'CASCADE' });
ReviewVote.belongsTo(Review, { foreignKey: 'review_id', as: 'review' });
User.hasMany(ReviewVote, { foreignKey: 'user_id', as: 'reviewVotes' });
ReviewVote.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Review.hasMany(ReviewReport, { foreignKey: 'review_id', as: 'reports', onDelete: 'CASCADE' });
ReviewReport.belongsTo(Review, { foreignKey: 'review_id', as: 'review' });
User.hasMany(ReviewReport, { foreignKey: 'user_id', as: 'reviewReports' });
ReviewReport.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Review.hasOne(BusinessReply, { foreignKey: 'review_id', as: 'businessReply', onDelete: 'CASCADE' });
BusinessReply.belongsTo(Review, { foreignKey: 'review_id', as: 'review' });
Business.hasMany(BusinessReply, { foreignKey: 'business_id', as: 'reviewReplies' });
BusinessReply.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });
User.hasMany(BusinessReply, { foreignKey: 'user_id', as: 'businessReplies' });
BusinessReply.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Hanout ────────────────────────────────────────────────────────────────────
Organization.hasMany(HanoutCategory, { foreignKey: 'organization_id', as: 'hanoutCategories' });
HanoutCategory.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(HanoutProduct, { foreignKey: 'organization_id', as: 'hanoutProducts' });
HanoutProduct.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

HanoutCategory.hasMany(HanoutProduct, { foreignKey: 'category_id', as: 'products' });
HanoutProduct.belongsTo(HanoutCategory, { foreignKey: 'category_id', as: 'category' });

Organization.hasMany(HanoutOrder, { foreignKey: 'organization_id', as: 'hanoutOrders' });
HanoutOrder.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

User.hasMany(HanoutOrder, { foreignKey: 'user_id', as: 'hanoutOrders' });
HanoutOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

HanoutOrder.hasMany(HanoutOrderItem, { foreignKey: 'order_id', as: 'items' });
HanoutOrderItem.belongsTo(HanoutOrder, { foreignKey: 'order_id', as: 'order' });

Organization.hasMany(PharmacyOrder, { foreignKey: 'organization_id', as: 'pharmacyOrders' });
PharmacyOrder.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

User.hasMany(PharmacyOrder, { foreignKey: 'user_id', as: 'pharmacyOrders' });
PharmacyOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

PharmacyOrder.hasMany(PharmacyOrderItem, { foreignKey: 'order_id', as: 'items' });
PharmacyOrderItem.belongsTo(PharmacyOrder, { foreignKey: 'order_id', as: 'order' });
PharmacyOrderItem.belongsTo(PharmacyMedicine, { foreignKey: 'medicine_id', as: 'medicine' });

HanoutProduct.hasMany(HanoutOrderItem, { foreignKey: 'product_id', as: 'orderItems' });
HanoutOrderItem.belongsTo(HanoutProduct, { foreignKey: 'product_id', as: 'product' });

// ── Crédit Clients (hanout) ─────────────────────────────────────────────────────
Organization.hasMany(HanoutCreditCustomer, { foreignKey: 'organization_id', as: 'hanoutCreditCustomers' });
HanoutCreditCustomer.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

HanoutCreditCustomer.hasMany(HanoutCredit, { foreignKey: 'customer_id', as: 'credits' });
HanoutCredit.belongsTo(HanoutCreditCustomer, { foreignKey: 'customer_id', as: 'customer' });

HanoutCreditCustomer.hasMany(HanoutCreditPayment, { foreignKey: 'customer_id', as: 'payments' });
HanoutCreditPayment.belongsTo(HanoutCreditCustomer, { foreignKey: 'customer_id', as: 'customer' });

Organization.hasMany(HanoutCredit, { foreignKey: 'organization_id', as: 'hanoutCredits' });
HanoutCredit.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(HanoutCreditPayment, { foreignKey: 'organization_id', as: 'hanoutCreditPayments' });
HanoutCreditPayment.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(HanoutCreditAuditLog, { foreignKey: 'organization_id', as: 'hanoutCreditAuditLogs' });
HanoutCreditAuditLog.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// ── Pharmacie ────────────────────────────────────────────────────────────────
Organization.hasOne(PharmacyProfile, { foreignKey: 'organization_id', as: 'pharmacyProfile' });
PharmacyProfile.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(PharmacyMedicine, { foreignKey: 'organization_id', as: 'pharmacyMedicines' });
PharmacyMedicine.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(PharmacyMedicineLot, { foreignKey: 'organization_id', as: 'pharmacyMedicineLots' });
PharmacyMedicineLot.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
PharmacyMedicine.hasMany(PharmacyMedicineLot, { foreignKey: 'medicine_id', as: 'lots' });
PharmacyMedicineLot.belongsTo(PharmacyMedicine, { foreignKey: 'medicine_id', as: 'medicine' });

Organization.hasMany(PharmacySupplier, { foreignKey: 'organization_id', as: 'pharmacySuppliers' });
PharmacySupplier.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
PharmacySupplier.hasMany(PharmacyMedicineLot, { foreignKey: 'supplier_id', as: 'lots' });
PharmacyMedicineLot.belongsTo(PharmacySupplier, { foreignKey: 'supplier_id', as: 'supplier' });

Organization.hasMany(PharmacyPurchaseOrder, { foreignKey: 'organization_id', as: 'pharmacyPurchaseOrders' });
PharmacyPurchaseOrder.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
PharmacySupplier.hasMany(PharmacyPurchaseOrder, { foreignKey: 'supplier_id', as: 'purchaseOrders' });
PharmacyPurchaseOrder.belongsTo(PharmacySupplier, { foreignKey: 'supplier_id', as: 'supplier' });

PharmacyPurchaseOrder.hasMany(PharmacyPurchaseOrderItem, { foreignKey: 'purchase_order_id', as: 'items' });
PharmacyPurchaseOrderItem.belongsTo(PharmacyPurchaseOrder, { foreignKey: 'purchase_order_id', as: 'purchaseOrder' });
PharmacyMedicine.hasMany(PharmacyPurchaseOrderItem, { foreignKey: 'medicine_id', as: 'purchaseOrderItems' });
PharmacyPurchaseOrderItem.belongsTo(PharmacyMedicine, { foreignKey: 'medicine_id', as: 'medicine' });

Organization.hasMany(PharmacyCustomer, { foreignKey: 'organization_id', as: 'pharmacyCustomers' });
PharmacyCustomer.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(PharmacyPrescription, { foreignKey: 'organization_id', as: 'pharmacyPrescriptions' });
PharmacyPrescription.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
PharmacyCustomer.hasMany(PharmacyPrescription, { foreignKey: 'customer_id', as: 'prescriptions' });
PharmacyPrescription.belongsTo(PharmacyCustomer, { foreignKey: 'customer_id', as: 'customer' });

PharmacyPrescription.hasMany(PharmacyPrescriptionItem, { foreignKey: 'prescription_id', as: 'items' });
PharmacyPrescriptionItem.belongsTo(PharmacyPrescription, { foreignKey: 'prescription_id', as: 'prescription' });
PharmacyMedicine.hasMany(PharmacyPrescriptionItem, { foreignKey: 'medicine_id', as: 'prescriptionItems' });
PharmacyPrescriptionItem.belongsTo(PharmacyMedicine, { foreignKey: 'medicine_id', as: 'medicine' });

Organization.hasMany(PharmacySale, { foreignKey: 'organization_id', as: 'pharmacySales' });
PharmacySale.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
PharmacyCustomer.hasMany(PharmacySale, { foreignKey: 'customer_id', as: 'sales' });
PharmacySale.belongsTo(PharmacyCustomer, { foreignKey: 'customer_id', as: 'customer' });
PharmacyPrescription.hasOne(PharmacySale, { foreignKey: 'prescription_id', as: 'sale' });
PharmacySale.belongsTo(PharmacyPrescription, { foreignKey: 'prescription_id', as: 'prescription' });

PharmacySale.hasMany(PharmacySaleItem, { foreignKey: 'sale_id', as: 'items' });
PharmacySaleItem.belongsTo(PharmacySale, { foreignKey: 'sale_id', as: 'sale' });
PharmacyMedicine.hasMany(PharmacySaleItem, { foreignKey: 'medicine_id', as: 'saleItems' });
PharmacySaleItem.belongsTo(PharmacyMedicine, { foreignKey: 'medicine_id', as: 'medicine' });
PharmacyMedicineLot.hasMany(PharmacySaleItem, { foreignKey: 'lot_id', as: 'saleItems' });
PharmacySaleItem.belongsTo(PharmacyMedicineLot, { foreignKey: 'lot_id', as: 'lot' });

Organization.hasMany(PharmacyCredit, { foreignKey: 'organization_id', as: 'pharmacyCredits' });
PharmacyCredit.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
PharmacyCustomer.hasMany(PharmacyCredit, { foreignKey: 'customer_id', as: 'credits' });
PharmacyCredit.belongsTo(PharmacyCustomer, { foreignKey: 'customer_id', as: 'customer' });

Organization.hasMany(PharmacyCreditPayment, { foreignKey: 'organization_id', as: 'pharmacyCreditPayments' });
PharmacyCreditPayment.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
PharmacyCustomer.hasMany(PharmacyCreditPayment, { foreignKey: 'customer_id', as: 'payments' });
PharmacyCreditPayment.belongsTo(PharmacyCustomer, { foreignKey: 'customer_id', as: 'customer' });

Organization.hasMany(PharmacyCreditAuditLog, { foreignKey: 'organization_id', as: 'pharmacyCreditAuditLogs' });
PharmacyCreditAuditLog.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(PharmacyRequest, { foreignKey: 'organization_id', as: 'pharmacyRequests' });
PharmacyRequest.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// ── POS / Caisse ──────────────────────────────────────────────────────────────
Organization.hasMany(CashRegisterSession, { foreignKey: 'organization_id', as: 'cashRegisterSessions' });
CashRegisterSession.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Business.hasMany(CashRegisterSession, { foreignKey: 'business_id', as: 'cashRegisterSessions' });
CashRegisterSession.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });

User.hasMany(CashRegisterSession, { foreignKey: 'cashier_id', as: 'cashRegisterSessions' });
CashRegisterSession.belongsTo(User, { foreignKey: 'cashier_id', as: 'cashier' });

CashRegisterSession.hasMany(Order, { foreignKey: 'cash_register_session_id', as: 'orders' });
Order.belongsTo(CashRegisterSession, { foreignKey: 'cash_register_session_id', as: 'cashRegisterSession' });
Order.belongsTo(User, { foreignKey: 'cashier_id', as: 'cashier' });

CashRegisterSession.hasMany(HanoutOrder, { foreignKey: 'cash_register_session_id', as: 'hanoutOrders' });
HanoutOrder.belongsTo(CashRegisterSession, { foreignKey: 'cash_register_session_id', as: 'cashRegisterSession' });
HanoutOrder.belongsTo(User, { foreignKey: 'cashier_id', as: 'cashier' });

CashRegisterSession.hasMany(PharmacyOrder, { foreignKey: 'cash_register_session_id', as: 'pharmacyOrders' });
PharmacyOrder.belongsTo(CashRegisterSession, { foreignKey: 'cash_register_session_id', as: 'cashRegisterSession' });
PharmacyOrder.belongsTo(User, { foreignKey: 'cashier_id', as: 'cashier' });

// ── Dashboard Consommateur ──────────────────────────────────────────────────
User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' });
Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Organization.hasMany(Favorite, { foreignKey: 'organization_id', as: 'favoritedBy' });
Favorite.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

User.hasMany(ShoppingList, { foreignKey: 'user_id', as: 'shoppingLists' });
ShoppingList.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ShoppingList.hasMany(ShoppingListItem, { foreignKey: 'list_id', as: 'items', onDelete: 'CASCADE' });
ShoppingListItem.belongsTo(ShoppingList, { foreignKey: 'list_id', as: 'list' });

User.hasOne(CashbackAccount, { foreignKey: 'user_id', as: 'cashbackAccount' });
CashbackAccount.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(CashbackTransaction, { foreignKey: 'user_id', as: 'cashbackTransactions' });
CashbackTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Organization.hasMany(CashbackTransaction, { foreignKey: 'organization_id', as: 'cashbackTransactions' });
CashbackTransaction.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
Order.hasMany(CashbackTransaction, { foreignKey: 'order_id', as: 'cashbackTransactions' });
CashbackTransaction.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Coupon.hasMany(CouponUsage, { foreignKey: 'coupon_id', as: 'usages' });
CouponUsage.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
User.hasMany(CouponUsage, { foreignKey: 'user_id', as: 'couponUsages' });
CouponUsage.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Loyalty Engine (règles hiérarchiques SuperAdmin/catégorie/commerce) ───────
Organization.hasOne(BusinessLoyaltySettings, { foreignKey: 'organization_id', as: 'loyaltySettings' });
BusinessLoyaltySettings.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
BusinessLoyaltySettings.belongsTo(LoyaltyRule, { foreignKey: 'active_rule_id', as: 'activeRule' });

Organization.hasMany(LoyaltyRule, { foreignKey: 'organization_id', as: 'loyaltyRules' });
LoyaltyRule.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
User.hasMany(LoyaltyRule, { foreignKey: 'created_by', as: 'createdLoyaltyRules' });
LoyaltyRule.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(LoyaltyRule, { foreignKey: 'reviewed_by', as: 'reviewedLoyaltyRules' });
LoyaltyRule.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

Organization.hasMany(LoyaltyRuleAuditLog, { foreignKey: 'organization_id', as: 'loyaltyAuditLogs' });
LoyaltyRuleAuditLog.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
User.hasMany(LoyaltyRuleAuditLog, { foreignKey: 'user_id', as: 'loyaltyAuditLogs' });
LoyaltyRuleAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Infrastructure Monitoring Center ──────────────────────────────────────────
User.hasMany(InfraAuditLog, { foreignKey: 'user_id', as: 'infraAuditLogs' });
InfraAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(InfraAlert, { foreignKey: 'acknowledged_by', as: 'acknowledgedInfraAlerts' });
InfraAlert.belongsTo(User, { foreignKey: 'acknowledged_by', as: 'acknowledger' });

// ── Hero Manager marketplace ───────────────────────────────────────────────────
MarketplaceHeroSlide.hasMany(HeroSlideEvent, { foreignKey: 'slide_id', as: 'events', onDelete: 'CASCADE' });
HeroSlideEvent.belongsTo(MarketplaceHeroSlide, { foreignKey: 'slide_id', as: 'slide' });
User.hasMany(HeroSlideEvent, { foreignKey: 'user_id', as: 'heroEvents' });
HeroSlideEvent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Hero Manager par commerce ──────────────────────────────────────────────────
Organization.hasMany(StoreHeroSlide, { foreignKey: 'organization_id', as: 'heroSlides', onDelete: 'CASCADE' });
StoreHeroSlide.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
StoreHeroSlide.hasMany(StoreHeroSlideEvent, { foreignKey: 'slide_id', as: 'events', onDelete: 'CASCADE' });
StoreHeroSlideEvent.belongsTo(StoreHeroSlide, { foreignKey: 'slide_id', as: 'slide' });

// ── Hero Manager des portails (Sports/Kids) ────────────────────────────────────
PortalHeroSlide.hasMany(PortalHeroSlideEvent, { foreignKey: 'slide_id', as: 'events', onDelete: 'CASCADE' });
PortalHeroSlideEvent.belongsTo(PortalHeroSlide, { foreignKey: 'slide_id', as: 'slide' });

// ── Module delivery (dispatch/tracking, fondation Phase 1) ────────────────────
User.hasOne(DeliveryPerson, { foreignKey: 'user_id', as: 'deliveryProfile' });
DeliveryPerson.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Organization.hasMany(DeliveryPerson, { foreignKey: 'owner_organization_id', as: 'ownedCouriers' });
DeliveryPerson.belongsTo(Organization, { foreignKey: 'owner_organization_id', as: 'ownerOrganization' });

DeliveryPerson.hasOne(DeliveryLocation, { foreignKey: 'delivery_person_id', as: 'location' });
DeliveryLocation.belongsTo(DeliveryPerson, { foreignKey: 'delivery_person_id', as: 'deliveryPerson' });

DeliveryPerson.hasMany(Delivery, { foreignKey: 'delivery_person_id', as: 'assignments' });
Delivery.belongsTo(DeliveryPerson, { foreignKey: 'delivery_person_id', as: 'courier' });

Delivery.hasMany(DeliveryStatusHistory, { foreignKey: 'assignment_id', as: 'statusHistory' });
DeliveryStatusHistory.belongsTo(Delivery, { foreignKey: 'assignment_id', as: 'assignment' });

DeliveryPerson.hasMany(DeliveryLog, { foreignKey: 'delivery_person_id', as: 'logs' });
DeliveryLog.belongsTo(DeliveryPerson, { foreignKey: 'delivery_person_id', as: 'deliveryPerson' });
Delivery.hasMany(DeliveryLog, { foreignKey: 'assignment_id', as: 'logs' });
DeliveryLog.belongsTo(Delivery, { foreignKey: 'assignment_id', as: 'assignment' });

DeliveryPerson.hasMany(DeliveryTracking, { foreignKey: 'delivery_person_id', as: 'trackingPoints' });
DeliveryTracking.belongsTo(DeliveryPerson, { foreignKey: 'delivery_person_id', as: 'deliveryPerson' });
Delivery.hasMany(DeliveryTracking, { foreignKey: 'assignment_id', as: 'trackingPoints' });
DeliveryTracking.belongsTo(Delivery, { foreignKey: 'assignment_id', as: 'assignment' });

// ── Zones & tarification (Phase 5) ─────────────────────────────────────────
Organization.hasMany(DeliveryZone, { foreignKey: 'organization_id', as: 'deliveryZones' });
DeliveryZone.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

DeliveryZone.hasMany(DeliveryZoneCourier, { foreignKey: 'zone_id', as: 'courierAssignments' });
DeliveryZoneCourier.belongsTo(DeliveryZone, { foreignKey: 'zone_id', as: 'zone' });
DeliveryPerson.hasMany(DeliveryZoneCourier, { foreignKey: 'delivery_person_id', as: 'zoneAssignments' });
DeliveryZoneCourier.belongsTo(DeliveryPerson, { foreignKey: 'delivery_person_id', as: 'deliveryPerson' });

Organization.hasMany(DeliveryPricingRule, { foreignKey: 'organization_id', as: 'deliveryPricingRules' });
DeliveryPricingRule.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
DeliveryZone.hasMany(DeliveryPricingRule, { foreignKey: 'zone_id', as: 'pricingRules' });
DeliveryPricingRule.belongsTo(DeliveryZone, { foreignKey: 'zone_id', as: 'zone' });

// ── Véhicules & documents (Phase 6) ────────────────────────────────────────
DeliveryPerson.hasMany(DeliveryVehicle, { foreignKey: 'delivery_person_id', as: 'vehicles' });
DeliveryVehicle.belongsTo(DeliveryPerson, { foreignKey: 'delivery_person_id', as: 'deliveryPerson' });

DeliveryPerson.hasMany(DeliveryDocument, { foreignKey: 'delivery_person_id', as: 'documents' });
DeliveryDocument.belongsTo(DeliveryPerson, { foreignKey: 'delivery_person_id', as: 'deliveryPerson' });
DeliveryVehicle.hasMany(DeliveryDocument, { foreignKey: 'vehicle_id', as: 'documents' });
DeliveryDocument.belongsTo(DeliveryVehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
User.hasMany(DeliveryDocument, { foreignKey: 'verified_by_user_id', as: 'verifiedDeliveryDocuments' });
DeliveryDocument.belongsTo(User, { foreignKey: 'verified_by_user_id', as: 'verifier' });

// ── SEO programmatique (villes / catégories génériques) ────────────────────────
Organization.belongsTo(City, { foreignKey: 'city_id', as: 'cityRef' });
City.hasMany(Organization, { foreignKey: 'city_id', as: 'organizations' });
Organization.belongsTo(Category, { foreignKey: 'category_id', as: 'categoryRef' });
Category.hasMany(Organization, { foreignKey: 'category_id', as: 'organizations' });
Category.belongsTo(Category, { foreignKey: 'parent_id', as: 'parent' });
Category.hasMany(Category, { foreignKey: 'parent_id', as: 'children' });

// ── Discover (articles éditoriaux) ─────────────────────────────────────────────
Article.belongsTo(City, { foreignKey: 'city_id', as: 'cityRef' });
City.hasMany(Article, { foreignKey: 'city_id', as: 'articles' });
Article.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
Article.hasMany(ArticleTranslation, { foreignKey: 'article_id', as: 'translations', onDelete: 'CASCADE' });
ArticleTranslation.belongsTo(Article, { foreignKey: 'article_id', as: 'article' });

// ── Product options (generic, all modules) ────────────────────────────────────
ProductOption.hasMany(ProductOptionValue, { foreignKey: 'option_id', as: 'values', onDelete: 'CASCADE' });
ProductOptionValue.belongsTo(ProductOption, { foreignKey: 'option_id', as: 'option' });

HanoutProduct.hasMany(ProductOption, { foreignKey: 'entity_id', scope: { entity_type: 'hanout_product' }, as: 'options', constraints: false });
ProductOption.belongsTo(HanoutProduct, { foreignKey: 'entity_id', constraints: false, as: 'hanoutProduct' });

MenuItem.hasMany(ProductOption, { foreignKey: 'entity_id', scope: { entity_type: 'menu_item' }, as: 'options', constraints: false });
ProductOption.belongsTo(MenuItem, { foreignKey: 'entity_id', constraints: false, as: 'menuItem' });

HanoutOrderItem.hasMany(OrderItemOption, { foreignKey: 'order_item_id', scope: { order_item_type: 'hanout' }, as: 'selectedOptions', constraints: false });
OrderItemOption.belongsTo(HanoutOrderItem, { foreignKey: 'order_item_id', constraints: false, as: 'orderItem' });

// ── Catalogue produit partagé ────────────────────────────────────────────────
ProductCategory.hasMany(ProductCategory, { foreignKey: 'parent_id', as: 'children' });
ProductCategory.belongsTo(ProductCategory, { foreignKey: 'parent_id', as: 'parent' });

ProductBrand.hasMany(GlobalProduct, { foreignKey: 'brand_id', as: 'products' });
GlobalProduct.belongsTo(ProductBrand, { foreignKey: 'brand_id', as: 'brand' });

ProductCategory.hasMany(GlobalProduct, { foreignKey: 'category_id', as: 'products' });
GlobalProduct.belongsTo(ProductCategory, { foreignKey: 'category_id', as: 'category' });

GlobalProduct.hasMany(ProductVariant, { foreignKey: 'global_product_id', as: 'variants' });
ProductVariant.belongsTo(GlobalProduct, { foreignKey: 'global_product_id', as: 'globalProduct' });

Organization.hasMany(GlobalProduct, { foreignKey: 'created_by_organization_id', as: 'suggestedGlobalProducts' });
GlobalProduct.belongsTo(Organization, { foreignKey: 'created_by_organization_id', as: 'createdByOrganization' });
User.hasMany(GlobalProduct, { foreignKey: 'created_by_user_id', as: 'suggestedGlobalProducts' });
GlobalProduct.belongsTo(User, { foreignKey: 'created_by_user_id', as: 'createdByUser' });

GlobalProduct.hasMany(HanoutProduct, { foreignKey: 'global_product_id', as: 'hanoutOffers' });
HanoutProduct.belongsTo(GlobalProduct, { foreignKey: 'global_product_id', as: 'globalProduct' });
ProductVariant.hasMany(HanoutProduct, { foreignKey: 'global_variant_id', as: 'hanoutOffers' });
HanoutProduct.belongsTo(ProductVariant, { foreignKey: 'global_variant_id', as: 'globalVariant' });

GlobalProduct.hasMany(PharmacyMedicine, { foreignKey: 'global_product_id', as: 'pharmacyOffers' });
PharmacyMedicine.belongsTo(GlobalProduct, { foreignKey: 'global_product_id', as: 'globalProduct' });
ProductVariant.hasMany(PharmacyMedicine, { foreignKey: 'global_variant_id', as: 'pharmacyOffers' });
PharmacyMedicine.belongsTo(ProductVariant, { foreignKey: 'global_variant_id', as: 'globalVariant' });

// ── iFilino Play (gamification) ─────────────────────────────────────────────
PlayProvider.hasMany(PlayGame, { foreignKey: 'provider_id', as: 'games' });
PlayGame.belongsTo(PlayProvider, { foreignKey: 'provider_id', as: 'provider' });

PlayGame.hasMany(PlayQuiz, { foreignKey: 'game_id', as: 'quizzes' });
PlayQuiz.belongsTo(PlayGame, { foreignKey: 'game_id', as: 'game' });

PlayQuiz.hasMany(PlayQuestion, { foreignKey: 'quiz_id', as: 'questions' });
PlayQuestion.belongsTo(PlayQuiz, { foreignKey: 'quiz_id', as: 'quiz' });

PlayQuestion.hasMany(PlayAnswer, { foreignKey: 'question_id', as: 'answers' });
PlayAnswer.belongsTo(PlayQuestion, { foreignKey: 'question_id', as: 'question' });

PlayBadge.hasMany(PlayUserBadge, { foreignKey: 'badge_id', as: 'userBadges' });
PlayUserBadge.belongsTo(PlayBadge, { foreignKey: 'badge_id', as: 'badge' });

PlayDailyMission.hasMany(PlayUserMission, { foreignKey: 'mission_id', as: 'userMissions' });
PlayUserMission.belongsTo(PlayDailyMission, { foreignKey: 'mission_id', as: 'mission' });

PlayReward.hasMany(PlayUserReward, { foreignKey: 'reward_id', as: 'userRewards' });
PlayUserReward.belongsTo(PlayReward, { foreignKey: 'reward_id', as: 'reward' });

PlayGame.hasMany(PlaySession, { foreignKey: 'game_id', as: 'sessions' });
PlaySession.belongsTo(PlayGame, { foreignKey: 'game_id', as: 'game' });

PlayGame.hasMany(PlayScore, { foreignKey: 'game_id', as: 'scores' });
PlayScore.belongsTo(PlayGame, { foreignKey: 'game_id', as: 'game' });

PlaySession.hasOne(PlayScore, { foreignKey: 'session_id', as: 'score' });
PlayScore.belongsTo(PlaySession, { foreignKey: 'session_id', as: 'session' });

PlayLevel.belongsTo(PlayBadge, { foreignKey: 'badge_reward_id', as: 'badgeReward' });

// ── Gaming Hub (fiches éditoriales sur des jeux tiers célèbres, distinct de
// PlayGame/play_games qui reste le catalogue jouable) ─────────────────────────
GamingPublisher.hasMany(GamingGame, { foreignKey: 'publisher_id', as: 'games' });
GamingGame.belongsTo(GamingPublisher, { foreignKey: 'publisher_id', as: 'publisher' });

GamingCategory.hasMany(GamingGame, { foreignKey: 'category_id', as: 'games' });
GamingGame.belongsTo(GamingCategory, { foreignKey: 'category_id', as: 'category' });

GamingGame.hasMany(GamingFaq, { foreignKey: 'gaming_game_id', as: 'faqs', onDelete: 'CASCADE' });
GamingFaq.belongsTo(GamingGame, { foreignKey: 'gaming_game_id', as: 'game' });

GamingGame.hasMany(GamingVideo, { foreignKey: 'gaming_game_id', as: 'videos', onDelete: 'CASCADE' });
GamingVideo.belongsTo(GamingGame, { foreignKey: 'gaming_game_id', as: 'game' });

GamingGame.hasMany(GamingUpdate, { foreignKey: 'gaming_game_id', as: 'updates', onDelete: 'CASCADE' });
GamingUpdate.belongsTo(GamingGame, { foreignKey: 'gaming_game_id', as: 'game' });

GamingGame.hasMany(GamingNews, { foreignKey: 'gaming_game_id', as: 'news' });
GamingNews.belongsTo(GamingGame, { foreignKey: 'gaming_game_id', as: 'game' });

GamingGame.belongsToMany(GamingGame, {
  through: GamingRelatedGame, foreignKey: 'gaming_game_id', otherKey: 'related_gaming_game_id', as: 'relatedGames',
});

// Le pont vers iFilino Play — voir gamingSimilarHtml5Game.js.
GamingGame.hasMany(GamingSimilarHtml5Game, { foreignKey: 'gaming_game_id', as: 'similarPlayGameLinks', onDelete: 'CASCADE' });
GamingSimilarHtml5Game.belongsTo(GamingGame, { foreignKey: 'gaming_game_id', as: 'game' });
PlayGame.hasMany(GamingSimilarHtml5Game, { foreignKey: 'play_game_id', as: 'gamingSimilarLinks', onDelete: 'CASCADE' });
GamingSimilarHtml5Game.belongsTo(PlayGame, { foreignKey: 'play_game_id', as: 'playGame' });

GamingArticle.hasMany(GamingArticleTranslation, { foreignKey: 'gaming_article_id', as: 'translations', onDelete: 'CASCADE' });
GamingArticleTranslation.belongsTo(GamingArticle, { foreignKey: 'gaming_article_id', as: 'article' });
GamingArticle.belongsTo(User, { foreignKey: 'author_id', as: 'author' });

// ── Ads Management ───────────────────────────────────────────────────────────
AdCampaign.belongsToMany(AdPlacement, { through: AdCampaignPlacement, foreignKey: 'campaign_id', otherKey: 'placement_id', as: 'placements' });
AdPlacement.belongsToMany(AdCampaign, { through: AdCampaignPlacement, foreignKey: 'placement_id', otherKey: 'campaign_id', as: 'campaigns' });
AdCampaign.hasMany(AdCampaignPlacement, { foreignKey: 'campaign_id', as: 'campaignPlacements', onDelete: 'CASCADE' });
AdCampaignPlacement.belongsTo(AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
AdPlacement.hasMany(AdCampaignPlacement, { foreignKey: 'placement_id', as: 'campaignPlacements', onDelete: 'CASCADE' });
AdCampaignPlacement.belongsTo(AdPlacement, { foreignKey: 'placement_id', as: 'placement' });

AdCampaign.hasMany(AdTargetingRule, { foreignKey: 'campaign_id', as: 'targetingRules', onDelete: 'CASCADE' });
AdTargetingRule.belongsTo(AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

AdCampaign.hasMany(AdImpression, { foreignKey: 'campaign_id', as: 'impressionEvents', onDelete: 'CASCADE' });
AdImpression.belongsTo(AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
AdPlacement.hasMany(AdImpression, { foreignKey: 'placement_id', as: 'impressionEvents', onDelete: 'CASCADE' });
AdImpression.belongsTo(AdPlacement, { foreignKey: 'placement_id', as: 'placement' });
User.hasMany(AdImpression, { foreignKey: 'user_id', as: 'adImpressions' });
AdImpression.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

AdCampaign.hasMany(AdClick, { foreignKey: 'campaign_id', as: 'clickEvents', onDelete: 'CASCADE' });
AdClick.belongsTo(AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
AdPlacement.hasMany(AdClick, { foreignKey: 'placement_id', as: 'clickEvents', onDelete: 'CASCADE' });
AdClick.belongsTo(AdPlacement, { foreignKey: 'placement_id', as: 'placement' });
AdImpression.hasOne(AdClick, { foreignKey: 'impression_id', as: 'click' });
AdClick.belongsTo(AdImpression, { foreignKey: 'impression_id', as: 'impression' });
User.hasMany(AdClick, { foreignKey: 'user_id', as: 'adClicks' });
AdClick.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

AdCampaign.hasMany(AdDailyStatistic, { foreignKey: 'campaign_id', as: 'dailyStats', onDelete: 'CASCADE' });
AdDailyStatistic.belongsTo(AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
AdPlacement.hasMany(AdDailyStatistic, { foreignKey: 'placement_id', as: 'dailyStats' });
AdDailyStatistic.belongsTo(AdPlacement, { foreignKey: 'placement_id', as: 'placement' });

User.hasMany(AdCampaign, { foreignKey: 'created_by', as: 'createdAdCampaigns' });
AdCampaign.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ── Portails multilingues (Kids/Sports) ─────────────────────────────────────────
PortalContent.hasMany(PortalContentTranslation, { foreignKey: 'portal_content_id', as: 'translations', onDelete: 'CASCADE' });
PortalContentTranslation.belongsTo(PortalContent, { foreignKey: 'portal_content_id', as: 'content' });
User.hasMany(Media, { foreignKey: 'created_by', as: 'createdMedia' });
Media.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Media.hasMany(MediaLink, { foreignKey: 'media_id', as: 'links', onDelete: 'CASCADE' });
MediaLink.belongsTo(Media, { foreignKey: 'media_id', as: 'media' });
Media.belongsToMany(MediaCollection, { through: MediaCollectionItem, foreignKey: 'media_id', otherKey: 'collection_id', as: 'collections' });
MediaCollection.belongsToMany(Media, { through: MediaCollectionItem, foreignKey: 'collection_id', otherKey: 'media_id', as: 'media' });
Media.belongsToMany(MediaTag, { through: MediaTagMap, foreignKey: 'media_id', otherKey: 'tag_id', as: 'tags' });
MediaTag.belongsToMany(Media, { through: MediaTagMap, foreignKey: 'tag_id', otherKey: 'media_id', as: 'media' });
Media.hasMany(MediaTranslation, { foreignKey: 'media_id', as: 'translations', onDelete: 'CASCADE' });
Media.hasMany(MediaVersion, { foreignKey: 'media_id', as: 'versions', onDelete: 'CASCADE' });
Media.hasMany(MediaEvent, { foreignKey: 'media_id', as: 'events', onDelete: 'CASCADE' });

// ── Produits numériques (achat simulé) ──────────────────────────────────────────
PortalContent.hasMany(DigitalProduct, { foreignKey: 'portal_content_id', as: 'digitalProducts', onDelete: 'CASCADE' });
DigitalProduct.belongsTo(PortalContent, { foreignKey: "portal_content_id", as: "story" });
StudyLesson.hasMany(DigitalProduct, { foreignKey: "study_lesson_id", as: "digitalProducts", onDelete: "CASCADE" });
DigitalProduct.belongsTo(StudyLesson, { foreignKey: "study_lesson_id", as: "lesson" });
DigitalProduct.hasMany(Purchase, { foreignKey: 'digital_product_id', as: 'purchases', onDelete: 'CASCADE' });
Purchase.belongsTo(DigitalProduct, { foreignKey: 'digital_product_id', as: 'product' });
User.hasMany(Purchase, { foreignKey: 'user_id', as: 'digitalPurchases' });
Purchase.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
DigitalProduct.hasMany(GeneratedFile, { foreignKey: 'digital_product_id', as: 'generatedFiles', onDelete: 'CASCADE' });
GeneratedFile.belongsTo(DigitalProduct, { foreignKey: 'digital_product_id', as: 'product' });

// ── Study (leçons iFilino Kids) ─────────────────────────────────────────────────
StudyLesson.hasMany(StudyLessonTranslation, { foreignKey: 'study_lesson_id', as: 'translations', onDelete: 'CASCADE' });
StudyLessonTranslation.belongsTo(StudyLesson, { foreignKey: 'study_lesson_id', as: 'lesson' });
StudyLesson.hasMany(StudyLessonResource, { foreignKey: 'study_lesson_id', as: 'resources', onDelete: 'CASCADE' });
StudyLessonResource.belongsTo(StudyLesson, { foreignKey: 'study_lesson_id', as: 'lesson' });

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
  PushToken,
  Order,
  OrderItem,
  TableReservation,
  Address,
  Coupon,
  LoyaltyTransaction,
  Review,
  ReviewPhoto,
  ReviewVote,
  ReviewReport,
  BusinessReply,
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
  Business,
  HanoutCategory,
  HanoutProduct,
  HanoutOrder,
  HanoutOrderItem,
  PharmacyOrder,
  PharmacyOrderItem,
  HanoutCreditCustomer,
  HanoutCredit,
  HanoutCreditPayment,
  HanoutCreditAuditLog,
  PharmacyProfile,
  PharmacyMedicine,
  PharmacyMedicineLot,
  PharmacySupplier,
  PharmacyPurchaseOrder,
  PharmacyPurchaseOrderItem,
  PharmacyCustomer,
  PharmacyPrescription,
  PharmacyPrescriptionItem,
  PharmacySale,
  PharmacySaleItem,
  PharmacyCredit,
  PharmacyCreditPayment,
  PharmacyCreditAuditLog,
  PharmacyRequest,
  ProductOption,
  ProductOptionValue,
  ProductBrand,
  ProductCategory,
  GlobalProduct,
  ProductVariant,
  OrderItemOption,
  CashRegisterSession,
  Favorite,
  ShoppingList,
  ShoppingListItem,
  CashbackAccount,
  CashbackTransaction,
  CouponUsage,
  LoyaltyRule,
  BusinessLoyaltySettings,
  LoyaltyGlobalLimits,
  LoyaltyRuleAuditLog,
  InfraAuditLog,
  InfraAlertRule,
  InfraAlert,
  InfraMetricSnapshot,
  AuthFailedLogin,
  MarketplaceHeroSlide,
  HeroSlideEvent,
  StoreHeroSlide,
  StoreHeroSlideEvent,
  PortalHeroSlide,
  PortalHeroSlideEvent,
  DeliveryPerson,
  DeliveryLocation,
  DeliveryStatusHistory,
  DeliveryLog,
  DeliveryTracking,
  DeliveryZone,
  DeliveryZoneCourier,
  DeliveryPricingRule,
  DeliveryVehicle,
  DeliveryDocument,
  City,
  Category,
  Article,
  ArticleTranslation,
  NewsletterSubscriber,
  PlayGame,
  PlayProvider,
  PlayBadge,
  PlayUserBadge,
  PlayLevel,
  PlayXp,
  PlayQuiz,
  PlayQuestion,
  PlayAnswer,
  PlayDailyMission,
  PlayUserMission,
  PlayReward,
  PlayUserReward,
  PlaySession,
  PlayScore,
  PlayStatistic,
  TrafficEvent,
  GamingPublisher,
  GamingPlatform,
  GamingCategory,
  GamingTag,
  GamingGame,
  GamingFaq,
  GamingVideo,
  GamingUpdate,
  GamingNews,
  GamingRelatedGame,
  GamingSimilarHtml5Game,
  GamingArticle,
  GamingArticleTranslation,
  AdCampaign,
  AdPlacement,
  AdCampaignPlacement,
  AdTargetingRule,
  AdImpression,
  AdClick,
  AdDailyStatistic,
  PortalContent,
  PortalContentTranslation,
  DigitalProduct,
  PaymentProviderConfig,
  Purchase,
  GeneratedFile,
  StudyLesson,
  StudyLessonTranslation,
  StudyLessonResource,
  Media,
  MediaLink, MediaCollection, MediaCollectionItem, MediaTag, MediaTagMap, MediaTranslation, MediaVersion, MediaEvent,
};
