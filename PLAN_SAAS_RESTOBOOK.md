# Plan d'implémentation SaaS — RestoBook
## Date : 2026-06-08

---

## Phase 0 — Corrections immédiates (sans casser l'existant)

**Durée estimée : 2-3 heures**

### 0.1 Corriger les bugs critiques backend
- [ ] Supprimer le doublon CORS dans `index.js`
- [ ] Corriger les routes `/admin/users/:id/activate` et `reject` (doublon de préfixe)
- [ ] Supprimer le doublon `GET /menu/today` dans `routes/menu.js`
- [ ] Supprimer `models/menu_item.js` (factory non utilisée) ou l'intégrer proprement
- [ ] Supprimer les fichiers React orphelins dans `backend/src/`

### 0.2 Corriger les bugs frontend
- [ ] Corriger `SIGNUP_ENDPOINT` → `API('/auth/signup')`
- [ ] Corriger les fetch sans `/api/` prefix (notifications, activate/reject)
- [ ] Remplacer `window.alert()` / `window.confirm()` par des composants modaux Bootstrap

### 0.3 Sécurité minimale
- [ ] Ajouter `express-rate-limit` sur `/api/auth/login`
- [ ] Restreindre CORS à l'origine frontend en production
- [ ] Ajouter validation d'input avec `express-validator` sur les routes critiques

---

## Phase 1 — Architecture multi-tenant

**Durée estimée : 1-2 jours**

### 1.1 Modèle Organization

```sql
CREATE TABLE organizations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(191) NOT NULL,
  type ENUM('canteen','restaurant') NOT NULL DEFAULT 'canteen',
  plan ENUM('trial','starter','pro','enterprise') DEFAULT 'trial',
  plan_expires_at DATETIME NULL,
  active BOOLEAN DEFAULT TRUE,
  settings JSON NULL,       -- config spécifique à l'org
  created_at DATETIME,
  updated_at DATETIME
);
```

### 1.2 Ajouter `organization_id` aux tables

Tables à migrer :
- `users` → `organization_id` (nullable pour superadmin)
- `menu_items` → `organization_id`
- `daily_menus` → `organization_id` + retirer UNIQUE sur `date_jour` seul → UNIQUE sur `(date_jour, organization_id)`
- `reservations` → `organization_id`
- `settings` → `organization_id` + UNIQUE sur `(key, organization_id)`
- `notifications` → `organization_id`

### 1.3 Script de migration SQL
```sql
-- Créer la table organizations
-- Créer une org par défaut pour les données existantes
-- Ajouter les colonnes organization_id
-- Mettre à jour les contraintes UNIQUE
```

### 1.4 Middleware `requireOrganizationAccess`
```js
// Charge l'org depuis user.organization_id
// Vérifie que l'org est active et le plan valide
// Attache req.org pour les routes suivantes
```

### 1.5 Filtrage automatique par org dans toutes les routes
- Toutes les `findAll`, `findOne`, `create` doivent inclure `organization_id: req.user.organization_id`
- Utiliser un helper `scopedWhere(req, extra)` pour éviter les oublis

---

## Phase 2 — RBAC étendu

**Durée estimée : 4-6 heures**

### 2.1 Nouveaux rôles

| Rôle | Scope | Permissions |
|------|-------|-------------|
| `superadmin` | Global | Toutes les organisations, création/suspension orgs, gestion plans |
| `owner` | Organisation | Tout dans son org + gestion abonnement |
| `admin` | Organisation | CRUD users, settings, menus, réservations |
| `manager` | Organisation | Menus, réservations, export, validation QR |
| `staff` | Organisation | Validation QR uniquement |
| `user` | Organisation | Réservation/commande uniquement |

### 2.2 Migration ENUM users.role
```sql
ALTER TABLE users MODIFY COLUMN role 
  ENUM('superadmin','owner','admin','manager','staff','user') 
  NOT NULL DEFAULT 'user';
```

### 2.3 Nouveaux middlewares
```js
// middleware/auth.js
requireAuth           // JWT valide
requireRole(...roles) // Rôle dans la liste
requireOrg            // User a un organization_id (pas superadmin seul)
requireOrgAccess      // Org active + plan valide
requireSuperAdmin     // Superadmin uniquement
```

---

## Phase 3 — Modules Canteen (amélioration)

**Durée estimée : 1-2 jours**

### 3.1 Statistiques avancées
- Route `GET /api/stats/daily?date=` → repas réservés, servis, annulés, no-show
- Route `GET /api/stats/weekly?from=&to=` → résumé hebdo par catégorie
- Route `GET /api/stats/gaspillage?from=&to=` → estimation gaspillage (confirmé - servi)

