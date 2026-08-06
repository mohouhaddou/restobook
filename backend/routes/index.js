'use strict';

const express = require('express');
const router = express.Router();
const { APP_NAME } = require('../src/config/branding');
const { requireAuth, requireWebAdmin, requireMarketAdmin } = require('../src/middleware/auth');

router.get('/', (req, res) => res.json({ message: `${APP_NAME} API v2` }));

// ── Auth ─────────────────────────────────────────────────────────────────────
router.use('/auth',        require('../src/modules/auth/routes'));

// ── Resto ────────────────────────────────────────────────────────────────────
router.use('/menu',        require('../src/modules/resto/menuRoutes'));
router.use('/restaurant',  require('../src/modules/resto/dashboardRoutes'));
router.use('/restaurant-saas', require('../src/modules/resto/saasRoutes'));
router.use('/satisfaction', require('../src/modules/resto/satisfactionRoutes'));
router.use('/nutrition',   require('../src/modules/resto/nutritionRoutes'));
router.use('/tables',      require('../src/modules/resto/tablesRoutes'));

// ── Cantine ──────────────────────────────────────────────────────────────────
router.use('/canteen',     require('../src/modules/cantine/routes'));
router.use('/canteens',    require('../src/modules/cantine/canteensRoutes'));
router.use('/stats',       require('../src/modules/cantine/statsRoutes'));

// ── Marketplace ──────────────────────────────────────────────────────────────
router.use('/marketplace', require('../src/modules/marketplace/routes'));
router.use('/loyalty',     require('../src/modules/marketplace/loyaltyRoutes'));
router.use('/pub',         require('../src/modules/marketplace/publicMenuRoutes'));

// ── Discover (contenu éditorial) ─────────────────────────────────────────────
router.use('/discover',    require('../src/modules/discover/routes'));

// ── Gaming Hub (portail SEO éditorial sur des jeux tiers célèbres — distinct
// de /play, le catalogue de jeux HTML5 réellement jouables) ─────────────────
router.use('/gaminghub',   require('../src/modules/gaminghub/routes'));
router.use('/portals',     require('../src/modules/portals/routes'));
router.use('/media',       require('../src/modules/media/analyticsRoutes'));
router.use('/media',       require('../src/modules/media/uploadRoutes'));
router.use('/media',       require('../src/modules/media/routes'));
router.use('/stories',     require('../src/modules/media/storyRoutes'));
router.use('/study',       require('../src/modules/study/routes'));
router.use('/narration',   require('../src/modules/narration/routes'));

// ── Dashboard Consommateur ───────────────────────────────────────────────────
router.use('/dashboard',   require('../src/modules/dashboard/routes'));

// ── Organizations ────────────────────────────────────────────────────────────
router.use('/restaurants', require('../src/modules/organizations/routes'));

// ── Orders ───────────────────────────────────────────────────────────────────
router.use('/orders',      require('../src/modules/orders/routes'));
// Ordre important : /me et /me/status doivent être testés AVANT le
// /:orderId/status générique de deliveryRoutes.js (sinon Express matche
// "me" comme si c'était un :orderId et renvoie 400 avant d'atteindre le
// bon handler).
router.use('/delivery',    require('../src/modules/delivery/routes'));
router.use('/delivery',    require('../src/modules/delivery/assignmentRoutes'));
router.use('/delivery',    require('../src/modules/delivery/locationRoutes'));
router.use('/delivery',    require('../src/modules/delivery/zoneRoutes'));
router.use('/delivery',    require('../src/modules/delivery/pricingRoutes'));
router.use('/delivery',    require('../src/modules/delivery/vehicleRoutes'));
router.use('/delivery',    require('../src/modules/delivery/documentRoutes'));
router.use('/delivery',    require('../src/modules/orders/deliveryRoutes'));

// ── Reservations ─────────────────────────────────────────────────────────────
router.use('/reservations', require('../src/modules/reservations/routes'));

// ── POS / Caisse ─────────────────────────────────────────────────────────────
router.use('/pos',         require('../src/modules/pos/routes'));

// ── Notifications ────────────────────────────────────────────────────────────
router.use('/notifications', require('../src/modules/notifications/routes'));

