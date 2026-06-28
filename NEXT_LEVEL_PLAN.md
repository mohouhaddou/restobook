# RestoBook → Next Level Marketplace
## Plan d'implémentation progressif

**Date :** 2026-06-09  
**Principe :** Chaque phase doit laisser le backend et le frontend fonctionnels.  
**Priorité MVP :** Marketplace → Menu public → Panier → Commande → Dashboard restaurant → Temps réel

---

## Vue d'ensemble des phases

```
Phase A : Extensions modèles + migration SQL         (Fondations)
Phase B : APIs Marketplace (backend)                 (Backend public)
Phase C : APIs Dashboard Restaurant enrichi          (Backend restaurant)
Phase D : Socket.IO real-time                        (Temps réel)
Phase E : Frontend Marketplace                       (UX client)
Phase F : Frontend Dashboard Restaurant              (UX restaurant)
Phase G : Module Livreur                             (Delivery)
Phase H : Seeders enrichis + documentation finale    (Demo + docs)
```

---

## Phase A — Extensions modèles & migration SQL

**Durée estimée :** 1 jour  
**Risque :** Faible (migrations idempotentes, pas de breaking changes)  
**Tests requis :** Backend démarre, routes existantes répondent 200

### A.1 — Script migrate_v3.js

Fichier : `backend/scripts/migrate_v3.js`

**Tables créées :**
- `menu_categories` — catégories par organisation
- `addresses` — adresses de livraison client
- `coupons` — codes promo
- `reviews` — avis clients
- `deliveries` — suivi livraisons
- `carts` + `cart_items` — paniers

**Tables modifiées (ALTER TABLE idempotent) :**
- `organizations` : +address, +city, +zone, +phone, +email, +description, +logo_url, +cover_url, +opening_hours (JSON), +cuisine_type, +accepts_delivery, +accepts_takeaway, +accepts_dine_in, +delivery_fee, +min_order_amount, +avg_prep_time, +avg_rating, +total_reviews, +latitude, +longitude, +is_featured. Extend ENUM type.
- `users` : +phone, +avatar_url. Extend ENUM role (customer, delivery).
- `orders` : +delivery_address, +delivery_fee, +service_fee, +discount_amount, +coupon_code, +payment_method, +payment_status, +estimated_ready_at. Extend ENUM status.
- `menu_items` : +category_id, +sort_order, +is_available.

### A.2 — Nouveaux modèles Sequelize

- `backend/models/menuCategory.js`
- `backend/models/address.js`
- `backend/models/coupon.js`
- `backend/models/review.js`
- `backend/models/delivery.js`
- `backend/models/cart.js`
- `backend/models/cartItem.js`

### A.3 — Update models/index.js

Ajouter tous les nouveaux modèles + associations :
- Organization → MenuCategory (hasMany)
- Organization → Review (hasMany)
- Organization → Coupon (hasMany)
- User → Address (hasMany)
- User → Review (hasMany)
- Order → Delivery (hasOne)
- Delivery → User as 'partner' (belongsTo)
- MenuCategory → MenuItem (hasMany via category_id)
- Cart → CartItem (hasMany)
- CartItem → MenuItem (belongsTo)

### A.4 — Mettre à jour Organization model

Ajouter tous les nouveaux champs dans `organization.js`.

### A.5 — Mettre à jour User model

Étendre ENUM role + ajouter phone, avatar_url.

### A.6 — Mettre à jour Order model

Ajouter champs delivery, payment, étendre status ENUM.

### Commande d'exécution Phase A
```bash
node backend/scripts/migrate_v3.js
pm2 reload index --update-env
# Vérifier : curl http://localhost:3000/api/health
```

---

## Phase B — APIs Marketplace (backend)

**Durée estimée :** 1 jour  
**Fichiers créés :**
- `backend/routes/marketplace.js`

**Endpoints :**

