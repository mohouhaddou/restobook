# Restobook Canteen

Module destine aux cantines d'entreprises, ecoles, administrations et sites internes.

## Modeles utilises

| Domaine | Modeles |
| --- | --- |
| Organisation | `Organization`, `Setting` |
| Employes / eleves | `User` avec `organization_id` et roles `employee`, `canteen_admin`, `kitchen_staff` |
| Catalogue | `MenuItem` |
| Menus hebdomadaires | `DailyMenu`, `DailyMenuItem` |
| Reservations | `Reservation` |
| Statistiques | Agregations sur `Reservation`, `MenuItem`, `User` |

Le module reutilise les tables existantes afin de ne pas casser les flux historiques `/menu`, `/reservations` et `/stats`.

## Routes API

Toutes les routes sont montees sous `/api/canteen`.

| Route | Permission | Usage |
| --- | --- | --- |
| `POST /organizations` | `platform.manage` | Creer une organisation de type `canteen` |
| `GET /employees` | `organization.users.manage` | Lister employes/eleves associes a l'organisation |
| `POST /employees` | `organization.users.manage` | Creer et associer un utilisateur |
| `PATCH /employees/:id` | `organization.users.manage` | Modifier role, statut, contact ou rattachement |
| `GET /week?from=` | menu/reservation/stats cantine | Lire les menus d'une semaine |
| `PUT /week` | `canteen.menu.manage` | Enregistrer plusieurs jours de menus et quotas |
| `POST /reservations` | `canteen.reservations.create` | Reserver un repas pour l'utilisateur courant |
| `POST /qr/validate` | `canteen.prep.manage` | Valider une commande par QR/order code |
| `GET /history` | reservation create/manage | Historique des repas reserves/consommes |
| `GET /attendance` | `canteen.stats.view` | Statistiques de frequentation |
| `GET /waste` | `canteen.stats.view` | Estimation du gaspillage alimentaire |

## Pages frontend

| Page | Route | Usage |
| --- | --- | --- |
| `CanteenPage` | `/#/canteen` | Vue module: KPIs, semaine, employes, historique, gaspillage |
| `PlanningPage` | `/#/planning` | Planification hebdomadaire existante |
| `DashboardPage` | `/#/` | Reservation utilisateur |
| `PrepPage` | `/#/prep` | Preparation cuisine et exports |
| `QrScanPage` | `/#/scan` | Validation QR existante |
| `StatsPage` | `/#/stats` | Statistiques de frequentation/gaspillage |
| `UsersPage` | `/#/users` | Administration utilisateurs complete |

## Composants UI ajoutes

- `CanteenKpiCard`
- `WeeklyMenuSummary`
- `MealHistoryTable`

## Flux principal

1. Le SuperAdmin cree une organisation cantine.
2. Le CanteenAdmin cree ou importe les employes/eleves.
3. Le manager/admin planifie la semaine et les quotas.
4. L'employe reserve son repas.
5. La cuisine prepare depuis la vue preparation.
6. Le staff valide le retrait par QR code.
7. Les statistiques calculent frequentation, repas consommes et gaspillage estime.

## Permissions recommandees

| Role | Acces module |
| --- | --- |
| `superadmin` | Tout |
| `organization_admin` | Tout dans son organisation |
| `canteen_admin` | Cantine complete |
| `kitchen_staff` | Preparation et validation QR |
| `employee` | Reservation et historique personnel |