// ── Admin ────────────────────────────────────────────────────────────────────
router.use('/admin',       require('../src/modules/admin/routes'));
router.use('/superadmin',  require('../src/modules/admin/superadminRoutes'));
router.use('/superadmin/ai-import', require('../src/modules/ai-import/routes'));
router.use('/superadmin/loyalty', require('../src/modules/admin/loyaltyProgramRoutes'));
router.use('/superadmin/infra', require('../src/modules/infra/infraMonitoringRoutes'));
router.use('/superadmin/hero', require('../src/modules/marketplaceHero/routes'));
router.use('/superadmin/discover', require('../src/modules/discover/adminRoutes'));
router.use('/superadmin/gaminghub', require('../src/modules/gaminghub/adminRoutes'));
router.use('/superadmin/portals', require('../src/modules/portals/adminRoutes'));
router.use('/superadmin/study', require('../src/modules/study/adminRoutes'));
router.use('/comics', require('../src/modules/comics/engagementRoutes'));
router.use('/comics', require('../src/modules/comics/publicRoutes'));
router.use('/comics', require('../src/modules/comics/editorialRoutes'));
router.use('/comics', require('../src/modules/comics/draftRoutes'));
router.use('/comics', require('../src/modules/comics/dashboardRoutes'));
router.use('/superadmin/acquisition', require('../src/modules/acquisition/routes'));
router.use('/superadmin/play', require('../src/modules/play/adminRoutes'));
router.use('/superadmin/ads', require('../src/modules/ads/adminRoutes'));
router.use('/superadmin/ad-placements', require('../src/modules/ads/placementRoutes'));
router.use('/ads', require('../src/modules/ads/publicRoutes'));
router.use('/play',            require('../src/modules/play/routes'));
router.use('/store/hero',  require('../src/modules/storeHero/publicRoutes'));  // public, sans auth
router.use('/store-hero',  require('../src/modules/storeHero/routes'));        // vendeur, scopé à req.user.organization_id
router.use('/portal-hero', require('../src/modules/portalHero/publicRoutes')); // public, sans auth
router.use('/superadmin/portal-hero', require('../src/modules/portalHero/adminRoutes')); // superadmin, scopé au portail
router.use('/digital-products', require('../src/modules/digitalProducts/routes')); // consommateur (resolveReader)
router.use('/superadmin/digital-products', require('../src/modules/digitalProducts/adminRoutes')); // superadmin
router.use('/payments', require('../src/modules/payments/routes')); // public, sans auth
router.use('/superadmin/payments', require('../src/modules/payments/adminRoutes')); // superadmin
router.use('/',           require('../src/modules/reviews/routes'));
router.use('/business',    require('../src/modules/businesses/routes'));      // dashboard

// ── Business entity (profil public Ifighak) ──────────────────────────────────
router.use('/businesses',  require('../src/modules/businesses/businessRoutes'));

// ── Catalogue produit partagé ────────────────────────────────────────────────
router.use('/catalog',         require('../src/modules/catalog/routes'));
router.use('/merchant/products', require('../src/modules/catalog/merchantRoutes'));

// ── Hanout ───────────────────────────────────────────────────────────────────
router.use('/hanout',      require('../src/modules/hanout/publicRoutes'));
router.use('/hanout-pro/credit', require('../src/modules/hanout/creditRoutes'));
router.use('/hanout-pro',  require('../src/modules/hanout/proRoutes'));

// ── Pharmacie ────────────────────────────────────────────────────────────────
router.use('/pharmacy',      require('../src/modules/pharmacy/publicRoutes'));
router.use('/pharmacy-pro/credit', require('../src/modules/pharmacy/creditRoutes'));
router.use('/pharmacy-pro',  require('../src/modules/pharmacy/proRoutes'));

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
router.use('/web-admin/discover',        requireAuth, requireWebAdmin, require('../src/modules/discover/adminRoutes'));
router.use('/web-admin/gaminghub',       requireAuth, requireWebAdmin, require('../src/modules/gaminghub/adminRoutes'));
router.use('/web-admin/portals',         requireAuth, requireWebAdmin, require('../src/modules/portals/adminRoutes'));
router.use('/web-admin/study',           requireAuth, requireWebAdmin, require('../src/modules/study/adminRoutes'));
router.use('/web-admin/play',            requireAuth, requireWebAdmin, require('../src/modules/play/adminRoutes'));
router.use('/web-admin/ads',             requireAuth, requireWebAdmin, require('../src/modules/ads/adminRoutes'));
router.use('/web-admin/ad-placements',   requireAuth, requireWebAdmin, require('../src/modules/ads/placementRoutes'));
router.use('/web-admin/ai-import',       requireAuth, requireWebAdmin, require('../src/modules/ai-import/routes'));
router.use('/web-admin/portal-hero',     requireAuth, requireWebAdmin, require('../src/modules/portalHero/adminRoutes'));
router.use('/web-admin/digital-products', requireAuth, requireWebAdmin, require('../src/modules/digitalProducts/adminRoutes'));

// -- ifilino-market --
router.use('/market-admin/loyalty',      requireAuth, requireMarketAdmin, require('../src/modules/admin/loyaltyProgramRoutes'));
router.use('/market-admin/hero',         requireAuth, requireMarketAdmin, require('../src/modules/marketplaceHero/routes'));
router.use('/market-admin/acquisition',  requireAuth, requireMarketAdmin, require('../src/modules/acquisition/routes'));
router.use('/market-admin/businesses',   requireAuth, requireMarketAdmin, require('../src/modules/businesses/businessRoutes'));
router.use('/market-admin/delivery/documents', requireAuth, requireMarketAdmin, require('../src/modules/delivery/documentRoutes'));

// -- shared (montés dans les deux, jamais dupliqués en logique) --
router.use('/web-admin/payments',        requireAuth, requireWebAdmin, require('../src/modules/payments/adminRoutes'));
router.use('/market-admin/payments',     requireAuth, requireMarketAdmin, require('../src/modules/payments/adminRoutes'));

module.exports = router;
