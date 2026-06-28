# Changelog RestoBook — Next Level Marketplace

## [v3.0.0] — 2026-06-09 — Phase A : Extensions modèles marketplace

### Added
- `backend/scripts/migrate_v3.js` — migration SQL idempotente Phase A
- `backend/models/menuCategory.js` — catégories menu par organisation
- `backend/models/address.js` — adresses de livraison clients
- `backend/models/coupon.js` — codes promo (%, montant fixe)
- `backend/models/review.js` — avis clients avec rating 1-5
- `backend/models/delivery.js` — suivi livraisons (livreur, statut, GPS)
- `backend/models/cart.js` + `cartItem.js` — paniers persistants
- `backend/routes/marketplace.js` — APIs publiques marketplace
- `backend/routes/restaurantDashboard.js` — dashboard restaurant enrichi
- `backend/routes/delivery.js` — module livreur
- `frontend/src/pages/MarketplacePage.jsx` — listing restaurants public
- `frontend/src/pages/RestaurantPage.jsx` — détail restaurant + menu + panier
- `frontend/src/pages/CheckoutPage.jsx` — tunnel de commande
- `frontend/src/pages/OrderTrackingPage.jsx` — suivi commande public
- `frontend/src/pages/DeliveryPage.jsx` — interface livreur
- `frontend/src/contexts/CartContext.jsx` — gestion panier localStorage

### Changed
- `backend/models/organization.js` — +address, +city, +zone, +phone, +email, +description, +logo_url, +cover_url, +opening_hours (JSON), +cuisine_type, +accepts_delivery, +accepts_takeaway, +accepts_dine_in, +delivery_fee, +min_order_amount, +avg_prep_time, +avg_rating, +total_reviews, +latitude, +longitude, +is_featured. ENUM type étendu.
- `backend/models/user.js` — +phone, +avatar_url. ENUM role étendu (customer, delivery).
- `backend/models/order.js` — +delivery_address, +delivery_fee, +service_fee, +discount_amount, +coupon_code, +payment_method, +payment_status, +estimated_ready_at. ENUM status étendu.
- `backend/models/menuItem.js` — +category_id, +sort_order, +is_available.
- `backend/models/index.js` — nouveaux modèles + associations
- `backend/index.js` — Socket.IO intégré (http.Server), routes ajoutées
- `frontend/src/App.jsx` — routes marketplace, CartContext provider
- `frontend/src/pages/OrdersPage.jsx` — Kanban live + Socket.IO

### Database migrations
```sql
ALTER TABLE organizations ADD COLUMN address ...
ALTER TABLE users ADD COLUMN phone ...
ALTER TABLE orders ADD COLUMN delivery_address ...
ALTER TABLE menu_items ADD COLUMN category_id ...
CREATE TABLE menu_categories ...
CREATE TABLE addresses ...
CREATE TABLE coupons ...
CREATE TABLE reviews ...
CREATE TABLE deliveries ...
CREATE TABLE carts ...
CREATE TABLE cart_items ...
```

---

## [v2.7.0] — 2026-06-08 — Phase 7 : Seeders démo

### Added
- `backend/scripts/seed_demo.js` — 3 organisations démo (TechCorp, École Jules Ferry, Snack Le Rapide)
- `backend/scripts/seed_food_images.js` — images plats

---

## [v2.6.0] — 2026-06-08 — Phase 6 : Sécurité & qualité

### Added
- `backend/middleware/errorHandler.js` — gestion d'erreurs centralisée
- `backend/middleware/validate.js` — helpers express-validator
- Rate limiting : login (15/15min), signup (5/h), API globale (300/min)
- Input validation sur toutes les routes orders, tables, admin, superadmin

---

## [v2.5.0] — 2026-06-07 — Phase 5 : Frontend refactorisé

### Added
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/hooks/useApi.js` + `useNotifications.js`
- `frontend/src/components/layout/` (Navbar, Sidebar, PageLayout)
- `frontend/src/components/ui/` (Badge, Toast, EmptyState, ConfirmModal)
- `frontend/src/pages/` — 12 pages React

### Changed
- App.jsx : de 3237 lignes à architecture modulaire multi-fichiers

---

## [v2.4.0] — 2026-06-07 — Phase 4 : Restaurant module

### Added
- `backend/models/order.js` + `orderItem.js`
- `backend/models/tableReservation.js`
- `backend/routes/orders.js`
- `backend/routes/tables.js`
- `backend/routes/publicMenu.js`
- `backend/scripts/migrate_restaurant.js`

---

## [v2.3.0] — 2026-06-07 — Phase 3 : Stats Canteen

### Added
- `backend/routes/stats.js` — daily, weekly, range, dashboard, top-items

---

## [v2.2.0] — 2026-06-07 — Phase 2 : RBAC étendu

### Changed
- `backend/models/user.js` — ENUM role étendu (superadmin, owner, staff)
- `backend/middleware/auth.js` — requireSuperAdmin, requireOrganizationAccess, orgScope
- `backend/routes/superadmin.js` — CRUD organisations

---

## [v2.1.0] — 2026-06-07 — Phase 1 : Multi-tenant

### Added
- `backend/models/organization.js`
- `backend/models/db.js`
- `backend/scripts/migrate.js`

---

## [v2.0.0] — 2026-06-07 — Phase 0 : Bugs critiques

### Fixed
- Circular require dans models
- UNIQUE constraint daily_menus
- JWT secret hardcodé → variable d'environnement
