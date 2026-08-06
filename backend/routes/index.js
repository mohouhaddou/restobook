'use strict';

const express = require('express');
const router = express.Router();
const { APP_NAME } = require('../src/config/branding');
const { requireAuth, requireWebAdmin, requireMarketAdmin } = require('../src/middleware/auth');

router.get('/', (req, res) => res.json({ message: `${APP_NAME} API v2` }));

// ── Auth ─────────────────────────────────────────────────────────────────────
router.use('/auth',        require('../src/shared/auth/routes'));

// ── Resto ────────────────────────────────────────────────────────────────────
router.use('/menu',        require('../src/market/resto/menuRoutes'));
router.use('/restaurant',  require('../src/market/resto/dashboardRoutes'));
router.use('/restaurant-saas', require('../src/market/resto/saasRoutes'));
router.use('/satisfaction', require('../src/market/resto/satisfactionRoutes'));
router.use('/nutrition',   require('../src/market/resto/nutritionRoutes'));
router.use('/tables',      require('../src/market/resto/tablesRoutes'));

// ── Cantine ──────────────────────────────────────────────────────────────────
router.use('/canteen',     require('../src/market/cantine/routes'));
router.use('/canteens',    require('../src/market/cantine/canteensRoutes'));
router.use('/stats',       require('../src/market/cantine/statsRoutes'));

// ── Marketplace ──────────────────────────────────────────────────────────────
router.use('/marketplace', require('../src/market/marketplace/routes'));
router.use('/loyalty',     require('../src/market/marketplace/loyaltyRoutes'));
router.use('/pub',         require('../src/market/marketplace/publicMenuRoutes'));

// ── Discover (contenu éditorial) ─────────────────────────────────────────────
router.use('/discover',    require('../src/web/discover/routes'));

// ── Gaming Hub (portail SEO éditorial sur des jeux tiers célèbres — distinct
// de /play, le catalogue de jeux HTML5 réellement jouables) ─────────────────
router.use('/gaminghub',   require('../src/web/gaminghub/routes'));
router.use('/portals',     require('../src/web/portals/routes'));
router.use('/media',       require('../src/shared/media/analyticsRoutes'));
router.use('/media',       require('../src/shared/media/uploadRoutes'));
router.use('/media',       require('../src/shared/media/routes'));
router.use('/stories',     require('../src/shared/media/storyRoutes'));
router.use('/study',       require('../src/web/study/routes'));
router.use('/narration',   require('../src/web/narration/routes'));

// ── Dashboard Consommateur ───────────────────────────────────────────────────
router.use('/dashboard',   require('../src/market/dashboard/routes'));

// ── Organizations ────────────────────────────────────────────────────────────
router.use('/restaurants', require('../src/shared/organizations/routes'));

// ── Orders ───────────────────────────────────────────────────────────────────
router.use('/orders',      require('../src/market/orders/routes'));
// Ordre important : /me et /me/status doivent être testés AVANT le
// /:orderId/status générique de deliveryRoutes.js (sinon Express matche
// "me" comme si c'était un :orderId et renvoie 400 avant d'atteindre le
// bon handler).
router.use('/delivery',    require('../src/market/delivery/routes'));
router.use('/delivery',    require('../src/market/delivery/assignmentRoutes'));
router.use('/delivery',    require('../src/market/delivery/locationRoutes'));
router.use('/delivery',    require('../src/market/delivery/zoneRoutes'));
router.use('/delivery',    require('../src/market/delivery/pricingRoutes'));
router.use('/delivery',    require('../src/market/delivery/vehicleRoutes'));
router.use('/delivery',    require('../src/market/delivery/documentRoutes'));
router.use('/delivery',    require('../src/market/orders/deliveryRoutes'));

// ── Reservations ─────────────────────────────────────────────────────────────
router.use('/reservations', require('../src/market/reservations/routes'));

// ── POS / Caisse ─────────────────────────────────────────────────────────────
router.use('/pos',         require('../src/market/pos/routes'));

// ── Notifications ────────────────────────────────────────────────────────────
router.use('/notifications', require('../src/shared/notifications/routes'));

// ── Admin ────────────────────────────────────────────────────────────────────
router.use('/admin',       require('../src/shared/admin/routes'));
router.use('/superadmin',  require('../src/shared/admin/superadminRoutes'));
router.use('/superadmin/ai-import', require('../src/web/ai-import/routes'));
router.use('/superadmin/loyalty', require('../src/shared/admin/loyaltyProgramRoutes'));
router.use('/superadmin/infra', require('../src/shared/infra/infraMonitoringRoutes'));
router.use('/superadmin/hero', require('../src/market/marketplaceHero/routes'));
router.use('/superadmin/discover', require('../src/web/discover/adminRoutes'));
router.use('/superadmin/gaminghub', require('../src/web/gaminghub/adminRoutes'));
router.use('/superadmin/portals', require('../src/web/portals/adminRoutes'));
router.use('/superadmin/study', require('../src/web/study/adminRoutes'));
router.use('/comics', require('../src/web/comics/engagementRoutes'));
router.use('/comics', require('../src/web/comics/publicRoutes'));
router.use('/comics', require('../src/web/comics/editorialRoutes'));
router.use('/comics', require('../src/web/comics/draftRoutes'));
router.use('/comics', require('../src/web/comics/dashboardRoutes'));
router.use('/superadmin/acquisition', require('../src/market/acquisition/routes'));
router.use('/superadmin/play', require('../src/web/play/adminRoutes'));
router.use('/superadmin/ads', require('../src/web/ads/adminRoutes'));
router.use('/superadmin/ad-placements', require('../src/web/ads/placementRoutes'));
router.use('/ads', require('../src/web/ads/publicRoutes'));
router.use('/play',            require('../src/web/play/routes'));
router.use('/store/hero',  require('../src/market/storeHero/publicRoutes'));  // public, sans auth
router.use('/store-hero',  require('../src/market/storeHero/routes'));        // vendeur, scopé à req.user.organization_id
router.use('/portal-hero', require('../src/web/portalHero/publicRoutes')); // public, sans auth
router.use('/superadmin/portal-hero', require('../src/web/portalHero/adminRoutes')); // superadmin, scopé au portail
router.use('/digital-products', require('../src/web/digitalProducts/routes')); // consommateur (resolveReader)
router.use('/superadmin/digital-products', require('../src/web/digitalProducts/adminRoutes')); // superadmin
router.use('/payments', require('../src/shared/payments/routes')); // public, sans auth
router.use('/superadmin/payments', require('../src/shared/payments/adminRoutes')); // superadmin
router.use('/',           require('../src/market/reviews/routes'));
router.use('/business',    require('../src/market/businesses/routes'));      // dashboard

