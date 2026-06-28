# Audit Technique RestoBook — Next Level Marketplace
**Date :** 2026-06-09  
**Auditeur :** Claude (architecte SaaS senior)  
**Objectif :** Évaluer l'état actuel avant transformation marketplace food delivery

---

## 1. Résumé exécutif

RestoBook v2 SaaS est une base multi-tenant solide. Les phases 0→7 ont établi l'architecture essentielle : multi-tenant Organization, RBAC 6 rôles, rate limiting, validation des inputs, error handler centralisé, modèles Order/OrderItem/TableReservation, et un frontend React refactorisé en 12 pages.

**Score actuel :**
| Dimension | Note | Commentaire |
|-----------|------|-------------|
| Architecture multi-tenant | 8/10 | Bonne isolation via orgScope, manque isolation delivery |
| Sécurité | 7/10 | JWT, rate limit, validation OK. Secret JWT faible en prod |
| Modèles de données | 5/10 | Base solide mais marketplace = 12 modèles manquants |
| APIs backend | 6/10 | CRUD OK, marketplace inexistant |
| Frontend UX | 5/10 | Fonctionnel mais pas food delivery |
| Real-time | 1/10 | Polling 30s uniquement, pas de WebSocket |
| Performance | 5/10 | Pas de pagination sur orders, pas de cache |
| Docs/ops | 7/10 | RUNBOOK, CHANGELOG, migrations documentés |

---

## 2. Inventaire de l'existant

### 2.1 Backend — Modèles Sequelize

| Modèle | Table | Champs clés | État |
|--------|-------|-------------|------|
| Organization | organizations | slug, name, type, plan, active | ✅ Présent. Manque address, phone, hours, delivery, cuisine |
| User | users | matricule, nom, email, role, hash_mdp, actif, organization_id | ✅ Présent. Manque phone, avatar, rôles customer/delivery |
| MenuItem | menu_items | libelle, type (ENUM), prix, image_url, allergenes, calories, actif | ✅ Présent. Manque category_id, sort_order, is_available |
| DailyMenu | daily_menus | date_jour, locked, organization_id | ✅ Présent (cantine) |
| DailyMenuItem | daily_menu_items | daily_menu_id, menu_item_id, stock_quota | ✅ Présent |
| Reservation | reservations | user_id, menu_item_id, date_jour, status, pickup_code | ✅ Présent (cantine) |
| Setting | settings | key, value, organization_id | ✅ Présent |
| Notification | notifications | recipient_id, type, title, message, read_at, organization_id | ✅ Présent |
| Order | orders | type, status, total_amount, notes, pickup_code, table_label | ⚠️ Présent mais incomplet (pas delivery, pas paiement) |
| OrderItem | order_items | order_id, menu_item_id, quantity, unit_price | ✅ Présent |
| TableReservation | table_reservations | guest_name, date_jour, time_slot, status | ✅ Présent |

### 2.2 Backend — Routes