### B.1 — Listing restaurants
```
GET /api/marketplace/restaurants
Query params :
  - q          : recherche par nom
  - city       : filtre ville
  - zone       : filtre quartier
  - type       : canteen|restaurant|snack|cafe|bakery
  - open_now   : true|false (calcul côté backend avec opening_hours JSON)
  - delivery   : true (accepts_delivery=1)
  - min_rating : 0-5
  - page, limit (pagination, default 20)
  
Response :
  { total, page, pages, restaurants: [{ id, slug, name, type, city, zone,
    cuisine_type, logo_url, cover_url, avg_rating, total_reviews,
    delivery_fee, min_order_amount, avg_prep_time,
    accepts_delivery, accepts_takeaway, accepts_dine_in,
    is_open, is_featured }] }
```

### B.2 — Détail restaurant
```
GET /api/marketplace/restaurants/:slug
Response :
  { restaurant: { ...listing + description, phone, email, opening_hours,
    latitude, longitude } }
```

### B.3 — Menu complet par catégories
```
GET /api/marketplace/restaurants/:slug/menu
Response :
  { restaurant: { name, slug, logo_url }, categories: [
    { id, name, sort_order, items: [
      { id, libelle, description, prix, image_url, allergenes, calories,
        is_available, type }
    ]}
  ]}
```

### B.4 — Commande publique (sans login obligatoire)
```
POST /api/marketplace/orders
Body :
  { organization_slug, items: [{menu_item_id, quantity, notes?}],
    type: 'delivery'|'click_collect'|'dine_in',
    delivery_address?: string,
    coupon_code?: string,
    guest_name, guest_phone,
    notes? }
Response :
  { ok, order_id, pickup_code, total_amount, delivery_fee,
    discount_amount, estimated_ready_at }
  
Auth : optionnel (Bearer token si user connecté → user_id lié)
Rate limit : 5 commandes/5min par IP
```

### B.5 — Suivi commande public
```
GET /api/marketplace/track/:pickup_code
Response :
  { order: { id, status, pickup_code, type, total_amount,
    items: [...], created_at, estimated_ready_at,
    organization: { name, phone } } }
    
Auth : aucune (code seul suffit)
```

### B.6 — Valider coupon
```
POST /api/marketplace/coupons/validate
Body : { code, organization_slug, subtotal }
Response : { valid, type, value, discount_amount, message? }
```

### B.7 — Ajouter un avis
```
POST /api/marketplace/reviews
Body : { organization_slug, order_pickup_code, rating: 1-5, comment? }
Auth : optionnel (anonyme accepté)
Rate limit : 1 avis par pickup_code
```

### Intégration dans routes/index.js
```js
router.use('/marketplace', require('./marketplace'));
```

---

## Phase C — Dashboard restaurant enrichi (backend)

**Durée estimée :** 0.5 jour  
**Fichiers créés :** `backend/routes/restaurantDashboard.js`

### C.1 — Commandes live
```
GET /api/restaurant/orders/live
Auth : requireAuth + staff|manager|admin|owner|superadmin
Response :
  { pending: [...], confirmed: [...], preparing: [...], ready: [...] }
  Chaque order inclut items + temps écoulé depuis création
```

### C.2 — Catégories menu (CRUD)
```
GET    /api/restaurant/categories
POST   /api/restaurant/categories
PATCH  /api/restaurant/categories/:id
DELETE /api/restaurant/categories/:id
```

### C.3 — Stats aujourd'hui
```
GET /api/restaurant/stats/today
Response :
  { orders_count, revenue, avg_ticket, top_items: [...],
    by_type: { delivery, click_collect, dine_in } }
```

### C.4 — Paramètres restaurant public
```
PATCH /api/restaurant/profile
Body : { description, phone, address, city, zone, opening_hours,
         delivery_fee, min_order_amount, avg_prep_time,
         accepts_delivery, accepts_takeaway, accepts_dine_in,
         cuisine_type }
Auth : requireAuth + admin|owner
```

---

## Phase D — Socket.IO temps réel

