# Audit Technique RestoBook — 2026-06-08

## 1. Structure du projet

```
restobook/
├── backend/
│   ├── index.js              # Point d'entrée Express + seeds + associations
│   ├── middleware/auth.js    # requireAuth, requireRole
│   ├── models/
│   │   ├── index.js          # Exporte uniquement l'instance Sequelize (pas les modèles)
│   │   ├── user.js
│   │   ├── menuItem.js       # ⚠️ DOUBLON: même nom de modèle que menu_item.js
│   │   ├── menu_item.js      # ⚠️ DOUBLON: factory function non utilisée par l'app
│   │   ├── dailyMenu.js
│   │   ├── dailyMenuItem.js
│   │   ├── reservation.js
│   │   ├── setting.js
│   │   └── notification.js
│   └── routes/
│       ├── index.js          # Router principal
│       ├── auth.js           # Login, signup, change-password, me
│       ├── menu.js           # Items CRUD, menu du jour
│       ├── reservations.js   # Réservation, validation QR, export CSV
│       ├── admin.js          # CRUD utilisateurs, settings, branding
│       ├── notifications.js  # Lecture/marquage notifications
│       └── public.js         # GET /api/settings sans auth
└── frontend/
    ├── index.html            # Bootstrap CDN + html5-qrcode CDN
    ├── src/
    │   ├── main.jsx          # Montage React minimal
    │   ├── App.jsx           # ⚠️ 3237 lignes — monolithe complet
    │   └── api.js            # Helpers URL (API, ASSET)
    └── public/brand/         # Logos
```

---

## 2. Modèles Sequelize

| Modèle | Table | Colonnes clés | Problèmes |
|--------|-------|---------------|-----------|
| User | users (auto) | matricule, nom, email, role, hash_mdp, actif | Pas d'organizationId. ENUM limité à admin/manager/user |
| MenuItem | menu_items (auto) | libelle, type, description, image_url, allergenes, calories, actif | DOUBLON avec menu_item.js |
| DailyMenu | daily_menus | date_jour (UNIQUE global), locked | UNIQUE sans org → conflit multi-tenant |
| DailyMenuItem | daily_menu_items | daily_menu_id, menu_item_id, stock_quota | OK |
| Reservation | reservations | user_id, menu_item_id, date_jour, status, category, pickup_code, order_code, picked_at | Pas d'organizationId |
| Setting | settings | key (UNIQUE), value | Settings globales, pas par organisation |
| Notification | notifications | recipient_id, type, title, message, data, read_at | OK mais pas scopée à l'org |

---

## 3. Routes disponibles

### Auth (`/api/auth`)
- `POST /login` — Connexion
- `POST /signup` — Auto-inscription (protégée par env `ALLOW_SELF_SIGNUP`)
- `POST /change-password` — Changement de mot de passe
- `GET /me` — Profil courant

### Menu (`/api/menu`)
- `GET /items` — Liste catalogue
- `POST /items` — Création (manager/admin)
- `PATCH /items/:id` — Mise à jour (manager/admin)
- `DELETE /items/:id` — Suppression (manager/admin)
- `GET /today` — Menu du jour (**défini 2 fois !**)
- `POST /day` — Planification menu du jour (manager/admin)

### Réservations (`/api/reservations`)
- `POST /` — Créer 1 réservation unitaire (compat)
- `POST /confirm` — Créer/modifier une commande complète (panier)
- `GET /me` — Mes réservations (user)
- `DELETE /:id` — Annuler une ligne (user)
- `POST /cancel-order` — Annuler tout un order_code
- `POST /delete-order` — Supprimer définitivement un order_code
- `GET /day` — Liste du jour (manager/admin)
- `GET /summary` — Récap par catégorie (manager/admin)
- `GET /export` — Export CSV (manager/admin)
- `GET /lookup-order` — Lookup par QR code (manager/admin)
- `POST /redeem-order` — Valider par order_code (manager/admin)
- `POST /redeem-matricule` — Valider par matricule (manager/admin)

