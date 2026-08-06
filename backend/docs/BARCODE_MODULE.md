# Code-barres — catalogue produits + POS

Identification des produits physiques par code-barres (EAN/UPC/GTIN/CODE128), pour accélérer l'ajout au catalogue et la vente en caisse. Intégré au catalogue existant — pas de nouvelle table de produits.

## 1. Pourquoi c'est optionnel

Un code-barres identifie un **article manufacturé réel**. On ne peut pas en inventer un pour un produit qui n'en a pas (risque de collision avec un vrai produit ailleurs). Le champ `barcode` est donc **toujours nullable** : un produit sans code-barres reste vendable normalement (recherche par nom, ajout manuel au panier).

## 2. Quels produits sont concernés

| Concerné | Non concerné (exclu volontairement) |
|---|---|
| Épicerie / hanout, supermarché | Restaurants, cafés |
| Parapharmacie, pharmacie (produits OTC emballés) | Plats, menus, services |
| Boissons, produits d'entretien, cosmétiques, produits industriels | Produits artisanaux/préparés sans code-barres |

Concrètement : `HanoutProduct` et `PharmacyMedicine` portent les champs `barcode`/`barcode_type`/`barcode_source`/`barcode_verified`. **`MenuItem` (plats/menus resto) n'a et n'aura jamais ces champs** — c'est vérifié par un test de non-régression (`tests/barcode_utils.test.js`).

## 3. Modèle de données

| Champ | Rôle |
|---|---|
| `barcode` | Code réel scanné/saisi (EAN13, EAN8, UPC_A, UPC_E, GTIN, CODE128). Unique **par organisation** (deux commerces différents peuvent avoir le même code). |
| `barcode_type` | Type détecté automatiquement à la saisie (jamais demandé au commerçant). |
| `barcode_source` | `MANUAL` (saisi/scanné à la main) \| `SCAN` \| `IMPORT` \| `GENERATED` (réservé, jamais utilisé en pratique — voir section 1). |
| `barcode_verified` | Réservé pour une validation manuelle future (non utilisé en v1). |
| `sku` (hanout) | Référence interne libre du commerçant — **différent** du code-barres, jamais un vrai code produit, jamais unique ni validé comme un EAN. |

## 4. Douchette USB/Bluetooth

Une douchette scanner USB ou Bluetooth **se comporte comme un clavier** : elle tape les chiffres du code puis envoie un `Enter`. Aucune intégration matérielle n'est nécessaire — il suffit que le focus soit dans le champ de recherche/scan (POS) ou le champ code-barres (formulaire produit). Le composant `<BarcodeInput/>` capture cet `Enter` et déclenche la recherche.

## 5. Scan code-barres par caméra

Implémenté via `<BarcodeCameraScanner/>` (librairie `html5-qrcode`), intégré directement dans `<BarcodeInput/>` (bouton 📷) — disponible partout où `BarcodeInput` est utilisé (formulaires produit hanout/pharmacie) et dans le POS (bouton dédié à côté du champ de scan).

- Formats lus : EAN-13, EAN-8, UPC-A, UPC-E, CODE-128.
- Utilise l'API native `BarcodeDetector` du navigateur quand elle est disponible (plus rapide), avec repli automatique sur le décodeur ZXing embarqué de `html5-qrcode` sinon — géré par la librairie elle-même (`useBarCodeDetectorIfSupported: true`), aucun code à dupliquer.
- Ferme proprement la caméra (`stop()` + `clear()`) après détection, à la fermeture manuelle et au démontage du composant — jamais de caméra qui reste allumée en arrière-plan.
- Permission refusée ou caméra indisponible → message clair affiché dans la modale, jamais bloquant : la saisie manuelle (et la douchette USB/Bluetooth) restent utilisables à tout moment, aucun champ n'est désactivé.
- Formulaire produit : après détection, le champ `barcode` est prérempli automatiquement (comme une saisie manuelle) ; le préremplissage nom/marque/catégorie/image reste un no-op documenté (pas de catalogue universel — voir section 10).
- POS : après détection, réutilise exactement la même fonction `scanCode()` que la douchette (Enter clavier) — ajout panier, incrément de quantité si déjà présent, alerte stock insuffisant, message "Produit introuvable".

## 5bis. Photo produit par caméra