### 3.2 Gestion des absences/no-show
- Champ `no_show: BOOLEAN` dans reservations
- Cron ou endpoint pour marquer no-show après l'heure de service

### 3.3 Planning hebdomadaire simplifié
- Backend: `GET /api/menu/week?from=YYYY-MM-DD` → menu des 5 jours
- Frontend: vue semaine pour planification rapide

### 3.4 Dashboard cantine
- Composant React `CanteenDashboard`
- Cartes: total réservations jour, servis, annulés, quotas restants
- Graphique: courbe hebdo des réservations

---

## Phase 4 — Modules Restaurant (nouveaux)

**Durée estimée : 2-3 jours**

### 4.1 Modèles supplémentaires

```sql
-- Table des catégories de plats restaurant
CREATE TABLE menu_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name VARCHAR(191) NOT NULL,
  position INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

-- Extension menu_items pour restaurant
ALTER TABLE menu_items ADD COLUMN price DECIMAL(8,2) NULL;
ALTER TABLE menu_items ADD COLUMN category_id INT UNSIGNED NULL;
ALTER TABLE menu_items ADD COLUMN available BOOLEAN DEFAULT TRUE;

-- Tables restaurant
CREATE TABLE tables (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name VARCHAR(64) NOT NULL,
  capacity INT DEFAULT 4,
  active BOOLEAN DEFAULT TRUE
);

-- Réservations de table
CREATE TABLE table_reservations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  table_id INT UNSIGNED NULL,
  guest_name VARCHAR(191) NOT NULL,
  guest_phone VARCHAR(32) NULL,
  guest_email VARCHAR(191) NULL,
  date_jour DATE NOT NULL,
  time_slot VARCHAR(8) NOT NULL, -- ex: "19:30"
  guests_count INT DEFAULT 2,
  status ENUM('pending','confirmed','seated','cancelled','no_show') DEFAULT 'pending',
  notes TEXT NULL,
  created_at DATETIME,
  updated_at DATETIME
);

-- Commandes restaurant
CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  table_id INT UNSIGNED NULL,
  type ENUM('dine_in','takeaway','click_collect') DEFAULT 'dine_in',
  status ENUM('pending','confirmed','preparing','ready','delivered','cancelled') DEFAULT 'pending',
  total_amount DECIMAL(8,2) DEFAULT 0,
  notes TEXT NULL,
  pickup_code VARCHAR(16) NULL,
  created_at DATETIME,
  updated_at DATETIME
);

-- Lignes de commande
CREATE TABLE order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  menu_item_id INT UNSIGNED NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(8,2) NOT NULL,
  notes TEXT NULL
);

-- Fidélité
CREATE TABLE loyalty_points (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  points INT DEFAULT 0,
  total_earned INT DEFAULT 0,
  total_redeemed INT DEFAULT 0,
  updated_at DATETIME
);
```

### 4.2 Page publique restaurant (sans auth)
- `GET /pub/:org_slug/menu` → menu public du restaurant
- `GET /pub/:org_slug/info` → nom, description, horaires, contact
- QR code de table → redirige vers `/pub/:org_slug/order?table=X`

### 4.3 Dashboard restaurant
- Composant React `RestaurantDashboard`
- Cartes: commandes en cours, chiffre du jour, tables occupées
- File de commandes (statut en temps réel)

---

## Phase 5 — Refactorisation frontend

**Durée estimée : 2-3 jours**

### 5.1 Structure de composants
```
frontend/src/
├── api.js              # Helpers URL + fetch typés
├── main.jsx
├── App.jsx             # Router + contexte auth uniquement
├── contexts/
│   ├── AuthContext.jsx
│   └── OrgContext.jsx
├── hooks/
│   ├── useApi.js       # fetch avec auth auto
│   ├── useMenu.js
│   ├── useReservations.js
│   └── useNotifications.js
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx
│   │   ├── Navbar.jsx
│   │   └── PageLayout.jsx
│   ├── ui/
│   │   ├── Modal.jsx
│   │   ├── Toast.jsx
│   │   ├── Badge.jsx
│   │   ├── Table.jsx
│   │   ├── Pagination.jsx
│   │   └── EmptyState.jsx
│   ├── menu/
│   │   ├── MenuCard.jsx
│   │   ├── MenuGrid.jsx
│   │   └── DayPlanner.jsx
│   ├── reservation/
│   │   ├── OrderCard.jsx
│   │   ├── QRModal.jsx
│   │   └── CartPanel.jsx
│   └── admin/
│       ├── UserTable.jsx
│       └── SettingsForm.jsx
└── pages/
    ├── LoginPage.jsx
    ├── DashboardPage.jsx
    ├── MenuPage.jsx
    ├── ReservationsPage.jsx
    ├── PreparationPage.jsx
    ├── QrValidationPage.jsx
    ├── AdminUsersPage.jsx
    ├── AdminItemsPage.jsx
    ├── SettingsPage.jsx
    └── StatsPage.jsx
```

