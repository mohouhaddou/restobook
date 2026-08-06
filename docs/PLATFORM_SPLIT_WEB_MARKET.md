# Séparation ifilino-web / ifilino-market / shared — Analyse architecturale

Date : 2026-08-06
Statut : **Analyse uniquement — aucune migration de code effectuée**

## Contexte

Le dépôt `restobook` (nom historique : projet parti d'une app de réservation
de cantine) héberge aujourd'hui, en réalité, **deux plateformes distinctes
dans un seul monolithe** :

1. Un réseau de **portails de contenu** grand public : Discover (magazine),
   Comics, GamingHub, Sports, Kids, Study — avec leurs propres pipelines
   d'import/publication IA, narration audio (Kokoro/TTS), produits
   numériques (ebooks, audiobooks, coloriages), pub (Ads).
2. Une **marketplace commerçants** : restaurants (`resto`), cantines
   (`cantine`), épiceries de quartier (`hanout`), pharmacies (`pharmacy`),
   avec catalogue produits, commandes, livraison, POS/caisse, fidélité
   (loyalty), avis, hero carousels marketplace/store.

Les deux sont actuellement servis par **un seul process Node (PM2 `index`,
port 3000)**, **une seule base MySQL**, **un seul bundle React (Vite)**, et
**un seul panneau `/superadmin` mélangeant les deux mondes** (ex :
`GamingHubAdminPage`, `PlayAdminPage`, `StudyAdminPage` côte à côte avec
`PaymentsAdminPage`, la gestion des commandes marketplace, etc.).

