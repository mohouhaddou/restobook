# Changelog RestoBook — Transformation SaaS

## [2.0.0] — 2026-06-08

### Résumé
Transformation de l'application mono-tenant en architecture SaaS multi-organisations.
Corrections de bugs critiques, extension RBAC, isolation des données.

---

### Phase 0 — Corrections de bugs critiques

#### Backend
- **CORS doublé** (`index.js`) : suppression du premier `app.use(cors({origin:'*'}))` redondant.
  La configuration est maintenant unique et supporte `CORS_ORIGIN` multi-valeur (liste séparée par virgules).
- **Routes `activate`/`reject` avec double préfixe** (`routes/admin.js`) : les routes
  `/api/admin/admin/users/:id/activate` et `/reject` avaient un préfixe dupliqué car montées
  sur un router déjà préfixé. Corrigées en `/api/admin/users/:id/activate|reject`.
- **Route `GET /menu/today` dupliquée** (`routes/menu.js`) : définie deux fois (lignes 119 et 277).
  La seconde définition identique a été supprimée.
- **Modèle dupliqué** `models/menu_item.js` (factory function jamais utilisée) supprimé.
  Le modèle officiel reste `models/menuItem.js`.
- **Fichiers React orphelins** (`backend/src/`, `backend/index.html`) supprimés — ne faisaient
  pas partie du build et créaient de la confusion.

#### Frontend
- **`SIGNUP_ENDPOINT = "auth/signup"`** : chemin relatif cassé corrigé en `API('/auth/signup')`.
- **Fetch sans `/api/` prefix** : cinq appels fetch dans `App.jsx` utilisaient des URLs relatives
  sans préfixe (`notifications/unread-count`, `notifications?status=unread`,
  `notifications/:id/read`, `admin/users/:id/activate`, `admin/users/:id/reject`).
  Tous corrigés avec `API(...)`.

---

### Phase 1 — Architecture multi-tenant

#### Nouveau modèle `Organization` (`models/organization.js`)
- Champs : `slug` (unique), `name`, `type` (canteen|restaurant), `plan` (trial|starter|pro|enterprise),
  `plan_expires_at`, `active`, `settings` (JSON).
- Appartient à tous les utilisateurs, menus, réservations, settings, notifications.

#### Restructuration `models/index.js`
- Avant : exportait uniquement l'instance Sequelize (les modèles importaient individuellement).
- Après : exporte l'instance + tous les modèles + toutes les associations centralisées.
- Nouveau fichier `models/db.js` : instance Sequelize isolée pour éviter les imports circulaires.

#### Migration SQL douce (`scripts/migrate.js`)
Idempotente (peut être rejouée sans risque). Effectue dans l'ordre :
1. Création de la table `organizations` si inexistante.
2. Insertion de l'organisation par défaut (id=1, slug='default').
3. Ajout de la colonne `organization_id` (NULL) dans : `users`, `menu_items`, `daily_menus`,
   `reservations`, `settings`, `notifications`.
4. Remplissage `organization_id = 1` pour toutes les données existantes.
5. Suppression de l'ancienne UNIQUE `date_jour` dans `daily_menus` → ajout UNIQUE
   `(organization_id, date_jour)`.
6. Ajout UNIQUE `(organization_id, key)` dans `settings` (remplacement du UNIQUE `key` global).
7. Extension de l'ENUM `role` dans `users` : ajout de `superadmin`, `owner`, `staff`.
8. Création du compte `superadmin` (matricule: superadmin / MDP: super123).

#### Ajout de `organization_id` dans les modèles
- `User`, `MenuItem`, `DailyMenu`, `Reservation`, `Setting`, `Notification` : champ `organization_id`
  ajouté (INTEGER UNSIGNED, nullable).
- `DailyMenu` : contrainte `unique: true` sur `date_jour` supprimée (remplacée par migration).
- `Setting` : contrainte `unique: true` sur `key` supprimée (remplacée par migration).
- `User` : ENUM `role` étendu à `['superadmin','owner','admin','manager','staff','user']`.

#### `index.js` (serveur)
- Suppression des associations dupliquées (désormais dans `models/index.js`).
- Refactorisation de la fonction `seed()` : `organization_id` passé à chaque `findOrCreate`.
- Gestion des seeds par org (scope correct dès le premier démarrage).

---

### Phase 2 — RBAC étendu

#### Nouveaux rôles

| Rôle | Scope | Description |
|------|-------|-------------|
| `superadmin` | Global | Gère toutes les organisations, plans, comptes globaux |
| `owner` | Organisation | Propriétaire, tous droits dans son org |
| `admin` | Organisation | Administration locale (users, settings, menus) |
| `manager` | Organisation | Gestion menus, réservations, export, QR |
| `staff` | Organisation | Validation QR uniquement |
| `user` | Organisation | Réservation/commande uniquement |

#### Middleware `auth.js` — nouveaux middlewares