### 5.2 Ajouter React Router
```bash
npm install react-router-dom
```
Routes : `/`, `/login`, `/menu`, `/reservations`, `/prep`, `/admin/users`, `/admin/items`, `/settings`, `/stats`

### 5.3 Design system
- Variables CSS déjà en place → à compléter
- Composants Bootstrap utilisés de façon cohérente
- Pas de dépendance externe supplémentaire (garder Bootstrap CDN ou passer à npm)

---

## Phase 6 — Robustesse backend

**Durée estimée : 1 jour**

### 6.1 Validation d'input
```bash
npm install express-validator
```
- Middleware de validation sur toutes les routes POST/PATCH
- Sanitisation des strings (trim, escape)
- Validation des types (date, entier, enum)

### 6.2 Rate limiting
```bash
npm install express-rate-limit
```
- Login: 10 tentatives / 15 min / IP
- Signup: 3 créations / heure / IP

### 6.3 Gestion d'erreurs centralisée
```js
// middleware/errorHandler.js
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) return res.status(400).json({...});
  if (err instanceof AuthorizationError) return res.status(403).json({...});
  console.error(err);
  res.status(500).json({ error: 'Erreur interne' });
});
```

### 6.4 Logs structurés
```bash
npm install winston
```
- Logs JSON en production
- Niveaux: error, warn, info, debug
- Rotation de fichiers

### 6.5 Migrations Sequelize
```bash
npm install --save-dev sequelize-cli
```
- Créer les migrations pour chaque changement de schéma
- Remplacer `sequelize.sync()` par `sequelize.authenticate()` + migrations CLI en prod

---

## Phase 7 — Seeders de démonstration

**Durée estimée : 2-3 heures**

### Organisations de démo
1. **Cantine Entreprise** (`slug: corp-canteen`) — 50 employés, menus semaine
2. **École Primaire** (`slug: ecole-martin`) — élèves + enseignants, menus enfants
3. **Snack Le Rapide** (`slug: snack-rapide`) — restaurant mode click & collect

### Comptes de démo par org
- `superadmin` / `super123` — accès global
- `owner@corp` / `owner123` — propriétaire cantine
- `admin@corp` / `admin123` — admin cantine
- `manager@corp` / `manager123` — gestionnaire
- `staff@corp` / `staff123` — personnel de validation
- `employe@corp` / `employe123` — employé lambda

---

## Phase 8 — Tests

**Durée estimée : 1-2 jours**

### Tests backend (Jest + supertest)
```bash
npm install --save-dev jest supertest
```
- Auth: login valide, matricule inconnu, compte inactif
- Isolation org: user org A ne peut pas voir données org B
- Réservation: flux complet, dépassement quota, heure limite
- Validation QR: redeem, doublon, ordre inconnu
- Admin: CRUD users, settings

### Tests frontend (Vitest + React Testing Library)
- Formulaire login
- Affichage menu du jour
- Sélection panier
- Composant QR modal

---

## Ordre d'implémentation recommandé

1. **Phase 0** — Corrections immédiates (aucun risque de régression)
2. **Phase 1** — Modèle Organization + migration SQL douce (nullable d'abord)
3. **Phase 2** — RBAC étendu + nouveaux middlewares
4. **Phase 6** — Robustesse backend (validation, rate limit, logs)
5. **Phase 3** — Modules Canteen avancés
6. **Phase 5** — Refactorisation frontend (composants)
7. **Phase 4** — Modules Restaurant (nouveaux)
8. **Phase 7** — Seeders de démo
9. **Phase 8** — Tests

---

## Contraintes respectées

- Chaque phase se termine par un test de démarrage (`npm start`)
- Les migrations SQL sont additives (pas de DROP sauf si justifié)
- Les comptes existants sont préservés via migration douce
- Le style Bootstrap existant est conservé et amélioré
- Les décisions techniques sont documentées dans `CHANGELOG_RESTOBOOK.md`
