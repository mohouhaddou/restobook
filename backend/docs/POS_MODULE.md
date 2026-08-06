# Module POS / Caisse

Module de vente en magasin intégré à iFilino Business — pas d'application séparée. Une vente POS est enregistrée comme une commande interne du système existant (`Order` ou `HanoutOrder`), taguée `source='POS'`.

## 1. Portée

- **Couvert** : commerces sur le moteur *resto* (restaurant, café, boulangerie, pâtisserie, boucherie, supermarché — catalogue `MenuItem`) et sur le moteur *hanout* (épicerie — catalogue `HanoutProduct`).
- **Hors-scope** : la Pharmacie a déjà son propre flux de vente (`pharmacySale`, écran POS dans `PharmacyDashboard.jsx`) — non touché par ce module. Un appel POS sur une organisation `module='pharmacie'` répond `403 PHARMACY_NOT_SUPPORTED`.
- **Règle de dispatch** (`resolvePosEngine` dans `backend/src/modules/pos/service.js`) : selon `business.module` (`resto` → `Order`/`OrderItem`/`MenuItem`, `hanout` → `HanoutOrder`/`HanoutOrderItem`/`HanoutProduct`).

## 2. Modèle de données

| Table | Colonnes ajoutées |
|---|---|
| `orders` | `source` (MARKETPLACE\|POS\|ADMIN), `cashier_id`, `cash_register_session_id`, `tax_amount`, `type` étendu avec `in_store`, `payment_method` étendu avec `credit` |
| `hanout_orders` | mêmes colonnes + `payment_method`/`payment_status` (nouveaux), `delivery_type` étendu avec `in_store` |
| `menu_items` | `sku`, `track_stock`, `stock_quantity` (miroir de `hanout_products`, qui les avait déjà) |
| `hanout_credits` | `pos_order_id`, `pos_order_type` (`order`\|`hanout_order`) — trace le crédit vers sa vente d'origine |
| `cash_register_sessions` | **nouvelle table** : `business_id`, `cashier_id`, `opening_amount`, `closing_amount`, `expected_cash`, `counted_cash`, `cash_difference`, `total_cash`, `total_card`, `total_credit`, `sales_count`, `status` (OPEN\|CLOSED), `opened_at`, `closed_at` |

`source='POS'` est le marqueur pour filtrer les ventes d'origine caisse dans `orders`/`hanout_orders`.

## 3. Endpoints (`/api/pos/*`)

| Méthode & route | Permission | Description |
|---|---|---|
| `GET /pos/business` | `POS_SELL` | Infos commerce (nom, logo, adresse, tél.) pour le ticket |
| `GET /pos/products?q=` | `POS_SELL` | Catalogue (produits + catégories) du moteur résolu |
| `GET /pos/customers?q=` | `POS_SELL` | Recherche client crédit (nom/téléphone) |
| `POST /pos/session/open` | `POS_SESSION_OPEN` | Ouvre la caisse (`opening_amount`) |
| `POST /pos/session/close` | `POS_SESSION_CLOSE` | Ferme la caisse (`counted_cash`, `notes`), calcule l'écart |
| `GET /pos/session/current` | `POS_SELL` | Session ouverte de ce commerce, ou `null` |
| `POST /pos/sale` | `POS_SELL` | Enregistre une vente (`items`, `payment_method`, `customer_id?`, `discount_amount?`) |
| `GET /pos/sales` | `POS_HISTORY_VIEW` | Historique (`date`, `cashier_id`, `payment_method`, pagination) |
| `GET /pos/sales/:id` | `POS_HISTORY_VIEW` | Détail d'un ticket |
| `POST /pos/sales/:id/refund` | `POS_REFUND` | Annule/rembourse, restaure le stock et le crédit |
| `GET /pos/report/daily?date=` | `POS_REPORT_VIEW` | Rapport journalier (totaux par mode de paiement, par caissier) |

Une session de caisse est **par commerce** (`business_id`), pas par caissier — un seul tiroir-caisse logique partagé.

## 4. Permissions

| Rôle | POS_SELL | POS_SESSION_OPEN | POS_SESSION_CLOSE(_ANY) | POS_HISTORY_VIEW | POS_REFUND | POS_REPORT_VIEW |
|---|---|---|---|---|---|---|
| `restaurant_owner` / `organization_admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `restaurant_manager` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `employee` (caissier) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |

Le caissier ne peut pas fermer la caisse d'un autre utilisateur ni rembourser une vente. Pas de nouveau rôle `pos_cashier` en v1 : le rôle `employee` existant porte les permissions de caissier.

## 5. Ventes à crédit

Aucune nouvelle table de crédit. Une vente `payment_method=CREDIT` exige un `customer_id` (référence `hanout_credit_customers`, réutilisée pour les deux moteurs) et crée une ligne `hanout_credits` classique (via `backend/src/modules/hanout/creditLedger.js`, extrait de `creditRoutes.js` pour être partagé). Le solde client, le journal d'audit et le remboursement partiel/total se gèrent avec l'écran crédit existant (`/hanout-dashboard` → onglet Crédit Clients) — pas de nouvel écran ni endpoint POS pour ça.

## 6. Stock

À la validation d'une vente, chaque ligne dont `track_stock=true` est vérifiée puis décrémentée dans la même transaction ; si le stock est insuffisant, toute la vente est rejetée (`INSUFFICIENT_STOCK`) sans écriture partielle. Un remboursement restaure le stock symétriquement. Les produits `track_stock=false` (défaut) restent en stock illimité.

## 7. Impression ticket

`frontend/src/pages/pos/PosReceipt.jsx` + `frontend/src/styles/pos-receipt.css` : rendu HTML hors-écran affiché uniquement à l'impression (`@media print`), déclenché par `window.print()`. Format 58mm/80mm via l'attribut `data-width`. Toute la donnée du ticket passe par `buildTicketPayload()` (`posApi.js`) — point d'extension unique pour brancher plus tard une imprimante Bluetooth/USB/réseau ou un wrapper Android sans toucher au composant HTML.

## 8. Interface

- `/pos` — Vente rapide (grille produits par catégorie, recherche/scan, panier, paiement, impression)
- `/pos/session` — Ouverture/fermeture de caisse, résumé du jour
- `/pos/history` — Historique des tickets, détail, réimpression, remboursement

Responsive : panier fixe à droite sur tablette/desktop, panier en tiroir du bas sur mobile (< 768px).

## 9. Lancer et tester

```bash
# Migration (idempotente, sûre à relancer)
cd backend && npm run migrate:pos

# Tests backend (scripts Node autonomes, DB réelle configurée en .env)
node tests/pos_session.test.js
node tests/pos_sale_resto.test.js
node tests/pos_sale_hanout.test.js
node tests/pos_credit.test.js
node tests/pos_report.test.js

# Démarrer l'app
cd backend && npm start        # ou pm2 restart index
cd frontend && npm run dev     # ou npm run build
```

## 10. Limitations connues (v1)

- Pas de configuration de TVA par produit (`tax_amount` stocké, toujours à 0).
- Une session de caisse par commerce, pas par caissier/tiroir.
- Pas d'alerte stock bas dédiée au POS (existe uniquement côté Pharmacie aujourd'hui).
- Pas de test automatisé du rendu du ticket HTML (vérification manuelle via impression navigateur).
- Impression v1 = navigateur uniquement ; Bluetooth/USB/réseau/Android à brancher sur `buildTicketPayload()`.