En production, le domaine réel est **`ifilino.com`** (vhost nginx
`/etc/nginx/sites-enabled/ifilino.conf`, certificat Let's Encrypt) — le nom
"RestoBook" ne survit plus que dans `package.json` et le README.

**But de ce document** : cartographier exhaustivement chaque module vers
`WEB` (ifilino-web), `MARKET` (ifilino-market) ou `SHARED`, sans supposer
que seul le dossier `/marketplace` appartient à la marketplace — conforme à
la demande de "détecter les dépendances cachées automatiquement".

---

## Classification — Backend (`backend/src/modules/*`)

| Module | Cible | Rôle réel |
|---|---|---|
| `discover` | WEB | Magazine iFilino, articles, rubriques, IA de brouillon |
| `comics` | WEB | Lecteur BD, éditorial, engagement, scheduler |
| `gaminghub` | WEB | Contenu éditorial jeux vidéo (news/tests), pas le moteur de jeu |
| `play` | WEB | Moteur de mini-jeux jouables (kids), gating freemium |
| `portals` + `portalHero` | WEB | Moteur générique portails **Sports** et **Kids** (`config.js` : `PORTALS = {sports, kids}`) |
| `study` | WEB | Leçons/e-learning (rattaché au parcours Kids : `/kids/:lang/learn`) |
| `digitalProducts` | WEB | PDF/audiobook/coloriage/activity pack — 100% vocabulaire Kids (`kids.digitalProducts.*`) |
| `narration` | WEB | Moteur TTS Kokoro, consommé uniquement par `digitalProducts` (génération audiobook) |
| `ai-import`, `ai-publisher` | WEB | Pipeline d'ingestion/publication de contenu éditorial (articles, images, SEO) pour Discover/Comics/GamingHub/Study |
| `acquisition` | MARKET | Vérifié : sourcing de nouveaux commerces (resto/hanout/pharmacie) via OpenStreetMap (`candidateReviewService`, mapping `module: resto/hanout/pharmacie`) — pas du contenu éditorial |
| `ads` | WEB | Régie publicitaire (placements, campagnes, stats) — cible le contenu grand public |
| `resto` | MARKET | SaaS restaurant : menus, tables, satisfaction, nutrition IA, dashboard |
| `cantine` | MARKET | Réservation cantine (le cœur historique "RestoBook") |
| `hanout` | MARKET | Épicerie de quartier : produits, crédit client, commandes |
| `pharmacy` | MARKET | Pharmacie : ventes, lots, prescriptions, fournisseurs, crédit |
| `businesses` | MARKET | Fiches commerçants (profils resto/hanout/pharmacie) |
| `catalog` | MARKET | Catalogue produit marchand, connecteur OpenFoodFacts |
| `orders` | MARKET | Commandes marketplace + volet livraison associé |
| `delivery` | MARKET | Livreurs, zones, tarification, tracking, véhicules |
| `pos` | MARKET | Caisse (sessions, tickets, remboursements) |
| `loyalty` | MARKET | Cashback, règles hiérarchiques, anti-fraude, réversion |
| `marketplaceHero`, `storeHero` | MARKET | Hero carousels marketplace globale / par commerce |
| `reviews` | MARKET | Avis produits/commerces (photos, votes, signalement) |
| `dashboard` (shoppingList*) | MARKET | Assistant listes de courses (mémoire projet : Phase 1 livrée) |
| `admin` (routes agrégées) | MIXTE | Regroupe `loyaltyProgramRoutes` (MARKET), `subscriptionsRoutes` (SHARED), `superadminRoutes` (SHARED) — **à éclater**, pas un vrai module |
| `auth`, `users`, `organizations` | SHARED | Authentification, comptes, tenant racine — utilisé par les deux mondes |
| `notifications` | SHARED | Notifications push/in-app, consommées par tous les modules |
| `media` | SHARED | Bibliothèque média (upload, IA, recherche) — images produits **et** images éditoriales |
| `seo` | SHARED | SSR, sitemap, meta/schema générateurs — toutes verticales |
| `payments` | SHARED | Providers PayPal/Paddle/Simulated — sert les commandes marketplace **et** les achats de produits numériques Kids/abonnements |

\* Module marqué à vérifier avant migration effective (ambiguïté constatée pendant l'analyse, pas supposée).

## Classification — Frontend (`frontend/src/{modules,pages}`)

| Zone | Cible | Détail |
|---|---|---|
| `modules/comics*`, `pages/discover*`, `modules/gaminghub`, `modules/play`, `pages/play`, `modules/kids-*`, `pages/kids`, `modules/portals`, `pages/portals`, `modules/study`, `pages/study`, `pages/ads`, `pages/seo` | WEB | Portails grand public + leurs pages superadmin dédiées |
| `modules/marketplace`, `modules/resto`, `modules/cantine`, `modules/hanout`, `pages/pharmacy`, `pages/restaurant`, `pages/hanout`, `pages/marketplace`, `pages/marketplaceHero`, `pages/pos`, `pages/delivery` | MARKET | Marketplace + back-office commerçants |
| `pages/superadmin/*` | MIXTE | Un seul dossier plat mélangeant `GamingHubAdminPage`, `PlayAdminPage`, `StudyAdminPage`, `PortalsAdminPage` (WEB) avec `PaymentsAdminPage` (SHARED), `AcquisitionDashboardPage` (WEB), `MediaCenterPage`/`MediaAnalytics` (SHARED), `DigitalProductsPanel` (WEB), `DeliveryDocumentsReviewPage` (MARKET) — **c'est exactement le dossier à éclater en deux back-offices** |
| `pages/infra` | SHARED (interne SuperAdmin plateforme) | Monitoring infra serveur — ni web ni market, outil opérationnel plateforme |
| `shared/`, `components/ui`, `brandAssets.js`, `i18n/` | SHARED | Design system, composants UI, client API (`api.js`), traductions |
| `auth/`, `contexts/` | SHARED | Session, contexte utilisateur |

## Modèles (`backend/models/*`) — regroupement par préfixe

- **WEB** : `gaming*`, `play*`, `portalContent*`, `portalHeroSlide`, `article*`, `media*` (partagé, voir shared), `study*`, `digitalProduct`, `pushToken` (partagé)
- **MARKET** : `hanout*`, `pharmacy*`, `menuItem`, `dailyMenu*`, `tableReservation`, `reservation`, `restaurantTable`, `order*`, `cart*`, `coupon*`, `delivery*`, `loyalty*`, `cashback*`, `marketplaceHeroSlide`, `storeHeroSlide`, `review*`, `favorite`, `productBrand/Category/Option/Variant`, `globalProduct`, `cashRegisterSession`, `businessReply`
- **SHARED** : `user`, `organization`, `business` (tenant-level), `address`, `city`, `setting`, `notification`, `paymentProviderConfig`, `subscriptionPlan`, `userSubscription`, `authFailedLogin`
- **AMBIGU (à trancher en Phase 0)** : `adCampaign*`/`adPlacement*`/`adImpression`/`adClick` (WEB si régie éditoriale, MARKET si aussi utilisé pour promouvoir des commerces — vérifier les cibles de campagne réelles)

---

## Permissions actuelles (`backend/src/modules/auth/permissions.js`)

Un seul système de permissions plat couvre déjà les deux mondes (`CANTEEN_*`,
`RESTAURANT_*`, `HANOUT_*`, `PHARMACY_*`, `POS_*` côté Market ;
`PLAY_MANAGE`, `GAMING_MANAGE`, `COMICS_*`, `ADS_MANAGE`, `MEDIA_*` côté
Web). Il n'existe **aucun regroupement `web.admin` / `market.admin`**
aujourd'hui — un SuperAdmin a accès à tout, sans distinction. C'est la
brique manquante pour permettre "des administrateurs autorisés à accéder à
l'un ou l'autre tableau de bord selon leurs rôles".

---

## Pourquoi un big-bang "3 dépôts séparés" est risqué ici

Contrainte réelle constatée (pas supposée) :

- **1 seul process PM2** (`ecosystem.config.js` → app `index`, port 3000)
- **1 seule base MySQL**, un seul `models/index.js` avec toutes les
  associations Sequelize croisées (ex: `loyalty` dépend de `order` qui
  dépend de `business`, qui est utilisé par resto/hanout/pharmacy/cantine)
- **1 seul bundle Vite** avec **1 seul `App.jsx`** (700+ routes)
- **1 seul vhost nginx** (`ifilino.conf`) pointant vers ce process unique,
  domaine de prod déjà live (`ifilino.com`)
- Aucun DNS/certificat existant pour `admin.ifilino.com` ou
  `market-admin.ifilino.com` — leur création est une action infra hors
  du contrôle du code (je ne peux pas provisionner DNS/SSL moi-même)

Découper physiquement en 3 dépôts + 2 sous-domaines en une seule passe
signifierait réécrire l'accès DB, l'auth partagée, le bundling et le
routing nginx simultanément, sur une app en production — risque élevé de
casse pour un gain immédiat nul (aucune des deux "équipes" n'existe encore
séparément).

## Approche recommandée : séparation en place (strangler fig), puis split physique si besoin

**Phase 1 — Cloisonnement des permissions (backend, additif, sans risque)**
Ajouter `PERMISSION_GROUPS = { web: [...], market: [...], shared: [...] }`
dans `permissions.js` à partir de la table ci-dessus, sans retirer de
permissions existantes. Ajoute `requireWebAdmin` / `requireMarketAdmin`
comme middlewares dérivés de `requirePermission`.

**Phase 2 — Espacement des routes API**
Monter les routers existants sous deux préfixes explicites
`/api/web-admin/*` et `/api/market-admin/*` (alias vers les routers déjà
en place dans `src/modules/*` — pas de déplacement de fichiers), gatés par
les middlewares de la Phase 1. Le reste de l'API publique ne bouge pas.

**Phase 3 — Deux tableaux de bord SuperAdmin dans le même bundle**
Éclater `pages/superadmin/` en `pages/admin-web/` et `pages/admin-market/`
selon la table de classification ci-dessus, avec deux entrées de nav
distinctes gardées par les permissions Phase 1. Toujours un seul build
Vite, un seul domaine — zéro changement infra.

**Phase 4 — Domaines séparés (optionnel, décision produit)**
Une fois Phase 3 stable : créer les vhosts `admin.ifilino.com` /
`market-admin.ifilino.com` (DNS + certbot, action manuelle), les faire
pointer vers le même process Node avec un routing par `Host` header (pas
besoin de deux process PM2 tant que la charge ne le justifie pas).

**Phase 5 — Split physique en dépôts séparés (optionnel, si l'équipe grossit)**
`ifilino-web/`, `ifilino-market/`, `shared/` en paquets npm publiés en
interne ou en monorepo (Turborepo/Nx) — à ne déclencher que si deux
équipes distinctes travaillent réellement en parallèle ; sinon coût de
synchronisation pur sans bénéfice.

---

## Statut d'implémentation

**Phase 1 — fait** (`backend/src/modules/auth/permissions.js`) :
`PERMISSION_GROUPS.{web,market,shared}` ajouté, aucun rôle/permission
existant modifié, aucun changement de schéma DB (le `role` reste un ENUM
Sequelize inchangé). `requireWebAdmin` / `requireMarketAdmin` ajoutés dans
`backend/src/middleware/auth.js` — équivalents à `requireSuperAdmin`
aujourd'hui (seul le rôle superadmin porte ces permissions actuellement),
mais vérifient déjà le bon groupe pour rester corrects quand des rôles
`web_admin`/`market_admin` dédiés seront introduits.

**Phase 2 — fait** (`backend/routes/index.js`) : alias additifs
`/api/web-admin/*` et `/api/market-admin/*` montés en plus des chemins
`/api/superadmin/*` existants (inchangés, toujours utilisés par le
frontend actuel). Chaque routeur cible garde son propre
`requireAuth`+`requireSuperAdmin` interne — la nouvelle couche est donc
redondante avec l'accès actuel, sans régression possible. `payments`
(SHARED) est monté dans les deux namespaces plutôt que dupliqué en code.
Vérifié : `node --check` + chargement standalone de `routes/index.js`
(128 routes enregistrées, aucune erreur d'import) — **le process PM2 en
prod n'a pas été redémarré**, ce déploiement reste à décider séparément.

**Phase 3 — fait partiellement** (`frontend/src/shared/components/layout/Sidebar.jsx`) :
la section fourre-tout "Marketplace" (qui mélangeait Discover/Play/GamingHub/
Sports&Kids/Study/Ads/Media/Push — WEB — avec Hero Manager/Acquisition/
Loyalty/Payments/Delivery docs — MARKET) est éclatée en deux sections de nav
distinctes : "Administration Web" et "Administration Marketplace". Item
"Programme Fidélité" déplacé de la section générique "Administration" vers
"Administration Marketplace" (c'est du loyalty, pas de la plateforme). Aucune
route ni fichier déplacé — les 13 URLs référencées (`/discover-admin/*`,
`/admin/play`, `/admin/gaminghub`, etc.) existent toutes déjà, inchangées,
dans `App.jsx`. Vérifié par parsing esbuild du fichier (pas d'erreur de
syntaxe) ; **pas testé dans un navigateur réel** (pas de dev server lancé
dans cette session) — à vérifier visuellement avant de considérer Phase 3
terminée.

**Phase 3 — complétée** (2026-08-06) : `pages/superadmin/` (dossier plat,
19 fichiers) éclaté physiquement en `pages/admin-web/` (16 fichiers —
Discover*, Play, GamingHub, Portals, Study×2, Media×2 (+CSS), PortalArticle
Editor, StoryMediaPanel, DigitalProductsPanel, AdminContentTable, PushTokens)
et `pages/admin-market/` (3 fichiers — Acquisition, DeliveryDocumentsReview,
Payments). `pages/superadmin/` supprimé (vide). Vérifié avant déplacement :
aucun import croisé entre les deux groupes (les seuls imports inter-fichiers
— `AdminContentTable` par `PortalsAdminPage`/`StudyAdminPage`,
`DigitalProductsPanel` par `PortalArticleEditorPage`/`StudyLessonEditorPage`,
`MediaAnalytics` par `MediaCenterPage` — restent tous côté web). Les deux
nouveaux dossiers gardent la même profondeur que `pages/superadmin/`
(`src/pages/<dossier>/`), donc aucun import relatif interne (`../../shared/…`,
`../../hooks/…`) n'a eu besoin d'être réécrit — seuls les 11 chemins
d'import dans `App.jsx` ont changé. \* `PaymentsAdminPage` est en réalité
SHARED (voir Phase 2) mais n'a qu'une seule route/page frontend ; placé dans
`admin-market/` pour matcher son unique entrée de nav ("Paiements" sous
Administration Marketplace).

Vérifié : `esbuild` parse OK sur les 19 fichiers déplacés + `App.jsx`,
puis chargement réel via `vite dev` (chaque fichier déplacé servi en
HTTP 200 à son nouveau chemin, `App.jsx` transformé sans erreur, les 11
nouveaux chemins d'import présents dans la sortie compilée). Dev server
arrêté après vérification, aucun process resté actif.

**Phase 4 — faite** (2026-08-06) : DNS (`admin.ifilino.com` et
`market-admin.ifilino.com` → 91.98.138.100), certificat Let's Encrypt étendu
(`certbot --nginx --cert-name ifilino.com --expand`, SAN couvrant les 4
domaines), nginx rechargé. Vérifié : `dig` résout bien les deux nouveaux
noms, HTTPS répond 200 sur les deux, le cert présente bien les 4 SAN, et
`GET https://market-admin.ifilino.com/api/` répond (même backend Node que
`ifilino.com`, aucun nouveau process). `nginx/ifilino.conf` du dépôt
resynchronisé avec le fichier déployé (Certbot l'a modifié automatiquement).

**Limite connue — résolue** (2026-08-06) : `Sidebar.jsx` filtre maintenant
la nav par `window.location.hostname` via `getAdminDomainScope()` —
`admin.ifilino.com` ne montre plus "Administration Marketplace",
`market-admin.ifilino.com` ne montre plus "Administration Web". `ifilino.com`
et le dev local continuent d'afficher les deux (comportement inchangé pour
les accès existants). Vérifié par parsing esbuild + transform réel via
`vite dev` (module servi en HTTP 200, logique présente dans la sortie
compilée). Pas de route d'atterrissage par défaut différente par domaine
pour l'instant (hors scope, pas demandé) — seule la nav est filtrée.

**Phase 5a — faite** (2026-08-06) : `packages/shared/` (`@ifilino/shared`,
CommonJS, zéro dépendance) créé pour `PERMISSIONS`/`ROLE_LABELS`/
`ASSIGNABLE_ROLES` — jusqu'ici dupliquées à la main entre
`backend/src/modules/auth/permissions.js` et
`frontend/src/modules/core/permissions.js`, et déjà dérivées : le frontend
avait **12 permissions manquantes** (`COMICS_READ/PUBLISH/MODERATE/ADMIN`,
`MEDIA_VIEW/CREATE/UPDATE/DELETE/PUBLISH/RESTORE/ADMIN`,
`PHARMACY_ORDER_MANAGE`), maintenant corrigé. Branché en dépendance locale
`file:../packages/shared` (pas de champ `workspaces` npm à la racine —
`render.yaml` déploie `backend/` et `frontend/` comme deux services
indépendants avec leur propre `package-lock.json`/`npm ci`, statut actif
non confirmé, donc option la plus prudente retenue).

Piège rencontré et corrigé : `packages/shared/index.js` faisait d'abord
`module.exports = { ...require('./permissions') }` — le spread empêche
l'analyse statique CJS de Vite/esbuild (cjs-module-lexer) de détecter les
exports nommés, donc `import { PERMISSIONS } from '@ifilino/shared'` échouait
silencieusement côté frontend (export default vide). Corrigé en exports
nommés statiques. Deuxième piège : Vite résout le symlink `file:` vers son
chemin réel (hors `node_modules/`) et ne le pré-bundle pas par défaut —
ajout de `optimizeDeps.include: ['@ifilino/shared']` dans
`frontend/vite.config.js`. Les deux ont été détectés et vérifiés en
conditions réelles (`vite dev` + Playwright, exécution navigateur, pas
juste un parse statique) — sans cette vérification runtime, le premier
piège en particulier serait passé inaperçu (aucune erreur au build/parse).

`scripts/check-web-market-boundaries.mjs` : garde-fou anti-dérive, scanne
tous les `require()`/`import` relatifs dans `backend/src/modules/*` et
échoue si un module WEB importe un module MARKET ou vice versa. Lancement
manuel (`npm run check:boundaries` depuis `backend/`, ou directement depuis
la racine) — pas de CI existante à brancher automatiquement. A trouvé 3
imports croisés réels au premier lancement : `portalHero` (WEB) réutilise
`marketplaceHero/services/heroSchedulingService.js` et `heroImageService.js`
(MARKET) — le moteur de scheduling/image des hero carousels est
volontairement partagé entre marketplace/store/portails (voir
[[project_hero_premium_animation]]) mais vit physiquement dans
`marketplaceHero/` au lieu d'un module partagé dédié. Documenté comme
exception connue dans le script plutôt que corrigé ici (extraction physique
= Phase 5b) ; le script reste donc un vrai signal "0 violation = propre".

**Non fait (Phase 5b, décision produit à part)** : déplacement physique des
35 modules backend et des dizaines de dossiers frontend dans des arbres
`apps/web/`/`apps/market/` complets, extraction du moteur hero partagé hors
de `marketplaceHero/`, clarification du statut réel de `render.yaml`.

Correction post-vérification : `acquisition` reclassé WEB→MARKET après
lecture du code (voir tableau ci-dessus) — c'est du sourcing de commerces,
pas de contenu éditorial.