// ── Business entity (profil public Ifighak) ──────────────────────────────────
router.use('/businesses',  require('../src/market/businesses/businessRoutes'));

// ── Catalogue produit partagé ────────────────────────────────────────────────
router.use('/catalog',         require('../src/market/catalog/routes'));
router.use('/merchant/products', require('../src/market/catalog/merchantRoutes'));

// ── Hanout ───────────────────────────────────────────────────────────────────
router.use('/hanout',      require('../src/market/hanout/publicRoutes'));
router.use('/hanout-pro/credit', require('../src/market/hanout/creditRoutes'));
router.use('/hanout-pro',  require('../src/market/hanout/proRoutes'));

// ── Pharmacie ────────────────────────────────────────────────────────────────
router.use('/pharmacy',      require('../src/market/pharmacy/publicRoutes'));
router.use('/pharmacy-pro/credit', require('../src/market/pharmacy/creditRoutes'));
router.use('/pharmacy-pro',  require('../src/market/pharmacy/proRoutes'));

// ── Web Admin / Market Admin (namespacing additif) ──────────────────────────
// Alias supplémentaires, gatés par requireWebAdmin/requireMarketAdmin, vers
// les routeurs superadmin déjà montés ci-dessus sous /superadmin/*. Aucun
// chemin existant n'est retiré ni modifié — le frontend continue d'appeler
// /api/superadmin/* sans changement de comportement. Ces alias préparent la
// scission des deux back-offices (voir docs/PLATFORM_SPLIT_WEB_MARKET.md,
// Phase 3) sans toucher au routing nginx/DNS existant.
//
// Chaque routeur cible applique déjà en interne requireAuth+requireSuperAdmin
// (inchangé) ; la couche requireWebAdmin/requireMarketAdmin ajoutée ici est
// donc redondante avec l'accès superadmin actuel (aucun changement de
// comportement observable), mais vérifie déjà le bon groupe de permissions
// pour rester correcte le jour où des rôles admin plus fins existeront.

// -- ifilino-web --
router.use('/web-admin/discover',        requireAuth, requireWebAdmin, require('../src/web/discover/adminRoutes'));
router.use('/web-admin/gaminghub',       requireAuth, requireWebAdmin, require('../src/web/gaminghub/adminRoutes'));
router.use('/web-admin/portals',         requireAuth, requireWebAdmin, require('../src/web/portals/adminRoutes'));
router.use('/web-admin/study',           requireAuth, requireWebAdmin, require('../src/web/study/adminRoutes'));
router.use('/web-admin/play',            requireAuth, requireWebAdmin, require('../src/web/play/adminRoutes'));
router.use('/web-admin/ads',             requireAuth, requireWebAdmin, require('../src/web/ads/adminRoutes'));
router.use('/web-admin/ad-placements',   requireAuth, requireWebAdmin, require('../src/web/ads/placementRoutes'));
router.use('/web-admin/ai-import',       requireAuth, requireWebAdmin, require('../src/web/ai-import/routes'));
router.use('/web-admin/portal-hero',     requireAuth, requireWebAdmin, require('../src/web/portalHero/adminRoutes'));
router.use('/web-admin/digital-products', requireAuth, requireWebAdmin, require('../src/web/digitalProducts/adminRoutes'));

// -- ifilino-market --
router.use('/market-admin/loyalty',      requireAuth, requireMarketAdmin, require('../src/shared/admin/loyaltyProgramRoutes'));
router.use('/market-admin/hero',         requireAuth, requireMarketAdmin, require('../src/market/marketplaceHero/routes'));
router.use('/market-admin/acquisition',  requireAuth, requireMarketAdmin, require('../src/market/acquisition/routes'));
router.use('/market-admin/businesses',   requireAuth, requireMarketAdmin, require('../src/market/businesses/businessRoutes'));
router.use('/market-admin/delivery/documents', requireAuth, requireMarketAdmin, require('../src/market/delivery/documentRoutes'));

// -- shared (montés dans les deux, jamais dupliqués en logique) --
router.use('/web-admin/payments',        requireAuth, requireWebAdmin, require('../src/shared/payments/adminRoutes'));
router.use('/market-admin/payments',     requireAuth, requireMarketAdmin, require('../src/shared/payments/adminRoutes'));

module.exports = router;