### Admin (`/api/admin`)
- `GET/POST /users` — Liste/création utilisateurs
- `PATCH/DELETE /users/:id` — Mise à jour/suppression
- `GET/PUT /settings` — Paramètres (heures, branding)
- `POST /branding/hero` — Upload image héro
- `POST /admin/users/:id/activate` — **Bug: route doublée** (`/api/admin/admin/users/...`)
- `POST /admin/users/:id/reject` — **Bug: même doublon**

### Notifications (`/api/notifications`)
- `GET /` — Liste notifications
- `GET /unread-count` — Compteur non lus
- `POST /:id/read` — Marquer lue

### Public (`/api`)
- `GET /settings` — Paramètres publics (sans auth)

---

## 4. Bugs identifiés

### Critiques
1. **Route doublée dans admin.js** (lignes 220-234) : les routes `/api/admin/admin/users/:id/activate` et `/api/admin/admin/users/:id/reject` sont montées sur un router déjà préfixé `/api/admin`. Résultat : elles arrivent à `/api/admin/admin/users/:id/...` au lieu de `/api/admin/users/:id/...`. Le frontend (App.jsx l.1127, 1139) appelle `admin/users/${userId}/activate` sans le préfixe `/api/` donc ces calls ne fonctionnent pas.

2. **URL relatives sans /api/ dans le frontend** : plusieurs fetch dans App.jsx utilisent des chemins sans `/api/` :
   - `notifications/unread-count` (l.1100)
   - `notifications?status=unread` (l.1109)
   - `notifications/${id}/read` (l.1119)
   - `admin/users/${userId}/activate` (l.1127)
   - `admin/users/${userId}/reject` (l.1139)

3. **Signup ENDPOINT incorrect** : `SIGNUP_ENDPOINT = "auth/signup"` (l.11) devrait être `API('/auth/signup')`.

4. **CORS doublé** : `app.use(cors({ origin: '*' }))` appelé deux fois (l.8 et l.15) — la seconde configuration avec `credentials: true` est plus stricte mais est ignorée en partie.

### Importants
5. **Doublon de route `/api/menu/today`** : défini deux fois dans `routes/menu.js` (l.119 et l.277) — Express ne prend que la première définition.

6. **Doublon de modèle** : `models/menu_item.js` (factory function) et `models/menuItem.js` (classe) décrivent tous deux le modèle `menu_item`. Le fichier factory n'est jamais importé dans l'app principale.

7. **`models/index.js` n'exporte pas les modèles** : chaque fichier route importe directement le modèle, créant des imports circulaires potentiels et rendant l'ajout de modèles complexe.

8. **Associations dans `index.js`** (entry point) : les associations Sequelize sont définies dans le fichier serveur, pas dans les modèles. Cela rend le test et la réutilisation difficiles.

9. **Seeds dans `start()`** : les données de démo sont insérées à chaque démarrage du serveur. En production avec plusieurs instances PM2, cela cause des conditions de course (mitigé par `findOrCreate` mais fragile).

### Mineurs
10. **`pm2` dans les dépendances frontend** : devrait être global ou dans le backend.
11. **`window.alert()` / `window.confirm()`** : UX dégradée, bloquants, non personnalisables.
12. **Pas de JWT_SECRET dans `.env`** : la valeur est absente du `.env` de production.

---

## 5. Problèmes de sécurité

| Gravité | Problème | Localisation |
|---------|----------|--------------|
| Haute | Pas de rate limiting sur `/api/auth/login` | routes/auth.js |
| Haute | CORS `origin: '*'` en production | index.js l.8 |
| Haute | Pas d'isolation multi-tenant (toute org voit toutes les données) | Tous les modèles/routes |
| Haute | Pas de validation d'input structurée (ex: express-validator) | Toutes les routes |
| Moyenne | `ALLOW_SELF_SIGNUP=true` en production sans confirmation email | .env |
| Moyenne | Upload: pas de vérification de type MIME côté serveur (magic bytes) | routes/menu.js, admin.js |
| Moyenne | `sequelize.sync()` sans `{ force: false }` explicite (risque si mal configuré) | index.js |
| Faible | Tokens JWT sans blacklist (logout côté serveur impossible) | routes/auth.js |
| Faible | Erreurs Sequelize exposées parfois en 500 sans sanitisation | Plusieurs routes |