**Durée estimée :** 0.5 jour  
**Package :** socket.io (backend) + socket.io-client (frontend)

### Architecture
```
HTTP Server (Express) → io (Socket.IO)
Namespace : /restaurant → room per organization_id
Namespace : /customer   → room per pickup_code

Events émis par le backend :
  - 'order:new'         → restaurant (nouvelle commande)
  - 'order:status'      → customer + restaurant (changement statut)
  - 'delivery:location' → customer (position livreur)

Events reçus du backend (from clients) :
  - 'restaurant:join'   → rejoindre room org
  - 'track:join'        → rejoindre room pickup_code
```

### Intégration
```js
// index.js — remplacer app.listen par httpServer
const http = require('http');
const { Server } = require('socket.io');
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: ALLOWED } });
global.io = io; // accessible dans les routes
httpServer.listen(PORT);
```

### Hooks dans les routes
```js
// Dans orders.js après création order :
if (global.io) global.io.to(`org:${orgId}`).emit('order:new', orderSummary);

// Dans PATCH /:id/status :
if (global.io) {
  global.io.to(`org:${orgId}`).emit('order:status', { id, status });
  global.io.to(`track:${pickup_code}`).emit('order:status', { id, status });
}
```

### Fallback polling
Les pages qui utilisent Socket.IO auront un fallback automatique
via `setInterval(30000)` si la connexion WebSocket échoue.

---

## Phase E — Frontend Marketplace

**Durée estimée :** 2 jours  
**Principe :** Mobile-first, CSS inline + variables CSS existantes

### E.1 — MarketplacePage (`/marketplace`)
- Hero section avec barre de recherche
- Filtres : ville, type, ouvert maintenant, livraison
- Grid de cards restaurants :
  - Logo/cover, nom, type, cuisine, ville
  - Badges : ⭐ note, 🕐 temps, 💰 frais livraison
  - Badges : "Ouvert", "Promo", "Populaire"
- Pagination ou infinite scroll
- État vide et skeleton loaders

### E.2 — RestaurantPage (`/r/:slug`)
- Header : cover image, logo, infos, horaires, badges
- Navigation sticky par catégorie
- Liste items avec images, prix, description
- Bouton "Ajouter au panier" par item
- CartSidebar : panier flottant (sticky à droite sur desktop, bottom sheet mobile)

### E.3 — CheckoutPage (`/checkout`)
- Résumé panier
- Choix du mode : Livraison / Click & Collect / Sur place
- Si livraison : champ adresse texte
- Coupon code (avec validation live)
- Récapitulatif : sous-total, frais livraison, réduction, total
- Champs client : nom, téléphone
- Bouton "Commander" → POST /api/marketplace/orders
- Redirect vers OrderTrackingPage avec le pickup_code

### E.4 — OrderTrackingPage (`/track/:code`)
- Public (sans login)
- Statut visuel avec timeline
- Infos restaurant et commande
- Temps estimé (si renseigné)
- Auto-refresh toutes les 15s (Socket.IO ou polling)

### E.5 — Intégration dans App.jsx
```jsx
<Route path="/marketplace" element={<MarketplacePage />} />
<Route path="/r/:slug" element={<RestaurantPage />} />
<Route path="/checkout" element={<CheckoutPage />} />
<Route path="/track/:code" element={<OrderTrackingPage />} />
```

### E.6 — CartContext
```jsx
// src/contexts/CartContext.jsx
// State : { organizationSlug, items: [{menuItemId, quantity, unitPrice, name}] }
// Actions : addItem, removeItem, updateQuantity, clearCart, total
// Persistence : localStorage
```

---

## Phase F — Frontend Dashboard Restaurant enrichi

**Durée estimée :** 1 jour

### F.1 — OrdersPage améliorée
- Colonnes Kanban : Nouvelles | En prép | Prêtes
- Carte par commande : client, items, type, temps écoulé, total
- Action 1-clic : Accepter → En prépa → Prête → Livrée
- Son de notification sur nouvelle commande (optionnel)
- Socket.IO intégré (ou polling 15s si WS indispo)