| Route | Accès | État |
|-------|-------|------|
| POST /api/auth/login | Public | ✅ |
| GET /api/auth/me | Auth | ✅ |
| /api/menu/* | Auth (manager+) | ✅ CRUD items + daily menus |
| /api/reservations/* | Auth | ✅ Réservation, scan QR, export CSV |
| /api/orders/* | Auth | ✅ CRUD + statuts |
| /api/tables/* | Auth (manager+) | ✅ |
| /api/stats/* | Auth (manager+) | ✅ daily, weekly, range, dashboard, top-items |
| /api/admin/* | Auth (admin+) | ✅ Users, settings, branding |
| /api/superadmin/* | SuperAdmin | ✅ Orgs CRUD, stats globales |
| /api/pub/:slug/* | Public | ✅ info, menu, categories |
| /api/settings | Public | ✅ |
| /api/notifications/* | Auth | ✅ |
| **GET /api/marketplace/restaurants** | ❌ MANQUANT | Listing public restaurants |
| **GET /api/marketplace/restaurants/:slug** | ❌ MANQUANT | Détail restaurant |
| **POST /api/marketplace/orders** | ❌ MANQUANT | Commande client externe |
| **GET /api/marketplace/track/:code** | ❌ MANQUANT | Suivi commande public |
| **POST /api/marketplace/cart/validate** | ❌ MANQUANT | Validation panier |
| **POST /api/marketplace/reviews** | ❌ MANQUANT | Avis clients |
| **GET /api/marketplace/coupons/validate** | ❌ MANQUANT | Validation coupon |
| **GET /api/restaurant/orders/live** | ❌ MANQUANT | Dashboard temps réel |
| **/api/delivery/*** | ❌ MANQUANT | Module livreur complet |

### 2.3 Frontend — Pages existantes

| Page | Route | État |
|------|-------|------|
| LoginPage | /login | ✅ |
| DashboardPage | / | ✅ Stats cantine du jour |
| PlanningPage | /planning | ✅ Menu du jour, quotas |
| PrepPage | /prep | ✅ Liste de production |
| QrScanPage | /qr | ✅ Scan validation cantine |
| ItemsPage | /items | ✅ CRUD plats |
| UsersPage | /users | ✅ Gestion utilisateurs |
| SettingsPage | /settings | ✅ Branding, paramètres |
| StatsPage | /stats | ✅ Graphiques réservations |
| OrgsPage | /orgs | ✅ SuperAdmin orgs |
| ProfilePage | /profile | ✅ |
| OrdersPage | /orders | ✅ Dashboard commandes (polling 30s) |
| **MarketplacePage** | /marketplace | ❌ MANQUANT |
| **RestaurantPage** | /r/:slug | ❌ MANQUANT |
| **CartPage/CheckoutPage** | /checkout | ❌ MANQUANT |
| **OrderTrackingPage** | /track/:code | ❌ MANQUANT |
| **CustomerProfilePage** | /me | ❌ MANQUANT |
| **DeliveryPage** | /delivery | ❌ MANQUANT |
| **PlatformAdminPage** | /platform | ❌ MANQUANT |

---

## 3. Dette technique identifiée

### 3.1 Sécurité 🔴

| Problème | Sévérité | Solution |
|----------|----------|----------|
| `JWT_SECRET` en prod = hash de 97 caractères hexadécimaux — pas de rotation | Moyen | Générer 256 bits via `openssl rand -hex 32`, documenter rotation |
| `PUBLIC_BASE_URL` contient une IP fixe (91.98.138.100) | Faible | Utiliser variable d'env ou domaine |
| Pas de refresh tokens — JWT 8h = si volé, valide 8h | Moyen | Ajouter refresh token (phase ultérieure) |
| `ALLOW_SELF_SIGNUP=true` — n'importe qui peut créer un compte | Moyen | Contrôle par org (allowSelfSignup setting) |
| Pas de validation des types de fichiers image (multer) | Moyen | Whitelist MIME types (image/jpeg, image/png, image/webp) |
| Uploads dans `backend/uploads/` — pas de quota | Faible | Ajouter `fileSize: 5MB` limit, organiser par org |
| Cross-org data leak possible si orgScope() non appelé sur nouvelle route | Élevé | Middleware global orgScope — vérifier chaque nouvelle route |
| SQL injection dans migrate.js via string interpolation | Faible | Corriger dans migrate_v3.js (utiliser paramètres bindés) |

### 3.2 Modèles de données 🟡

| Problème | Impact | Solution |
|----------|--------|----------|
| `MenuItem.type` est un ENUM rigide ('plat','entrée','dessert','boisson') | Bloquant marketplace | Ajouter `MenuCategory` model, garder type en fallback |
| `Organization.type` ENUM limité ('canteen','restaurant') | Bloquant | Étendre à 'snack','dark_kitchen','bakery','cafe' |
| `Order` n'a pas de champ delivery address, delivery_fee, payment | Bloquant | Étendre Order model |
| `User` n'a pas de phone, avatar_url | Bloquant pour livraison | Ajouter colonnes |
| `Order.status` manque 'picked_up', 'on_the_way' pour livraison | Manquant | Étendre ENUM |
| Pas de modèle `Address` pour les adresses clients | Bloquant | Créer table addresses |
| Pas de modèle `Coupon` | Manquant | Créer table coupons |
| Pas de modèle `Review` | Manquant | Créer table reviews |
| Pas de modèle `Delivery` | Bloquant | Créer table deliveries |
| Pas de modèle `Cart`/`CartItem` | Manquant | Créer tables (ou gérer côté client) |
| Pas de modèle `Payment` | Manquant | Créer table payments |
| `DailyMenu.date_jour` + `organization_id` = UNIQUE correct ✅ | OK | — |

### 3.3 Performance 🟡

| Problème | Impact | Solution |
|----------|--------|----------|
| GET /api/orders : `limit` max 200, pas de cursor pagination | Moyen | Ajouter offset/cursor pagination |
| Listing marketplace : scan complet des orgs sans index | Élevé | Ajouter index sur organizations(type, active) + organizations(city) |
| Pas de cache sur le menu du jour (rechargé à chaque visite) | Moyen | Cache mémoire 60s ou Redis (phase ultérieure) |
| images servies depuis backend/uploads/ sans CDN | Faible | OK pour MVP, prévoir CDN à l'échelle |
| `sequelize.sync()` désactivé en prod ✅ | OK | — |
| N+1 potentiel dans listing orders avec includes | Moyen | Vérifier explain SQL, ajouter eager loading correct |

### 3.4 Architecture / Code Quality 🟡

| Problème | Impact | Solution |
|----------|--------|----------|
| `index.js` backend contient la logique de seed (~100 lignes) | Faible | OK pour MVP, à extraire si besoin |
| Pas de tests automatisés (phase 8 prévue mais non faite) | Élevé | Écrire au moins tests smoke sur les routes critiques |
| Frontend `pm2` dans `package.json` frontend (dépendance incorrecte) | Faible | Déplacer ou supprimer |
| `vite.config.js` minimaliste (pas de proxy configuré) | Faible | Ajouter proxy dev → backend |
| Frontend : pas de lazy loading des pages (routes) | Moyen | Ajouter `React.lazy()` + Suspense |
| Frontend : polling 30s dans OrdersPage — pas de WebSocket | Moyen | Socket.IO en phase D |
| Bootstrap 5 via CDN dans index.html | Faible | OK pour MVP |
| Hash passwords avec bcrypt 10 rounds ✅ | OK | — |
| Express-validator sur toutes les routes sensibles ✅ | OK | — |

### 3.5 UX / Mobile 🟡

| Problème | Impact | Solution |
|----------|--------|----------|
| Interface conçue pour desktop canteen | Élevé | Refondre en mobile-first pour marketplace |
| Pas de skeleton loaders — flash de contenu vide | Moyen | Ajouter dans les nouvelles pages |
| Pas de page marketplace publique (sans login) | Bloquant | Phase E |
| Panier = inexistant | Bloquant | Phase E |
| Pas d'images plats dans le menu public actuel | Moyen | Améliorer les cards plats |

---

## 4. Ce qui est bon et à préserver

- ✅ **Multi-tenant isolation** : orgScope() systématique, fonctionne bien
- ✅ **RBAC** : 6 rôles, middleware propre, extensible
- ✅ **Validation inputs** : express-validator sur toutes les routes modifiées
- ✅ **Error handling** : centralisé, pas de stack traces en prod
- ✅ **Rate limiting** : login/signup/global bien configurés
- ✅ **Migrations idempotentes** : pattern éprouvé (IF NOT EXISTS, INSERT IGNORE)
- ✅ **Seeders** : 3 orgs de démo bien structurées
- ✅ **Frontend refactorisé** : AuthContext, hooks, composants réutilisables
- ✅ **Orders/OrderItems** : modèle de base correct, juste à étendre
- ✅ **Public menu** : /api/pub/:slug/menu fonctionne pour marketplace
- ✅ **PM2** : process management en production

---

## 5. Modèles manquants — Spécification

### 5.1 Organization (extensions)
```sql
-- Colonnes à ajouter
address        VARCHAR(255)   NULL  -- "12 rue de la Paix"
city           VARCHAR(100)   NULL  -- "Casablanca"
zone           VARCHAR(100)   NULL  -- "Maarif", "Ain Diab"
phone          VARCHAR(32)    NULL
email          VARCHAR(191)   NULL
description    TEXT           NULL
logo_url       VARCHAR(500)   NULL
cover_url      VARCHAR(500)   NULL
opening_hours  JSON           NULL  -- {"mon":{"open":"11:00","close":"22:00"}, ...}
cuisine_type   VARCHAR(100)   NULL  -- "Marocain, Burger, Pizza"
accepts_delivery  TINYINT(1)  DEFAULT 1
accepts_takeaway  TINYINT(1)  DEFAULT 1
accepts_dine_in   TINYINT(1)  DEFAULT 1
delivery_fee      DECIMAL(6,2) DEFAULT 0
min_order_amount  DECIMAL(8,2) DEFAULT 0
avg_prep_time     INT          DEFAULT 20  -- minutes
avg_rating        DECIMAL(3,2) DEFAULT 0
total_reviews     INT UNSIGNED DEFAULT 0
latitude          DECIMAL(10,7) NULL
longitude         DECIMAL(10,7) NULL
is_featured       TINYINT(1)   DEFAULT 0
-- Étendre ENUM type :
type ENUM('canteen','restaurant','snack','dark_kitchen','bakery','cafe')
```

### 5.2 User (extensions)
```sql
phone       VARCHAR(32)  NULL
avatar_url  VARCHAR(500) NULL
-- Étendre ENUM role :
role ENUM('superadmin','owner','admin','manager','staff','user','customer','delivery')
```

### 5.3 Order (extensions)
```sql
delivery_address  TEXT         NULL   -- adresse texte libre (MVP)
delivery_fee      DECIMAL(6,2) DEFAULT 0
service_fee       DECIMAL(6,2) DEFAULT 0
discount_amount   DECIMAL(6,2) DEFAULT 0
coupon_code       VARCHAR(32)  NULL
payment_method    ENUM('cash','card','wallet','online') DEFAULT 'cash'
payment_status    ENUM('pending','paid','refunded','failed') DEFAULT 'pending'
estimated_ready_at DATETIME   NULL
-- Étendre status ENUM :
status ENUM('pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled')
```

### 5.4 MenuCategory (nouvelle table)
```sql
CREATE TABLE menu_categories (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     VARCHAR(255) NULL,
  image_url       VARCHAR(500) NULL,
  sort_order      INT DEFAULT 0,
  active          TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cat_org (organization_id, sort_order)
);
-- + colonne category_id dans menu_items
```

### 5.5 Address (nouvelle table)
```sql
CREATE TABLE addresses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  label       VARCHAR(100) NOT NULL,  -- "Maison", "Bureau"
  street      VARCHAR(255) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  zone        VARCHAR(100) NULL,
  notes       VARCHAR(255) NULL,      -- "2ème étage, sonnette droite"
  latitude    DECIMAL(10,7) NULL,
  longitude   DECIMAL(10,7) NULL,
  is_default  TINYINT(1) DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_addr_user (user_id)
);
```

### 5.6 Coupon (nouvelle table)
```sql
CREATE TABLE coupons (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NULL,  -- NULL = plateforme globale
  code            VARCHAR(32) NOT NULL UNIQUE,
  type            ENUM('percent','fixed') NOT NULL,
  value           DECIMAL(8,2) NOT NULL,
  min_order       DECIMAL(8,2) DEFAULT 0,
  max_uses        INT UNSIGNED NULL,  -- NULL = illimité
  used_count      INT UNSIGNED DEFAULT 0,
  valid_from      DATE NULL,
  valid_until     DATE NULL,
  active          TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_coupon_org (organization_id),
  KEY idx_coupon_code (code)
);
```

### 5.7 Review (nouvelle table)
```sql
CREATE TABLE reviews (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NULL,
  order_id        INT UNSIGNED NULL,
  rating          TINYINT NOT NULL,   -- 1-5
  comment         TEXT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_review_org (organization_id),
  KEY idx_review_user (user_id)
);
```

### 5.8 Delivery (nouvelle table)
```sql
CREATE TABLE deliveries (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id        INT UNSIGNED NOT NULL UNIQUE,
  partner_id      INT UNSIGNED NULL,  -- user avec role='delivery'
  status          ENUM('pending','assigned','picking_up','picked_up','on_the_way','delivered','failed') DEFAULT 'pending',
  pickup_at       DATETIME NULL,
  delivered_at    DATETIME NULL,
  partner_lat     DECIMAL(10,7) NULL,
  partner_lng     DECIMAL(10,7) NULL,
  distance_km     DECIMAL(6,2) NULL,
  fee             DECIMAL(6,2) DEFAULT 0,
  notes           TEXT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_delivery_partner (partner_id),
  KEY idx_delivery_status (status)
);
```

### 5.9 Cart / CartItem (tables légères)
```sql
-- Cart : lié à un user_id ou session_token (guest)
CREATE TABLE carts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NULL,
  session_token   VARCHAR(64) NULL,
  organization_id INT UNSIGNED NOT NULL,
  expires_at      DATETIME NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cart_user (user_id),
  KEY idx_cart_session (session_token)
);

CREATE TABLE cart_items (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id      INT UNSIGNED NOT NULL,
  menu_item_id INT UNSIGNED NOT NULL,
  quantity     INT UNSIGNED NOT NULL DEFAULT 1,
  notes        VARCHAR(255) NULL,
  unit_price   DECIMAL(8,2) NOT NULL,
  KEY idx_ci_cart (cart_id)
);
```

---

## 6. Gaps Frontend prioritaires

```
MarketplacePage       → listing restaurants, recherche, filtres
RestaurantPage        → détail resto + menu par catégorie + panier
CartSidebar           → composant panier flottant
CheckoutPage          → mode livraison/click&collect, adresse, résumé
OrderTrackingPage     → suivi commande par code (public, sans login)
CustomerOrdersPage    → historique commandes client (auth)
DeliveryPage          → interface livreur (auth, rôle delivery)
RestaurantLivePage    → dashboard orders live (amélioration OrdersPage)
```

---

## 7. Dépendances à installer

### Backend
```bash
# Socket.IO (real-time)
npm install socket.io

# Pas d'autre dépendance critique à ajouter pour MVP
```

### Frontend
```bash
# Socket.IO client
npm install socket.io-client

# Lucide React (icônes légères, pas de CDN)
npm install lucide-react

# React Hot Toast ou similaire déjà abstrait dans Toast.jsx ✅
```

---

## 8. Checklist sécurité avant mise en production marketplace

- [ ] Régénérer `JWT_SECRET` avec `openssl rand -hex 32`
- [ ] Valider MIME types des uploads (image uniquement)
- [ ] Quota upload par organisation (10 MB max)
- [ ] Rate limit spécifique sur POST /api/marketplace/orders (anti-spam)
- [ ] Isolation orders : client ne peut voir que ses propres commandes
- [ ] Isolation reviews : un seul avis par commande par user
- [ ] Coupon : vérifier used_count < max_uses dans une transaction
- [ ] Delivery : partenaire ne peut voir que les commandes de sa zone
- [ ] Input sanitization sur adresses (pas d'XSS dans les champs texte)

---

## 9. Hypothèses prises

1. Le panier client sera géré en `localStorage` côté frontend (MVP) — pas de table Cart DB. La table Cart DB sera créée mais optionnelle.
2. La livraison GPS temps réel est préparée (champs lat/lng dans Delivery) mais non activée en MVP — on met à jour statut manuellement.
3. Les paiements en ligne ne sont pas implémentés (architecture préparée uniquement).
4. Les MenuCategory remplacent le type ENUM progressivement — l'ancien ENUM reste en fallback pour ne pas casser la cantine.
5. Les rôles `customer` et `delivery` sont ajoutés à l'ENUM — les users existants ne sont pas impactés.
6. Le Socket.IO sera implémenté mais avec un fallback polling 30s pour les clients qui ne supportent pas WebSocket.