`<ProductImageCapture/>` ajoute, à côté du sélecteur de fichier classique ("📁 Choisir une image"), un bouton "📷 Prendre une photo" utilisant `<input type="file" capture="environment">`. Sur mobile/tablette, cela ouvre l'appli caméra native de l'appareil (avec son propre aperçu/reprise géré par l'OS) ; sur desktop ou si l'attribut n'est pas supporté, le navigateur retombe automatiquement sur le sélecteur de fichiers standard — aucune détection de compatibilité nécessaire, jamais bloquant.

Après capture ou choix de fichier : compression/redimensionnement côté client (`imageCompress.js`, max 1280px, JPEG qualité 0.82, via `<canvas>`, sans dépendance supplémentaire) puis aperçu **dans l'application** avec deux actions : "🔄 Reprendre" (annule et recommence) ou "✓ Utiliser cette photo" (upload vers l'endpoint existant `/hanout-pro/upload` ou `/pharmacy-pro/upload`, inchangé côté backend). L'upload classique n'est jamais remplacé, seulement complété.

## 6. Endpoints

| Route | Permission | Usage |
|---|---|---|
| `GET /hanout-pro/products/barcode/:barcode` | (accès hanout) | Recherche exacte, catalogue hanout |
| `POST/PATCH /hanout-pro/products/:id/barcode` | `HANOUT_PRODUCT_MANAGE` | Définir/modifier le code-barres d'un produit hanout |
| `GET /pharmacy-pro/medicines/barcode/:barcode` | (accès pharmacie) | Recherche exacte, catalogue pharmacie |
| `POST /pos/scan` | `POS_SELL` | Scan côté caisse — `findBusinessProductByBarcode(req, barcode)` |

Les endpoints `POST/PUT` existants (`/hanout-pro/products`, `/pharmacy-pro/medicines`) acceptent aussi directement `barcode` dans le corps de la requête — pas besoin d'un appel séparé pour créer un produit avec son code-barres du premier coup.

`POST /pos/scan` ne fonctionne que pour le moteur **hanout** (catalogue `HanoutProduct`) : le moteur resto (`MenuItem`, plats/menus) n'a pas de notion de code-barres et répond `404 NOT_FOUND` proprement, sans erreur.

## 7. Permissions

Seuls owner/admin/manager (permissions `HANOUT_PRODUCT_MANAGE` / `PHARMACY_PRODUCT_MANAGE`, déjà utilisées pour la gestion du catalogue) peuvent créer/modifier un code-barres. Le caissier (`POS_SELL`) peut scanner et vendre, jamais modifier le catalogue.

## 8. Différence `barcode` vs `sku` / référence interne

- **`barcode`** = identifiant public réel du produit (imprimé dessus par le fabricant). Unique par commerce, jamais inventé.
- **`sku`** (hanout) = référence interne du commerçant (étiquette de rayon, code fournisseur…), libre, non validée, peut se répéter. Sert de repère humain, pas d'identifiant de scan.

À la migration, un `sku` existant n'est recopié en `barcode` **que s'il correspond déjà à un format EAN/UPC/GTIN valide** — jamais de génération ni de copie d'une référence non conforme.

## 9. Lancer et tester

```bash
# Migration (idempotente, sûre à relancer, détecte les doublons avant de poser l'index unique)
cd backend && npm run migrate:barcode

# Tests backend
node tests/barcode_utils.test.js
node tests/barcode_hanout.test.js
node tests/barcode_pharmacy.test.js
node tests/pos_scan.test.js
```

## 10. Limitations connues (v1)

- Pas de catalogue universel partagé entre commerces (`universal_products`) — chaque commerce gère ses propres codes-barres. L'architecture (fonction de lookup isolée `findBusinessProductByBarcode`) est prête à évoluer vers un lookup universel en amont sans changer les écrans appelants. Le scan caméra ne préremplit donc pas encore nom/marque/catégorie/image automatiquement.
- `barcode_verified` et `barcode_source=GENERATED` existent dans le schéma mais ne sont pas encore utilisés — réservés pour une future validation/import en masse.
- Pas de tests automatisés pour la caméra (aucun device Android physique ni mock `getUserMedia` dans cet environnement) — voir la checklist de vérification manuelle ci-dessous.

## 11. Vérification manuelle (caméra — à faire sur un vrai mobile/tablette)

- [ ] Prendre une photo produit depuis mobile/tablette (formulaire hanout et pharmacie) → aperçu correct, reprise fonctionne, upload aboutit.
- [ ] Upload classique (choisir un fichier) toujours fonctionnel en parallèle.
- [ ] Refuser la permission caméra → message clair affiché, formulaire toujours utilisable (saisie manuelle du code-barres, upload classique).
- [ ] Scanner un code-barres imprimé à la caméra dans le formulaire produit → champ `barcode` rempli automatiquement.
- [ ] Scanner un code-barres à la caméra dans le POS → produit ajouté au panier automatiquement, quantité incrémentée si déjà présent, alerte si stock insuffisant, "Produit introuvable" si aucun résultat.
- [ ] Fermer la modale de scan (bouton ✕ ou après détection) → la caméra s'éteint réellement (vérifier l'indicateur caméra du système).
- [ ] Comportement stable sur tablette Android (Chrome/WebView) — cible principale du POS.
