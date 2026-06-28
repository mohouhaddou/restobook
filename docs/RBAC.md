# RestoBook RBAC

## Objectif

RestoBook utilise un modele multi-roles base sur des permissions metier. Les anciens roles restent acceptes pour ne pas casser les comptes existants, mais les nouveaux roles SaaS doivent etre privilegies pour les nouveaux tenants.

## Roles canoniques

| Role | Portee | Droits principaux |
| --- | --- | --- |
| `superadmin` | Plateforme | Acces global, organisations, support, tous modules |
| `restaurant_owner` | Organisation restaurant | Menu, commandes, tables, profil public, stats, utilisateurs, settings |
| `restaurant_manager` | Organisation restaurant | Menu, commandes, tables, stats restaurant |
| `canteen_admin` | Organisation cantine | Menus cantine, reservations, preparation, stats, utilisateurs, settings |
| `organization_admin` | Organisation mixte | Administration organisation, utilisateurs, settings, cantine et restaurant |
| `employee` | Organisation cantine | Reservation de repas et notifications |
| `customer` | Client public | Compte client, commandes marketplace/public restaurant |
| `kitchen_staff` | Cuisine/service | Preparation, scan/retrait, statuts commandes |
| `delivery` | Livraison interne | Livraisons disponibles, acceptation, suivi statut |

## Compatibilite legacy

| Ancien role | Equivalent permissions |
| --- | --- |
| `owner` | `organization_admin` |
| `admin` | `organization_admin` |
| `manager` | Legacy manager: menus, preparation, reservations, commandes, tables et stats sans droits utilisateurs/settings |
| `staff` | `kitchen_staff` |
| `user` | `employee` |

## Permissions principales

| Permission | Usage |
| --- | --- |
| `platform.manage` | Superadmin plateforme |
| `organization.manage` | Gestion generale d'une organisation |
| `organization.users.manage` | CRUD utilisateurs, activation, rejet |
| `organization.settings.manage` | Parametres horaires et tenant |
| `organization.branding.manage` | Logo, hero, couleurs |
| `ai.nutrition.analyze` | Analyse nutritionnelle estimative des plats |
| `canteen.menu.manage` | Catalogue et planification cantine |
| `canteen.reservations.create` | Reservation employee/user |
| `canteen.reservations.manage` | Liste, export, annulation manager |
| `canteen.prep.manage` | Preparation, scan QR, validation retrait |
| `canteen.stats.view` | Statistiques cantine |
| `restaurant.menu.manage` | Categories et menu restaurant |
| `restaurant.orders.create` | Creation commande restaurant interne |
| `restaurant.orders.manage` | Liste et detail commandes |
| `restaurant.orders.status` | Changement statut commande |
| `restaurant.tables.manage` | Tables, QR, reservations de table |
| `restaurant.profile.manage` | Profil public restaurant |
| `restaurant.stats.view` | Statistiques restaurant |
| `delivery.manage` | Espace livreur |
| `customer.account` | Profil client marketplace |
| `notifications.read` | Notifications utilisateur |

## Fichiers de reference

- Backend permissions : `backend/auth/permissions.js`
- Middleware backend : `backend/middleware/auth.js`
- Frontend permissions : `frontend/src/auth/permissions.js`
- Documentation : `docs/RBAC.md`

## Middleware backend

Utiliser les permissions pour les nouvelles routes :

```js
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../auth/permissions');

router.post(
  '/orders',
  requireAuth,
  requirePermission(PERMISSIONS.RESTAURANT_ORDER_CREATE),
  handler
);
```

`requireRole(...)` existe encore pour compatibilite, mais les nouvelles routes doivent utiliser `requirePermission(...)`.

## Migration base de donnees

Apres deploiement du code, executer :

```bash
cd backend
npm run migrate:roles
```

Cette migration etend l'ENUM `users.role` avec les nouveaux roles tout en conservant les anciennes valeurs.

## Regle d'or multi-tenant

Toute route authentifiee non-superadmin doit passer par `requireOrganizationAccess` et filtrer les donnees avec `organization_id`.