- **`requireSuperAdmin`** : refuse tout sauf le rôle `superadmin`.
- **`requireOrganizationAccess`** : vérifie que l'org de l'user est active. Les superadmins passent
  toujours (scope global). Attache `req.org` pour les routes suivantes.
- **`orgScope(req)`** : helper qui retourne `{ organization_id: req.user.organization_id }` pour
  composer les clauses `WHERE` de façon cohérente et sécurisée dans toutes les routes.

#### Token JWT
- `organization_id` ajouté au payload du token lors du login.
- Route `/me` rechargée depuis la DB (pas depuis le token) pour avoir les champs à jour.

#### Routes mises à jour pour scope org

| Fichier | Changement |
|---------|-----------|
| `routes/auth.js` | JWT inclut `organization_id`. `/me` recharge depuis DB. |
| `routes/admin.js` | Toutes les queries filtrées par `orgScope(req)`. Nouveaux rôles autorisés (`owner`, `superadmin`). |
| `routes/menu.js` | Items, daily menus et réservations filtrés par `organization_id`. |
| `routes/reservations.js` | Toutes les queries incluent `organization_id`. Settings lus par org. `staff` autorisé sur redeem. |
| `routes/notifications.js` | Filtrées par `recipient_id` + `organization_id`. |
| `routes/public.js` | Settings chargés par `org_id` (param, défaut=1). |

#### Nouvelles routes SuperAdmin (`routes/superadmin.js`)

Montées sur `/api/superadmin`, protégées par `requireSuperAdmin`.

- `GET /organizations` — liste toutes les organisations avec compteurs
- `POST /organizations` — créer une org + settings par défaut + compte owner optionnel
- `PATCH /organizations/:id` — modifier nom, type, plan, suspension
- `DELETE /organizations/:id` — supprimer org et toutes ses données (avec `?force=true`)
- `POST /organizations/:id/suspend` — suspendre une org
- `POST /organizations/:id/restore` — réactiver une org
- `GET /users` — tous les users de toutes les orgs (filtrable par `org_id`, `role`)
- `GET /stats` — statistiques globales (orgs, users, réservations)

---

### Corrections de sécurité

- **`JWT_SECRET`** manquant dans `.env` en production → généré et ajouté (96 octets hex aléatoires).
- **CORS** : le wildcard `*` reste actif si `CORS_ORIGIN` n'est pas défini. En production,
  définir `CORS_ORIGIN=https://votre-domaine.com` dans `.env`.

---

### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `backend/models/db.js` | Instance Sequelize isolée |
| `backend/models/organization.js` | Modèle Organization |
| `backend/routes/superadmin.js` | Routes SuperAdmin |
| `backend/scripts/migrate.js` | Migration douce multi-tenant |
| `AUDIT_RESTOBOOK.md` | Rapport d'audit complet |
| `PLAN_SAAS_RESTOBOOK.md` | Plan d'implémentation SaaS |

### Fichiers supprimés

| Fichier | Raison |
|---------|--------|
| `backend/models/menu_item.js` | Doublon de `menuItem.js`, jamais utilisé |
| `backend/src/App.jsx` | Fichier React orphelin dans le dossier backend |
| `backend/src/api.js` | Idem |
| `backend/src/main.jsx` | Idem |
| `backend/index.html` | HTML orphelin dans le dossier backend |

---

## Prochaines étapes (non implémentées)

Voir `PLAN_SAAS_RESTOBOOK.md` :
- **Phase 3** : Stats avancées Canteen (gaspillage, no-show, dashboard)
- **Phase 4** : Modules Restaurant (commandes, tables, fidélité, page publique)
- **Phase 5** : Refactorisation frontend (React Router, composants séparés, hooks)
- **Phase 6** : Validation d'input (`express-validator`), rate limiting, logs structurés
- **Phase 7** : Seeders de démonstration (3 organisations)
- **Phase 8** : Tests automatisés (Jest + supertest)

---

## Instructions de démarrage

```bash
# 1. Migration (une seule fois, idempotente)
cd /var/www/restobook/backend
node scripts/migrate.js

# 2. Démarrage développement
node index.js

# 3. Démarrage production (PM2 existant)
pm2 reload index --update-env

# 4. Variables d'environnement requises (.env)
PORT=3000
DB_HOST=127.0.0.1
DB_NAME=restobook
DB_USER=restouser
DB_PASS=...
JWT_SECRET=...        # généré par migrate.js si absent
CORS_ORIGIN=https://votre-domaine.com   # optionnel, * si absent
ALLOW_SELF_SIGNUP=true|false
CUTOFF_TIME=10:30
ALLOW_CANCEL_UNTIL=10:00
```

## Comptes de démonstration

| Matricule | Mot de passe | Rôle | Organisation |
|-----------|-------------|------|-------------|
| superadmin | super123 | SuperAdmin | Global |
| admin | (inchangé en prod) | Admin | Org par défaut |
| manager | (inchangé en prod) | Manager | Org par défaut |
| E12345 | test123 | User | Org par défaut |
