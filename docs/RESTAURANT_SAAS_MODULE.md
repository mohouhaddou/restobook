# Restobook Restaurant SaaS

Ce module positionne Restobook comme logiciel de gestion pour restaurateurs, snacks et petits groupes de restauration. Il complète les fonctions existantes de commandes et de menus sans introduire une logique de marketplace de livraison concurrente.

## Objectif produit

- Gérer le profil opérationnel du restaurant.
- Structurer le catalogue avec catégories, plats, prix, images, ordre et disponibilité.
- Suivre les commandes sur place, à emporter et réservations existantes.
- Donner un cockpit de ventes, clients, plats performants et exports.

## Modèles utilisés

- `Organization`: profil restaurant, coordonnées, options sur place et à emporter.
- `MenuCategory`: catégories de plats par organisation.
- `MenuItem`: plats, type, prix, image, disponibilité, catégorie et ordre.
- `Order`: commandes et réservations opérationnelles par restaurant.
- `OrderItem`: lignes de commande utilisées pour les statistiques par plat.
- `User`: rattachement client ou utilisateur interne quand disponible.

## API

Toutes les routes sont préfixées par `/api/restaurant-saas`, protégées par JWT, accès organisation et permissions restaurant.

- `GET /profile`: profil du restaurant.
- `PATCH /profile`: mise à jour du profil restaurant.
- `GET /menu`: catégories et plats du restaurant.
- `POST /categories`: création d'une catégorie.
- `PATCH /items/:id`: mise à jour des champs SaaS d'un plat.
- `GET /dashboard?from&to`: chiffre d'affaires, commandes, ticket moyen, clients, répartition par statut/type et top plats.
- `GET /customers?from&to`: historique clients agrégé.
- `GET /items/stats?from&to`: ventes, revenus et disponibilité par plat.
- `GET /export/sales.csv?from&to`: export CSV des commandes.
- `GET /export/items.csv?from&to`: export CSV des ventes par plat.

## Frontend

- Page: `RestaurantSaasPage.jsx`.
- Composants:
  - `RestaurantKpiCard.jsx`
  - `RestaurantItemStatsTable.jsx`
  - `CustomerHistoryTable.jsx`
- Navigation: entrée `Restaurant SaaS` pour les rôles ayant les permissions restaurant.
- Catalogue: `ItemsPage.jsx` gère désormais catégorie, prix, image, ordre et disponibilité.

## Permissions

- `restaurant.profile.manage`: gestion du profil restaurant.
- `restaurant.menu.manage`: gestion menus, catégories et plats.
- `restaurant.orders.manage`: gestion des commandes existantes.
- `restaurant.stats.view`: tableaux de bord, statistiques et exports.

## Exports

- CSV backend pour ventes et plats.
- PDF frontend via `jspdf` et `jspdf-autotable`.

## Limites actuelles

- Les exports PDF sont générés côté navigateur.
- Les statistiques exploitent les commandes enregistrées; elles ne calculent pas encore marge, coût matière ou stock.
- La réservation de table et les commandes restent dans les modules existants; ce module sert de cockpit SaaS unifié.