---

## 6. Dette technique et incohérences de nommage

### Nommage
- Colonnes DB en snake_case (`hash_mdp`, `date_jour`) mais modèles en camelCase sans `underscored: true`
- Champ `entrée` avec accent dans ENUM → géré par normalisation mais source d'erreurs
- `libelle` (sans accent, français) vs `label` (anglais) utilisés ensemble
- `matricule` comme identifiant primaire de login (domaine cantine) mais `email` aussi disponible

### Architecture
- **Monolithe frontend** : 3237 lignes dans `App.jsx` — tout est imbriqué (state global, handlers, JSX). Impossible à maintenir au-delà d'une certaine taille.
- **Pas de React Router** : navigation par `activeTab` state. Les URLs ne changent pas, pas de deep linking possible.
- **Bootstrap CDN** : pas de tree-shaking, dépendance externe en production.
- **html5-qrcode CDN** : script externe non versionné (`unpkg.com`).
- **Pas de hook personnalisé** : tous les `useEffect` / fetch sont dans le composant racine.
- **Pas de TypeScript** : pas de contrats d'interface.
- **Pas de tests** : aucun fichier de test backend ou frontend.

### Code mort
- `backend/src/App.jsx`, `backend/src/api.js`, `backend/src/main.jsx` — fichiers React dans le dossier backend (jamais utilisés)
- `backend/index.html` — HTML dans le backend (jamais servi)
- La fonction `cancelOrder` est commentée dans App.jsx mais son bouton "Annuler" n'existe plus

---

## 7. Faiblesses UX/UI

- Pas de page d'état vide affichée proprement (juste "Aucune commande.")
- Formulaires sans validation visuelle en temps réel
- Pas de skeleton/loading state → l'interface "saute" au chargement
- Navigation tab-based sans URL → pas de bookmarking, pas de back/forward navigateur
- Un seul contexte couleur (bleu), pas de dark mode complet
- Pas de pagination sur les listes (toutes les réservations, tous les users)
- Messages de succès/erreur en bas à droite peuvent être manqués
- Pas d'onboarding / écran de bienvenue
- Design dense sur mobile (certains boutons trop petits)

---

## 8. Ce qui fonctionne bien

- Architecture Express propre et lisible
- Gestion des transactions Sequelize pour les opérations critiques (confirm, redeem, cancel)
- Logique de quotas par item du jour fonctionnelle
- Système QR code opérationnel (génération + validation)
- Export CSV fonctionnel
- Export PDF avec jsPDF + logo
- Gestion des rôles basique cohérente (admin/manager/user)
- Mode édition de commande avec annulation + recréation
- Notifications push in-app (lecture, compteur, activation compte)
- CORS paramétrable via env
- Waiting loop DB au démarrage (10 retries)
- PM2 ecosystem.config.js prêt

---

## 9. Hypothèses faites lors de l'audit

- La base de données est MySQL (confirmé par `mysql2` et dialect `'mysql'`)
- Le déploiement cible est VPS avec Nginx + PM2
- L'URL de production est `http://91.98.138.100` (dans `.env`)
- JWT_SECRET n'est pas défini dans `.env` de production (champ absent)
- La timezone cible est `Africa/Casablanca` (UTC+1)
- L'application est mono-tenant aujourd'hui (une seule cantine)

---

## 10. Plan de transformation SaaS — Résumé

Voir le fichier `PLAN_SAAS_RESTOBOOK.md` pour le plan détaillé étape par étape.

**Priorité 1 — Corrections immédiates** (bugs critiques, sécurité)
**Priorité 2 — Architecture multi-tenant** (Organization, organizationId)
**Priorité 3 — RBAC étendu** (SuperAdmin, Owner, Staff)
**Priorité 4 — Refactorisation frontend** (React Router, composants)
**Priorité 5 — Modules Canteen** (menus hebdo, statistiques avancées)
**Priorité 6 — Modules Restaurant** (menu numérique, commandes, fidélité)
**Priorité 7 — UX/UI modernisation** (design system, dark mode, responsive)
**Priorité 8 — Tests et robustesse** (validation, logs, tests)