### F.2 — RestaurantProfilePage (extension SettingsPage)
- Onglet "Profil restaurant" : adresse, horaires, photo
- Onglet "Livraison" : frais, min commande, zones
- Onglet "Apparence" : logo, cover, couleurs

### F.3 — MenuPage améliorée (ItemsPage)
- Gestion des catégories (add/edit/delete/reorder)
- Items groupés par catégorie
- Toggle disponibilité en 1 clic
- Prix et images directement visibles

---

## Phase G — Module Livreur

**Durée estimée :** 0.5 jour

### G.1 — DeliveryPage (`/delivery`)
- Auth : rôle delivery obligatoire
- Liste des commandes disponibles (status=ready, type=delivery)
- Bouton "Accepter" → PATCH delivery + join room Socket.IO
- Ma livraison en cours :
  - Adresse client
  - Statut : En route resto → Récupérée → En route client
  - Bouton "Livrée" avec confirmation
- Historique des livraisons du jour
- Gains estimés

### G.2 — Backend route delivery
- GET /api/delivery/available — commandes ready à récupérer
- POST /api/delivery/accept/:orderId — assigner au livreur
- PATCH /api/delivery/:orderId/status — update statut

---

## Phase H — Seeders enrichis + Documentation

**Durée estimée :** 0.5 jour

### H.1 — seed_marketplace.js
- 3 restaurants/snacks avec vrais horaires + coordonnées
- 1 cantine (déjà existante)
- 10 plats avec vraies descriptions et prix
- 5 clients (role=customer)
- 3 livreurs (role=delivery)
- 5 commandes exemple avec statuts variés
- 3 coupons exemple (BIENVENUE10, WEEKEND20, LIVGRATUIT)
- 10 avis (ratings 3-5 étoiles)

### H.2 — Documentation
- RUNBOOK.md (commandes opérationnelles)
- API Reference inline dans le code
- ROLES_PERMISSIONS.md

---

## Contraintes et règles

1. **Chaque phase** doit se terminer par un `pm2 reload index` réussi
2. **Pas de `sequelize.sync()`** en production — uniquement scripts migrate_v*.js
3. **orgScope()** obligatoire sur chaque nouvelle route qui accède aux données
4. **Rate limiting** sur toutes les routes publiques sensibles
5. **Input validation** (express-validator) sur chaque POST/PATCH
6. **Isolation cross-tenant** : un restaurant ne voit jamais les commandes d'un autre
7. **Fallback polling** si Socket.IO indisponible
8. **Mobile-first** sur toutes les nouvelles pages frontend

---

## Ordre de priorité MVP (livrable minimum)

```
1. ✅ Phase A  Migration + modèles         → FONDATION
2. ✅ Phase B  Marketplace APIs            → BACKEND PUBLIC  
3. ✅ Phase E  MarketplacePage + Cart      → UX CLIENT (1ère commande possible)
4. ✅ Phase F  OrdersPage améliorée        → UX RESTAURANT (live orders)
5. ◑  Phase C  Dashboard restaurant APIs  → UX RESTAURANT (avancé)
6. ◑  Phase D  Socket.IO                  → TEMPS RÉEL
7. ○  Phase G  Module livreur             → DELIVERY
8. ○  Phase H  Seeders + docs             → POLISH
```

---

## Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| ALTER TABLE ORDER bloque en prod (large table) | Faible (table vide) | Élevé | Faire migration maintenance window |
| Socket.IO conflit avec PM2 cluster mode | Moyen | Élevé | Passer en fork mode pour Socket.IO (1 seul process) |
| ENUM extension MySQL : ALTER TABLE lent | Faible (petites tables) | Moyen | OK avec tables petites en dev/prod actuel |
| CSS conflicts entre marketplace et dashboard | Moyen | Faible | Utiliser préfixes CSS par page |
| Carte panier = perte si refresh page | Faible | Faible | localStorage ✅ |
