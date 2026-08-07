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

**Phase 5b — un morceau fait** (2026-08-06) : extraction du moteur hero
partagé. `heroSchedulingService.js` et `heroImageService.js` déplacés de
`backend/src/modules/marketplaceHero/services/` vers
`backend/src/shared/services/` (qui existait déjà — `AIService`,
`EmailService`, etc.) et ajoutés à son `index.js`. 7 fichiers consommateurs
mis à jour (`catalog`, `portalHero` ×2, `storeHero` ×2, `marketplace`,
`marketplaceHero` lui-même). `heroAuditService.js`/`heroStatsService.js`
restent dans `marketplaceHero/` — vérifié qu'ils ne sont utilisés que là,
pas partagés. Les exceptions du script de garde-fou (Phase 5a) sont
devenues inutiles et ont été retirées : `check-web-market-boundaries.mjs`
passe maintenant à **zéro exception**, plus seulement zéro violation.
Vérifié : `node --check` sur tous les fichiers touchés, rechargement complet
de `backend/routes/index.js` (128 routes, aucune erreur), et les deux
services fonctionnels via `require('./src/shared/services')`.

**Phase 5b — regroupement physique backend fait** (2026-08-06). Le frein
Render est considéré levé : `/srv/restobook/` (checkout séparé, ~11 mois
sans activité, aucun process PM2, aucune référence nginx, `backend/.env`
réel sans `CORS_ORIGIN`/`ASSET_BASE` Render renseignés, `render.yaml`
jamais retouché depuis le tout premier commit) — faisceau d'indices fort
que ce n'est pas un déploiement actif (pas une certitude à 100%, dashboard
Render non consulté directement).

Les 38 modules de `backend/src/modules/` sont déplacés vers
`backend/src/{web,market,shared}/<module>` — **même profondeur** qu'avant
(`web/X` remplace `modules/X`, pas `web/modules/X`), ce qui préserve tel
quel l'immense majorité des imports existants (`../../models`,
`../../middleware/auth`, imports internes à un module). Fait via
`scripts/migrate-backend-module-tree.mjs`, un codemod dry-run-by-default :
scanne tout `backend/` (pas seulement `src/modules/`), ne réécrit que les
imports relatifs qui résolvent effectivement vers un module déplacé, puis
déplace les dossiers. 88 fichiers / 264 imports réécrits, 38 dossiers
déplacés. Toujours un seul process Node/PM2, un seul `backend/index.js`,
un seul `package.json` — aucun changement de topologie de déploiement.

Classification finale (37→38 en comptant `marketplace` et `reservations`,
absents de la liste MARKET_MODULES utilisée par le script de garde-fou en
Phase 5a — corrigé ici) :
- WEB (12) : discover, comics, gaminghub, play, portals, study, digitalProducts, narration, ai-import, ai-publisher, ads, portalHero
- MARKET (17) : resto, cantine, hanout, pharmacy, pos, delivery, loyalty, orders, catalog, businesses, marketplaceHero, storeHero, reviews, dashboard, acquisition, marketplace, reservations
- SHARED (9) : auth, users, organizations, notifications, media, seo, payments, admin, infra

Vérifié avant commit : recherche de requires dynamiques (aucun trouvé —
condition nécessaire à la fiabilité du codemod), dry-run relancé après
application (0 changement restant = migration stable/idempotente), check
de syntaxe sur les 334 fichiers touchés (333 OK + le script de migration
lui-même en `.mjs`, non concerné), chargement réel de `backend/routes/index.js`
(128 routes, identique à avant), boot-check des 15 requires directs de
`backend/index.js` (schedulers, shims `routes/notifications.js`/
`subscriptions.js`/`public.js`), et `scripts/check-web-market-boundaries.mjs`
réécrit pour la nouvelle arborescence (plus besoin de mapper des noms de
dossier à un groupe — un `require('../../market/...')` depuis `src/web/`
est directement une violation).

**Deuxième exception réelle trouvée** (invisible à l'ancienne version du
script à cause de l'oubli `marketplace`/`reservations` ci-dessus) :
`discover/articleService.js` (WEB) consomme la vraie logique métier
marketplace (`productDetailService`, `productSearchService`) pour permettre
aux articles du magazine de référencer des produits réels — contrairement
au moteur hero, ce n'est pas un utilitaire mal rangé mais un couplage
produit intentionnel. Documenté comme exception connue dans le script ;
décider de le découpler (ex: appel API interne) est une décision produit,
pas prise ici.

Fichiers surprises découverts et vérifiés non-impactants pendant
l'investigation : `backend/src/app.js`/`backend/src/index.js` (code mort,
jamais requis nulle part, PM2 démarre uniquement `backend/index.js` à la
racine — un test lit `src/app.js` comme texte brut pour une assertion, sans
jamais l'exécuter) ; `backend/services/*.js` (shims légers vers
`src/shared/services/`, même famille que `backend/routes/*.js` et
`backend/auth/permissions.js`, déjà gérés correctement par le codemod).

**Non lancé** : les suites `npm run test:*` qui touchent la vraie DB de
prod via `require('../models')` — pas exécutées sans confirmation séparée.

Correction post-vérification : `acquisition` reclassé WEB→MARKET après
lecture du code (voir tableau ci-dessus) — c'est du sourcing de commerces,
pas de contenu éditorial.

---

## Phase 6a — regroupement physique frontend (fait)

Suite du chantier : `frontend/src/{modules,pages,shared/components,config}/*`
déplacé vers `frontend/src/{web,market,shared}/*`. Contrairement au backend,
`modules/` et `pages/` ont **6 collisions de noms** (`gaminghub`, `hanout`,
`marketplace`, `play`, `portals`, `study` existent des deux côtés) — `modules/`
et `pages/` sont donc préservés comme sous-niveaux (`web/modules/X`,
`web/pages/X`) plutôt que fusionnés à plat, ce qui ajoute un niveau de
profondeur pour ce qui en dépendait (donc plus de réécritures que le backend :
251 fichiers, 790 imports, contre 88/264 côté backend).

**Classification** :
- **WEB** : `modules/{ai-command-center,ai-package-import,comics,
  comics-dashboard,gaminghub,gamification,kids-profile,kids-taxonomy,media,
  play,portals,subscriptions}`, `pages/{ads,discover,gaminghub,kids,play,
  portals,study}`, `shared/components/portalHero/` → `web/components/`,
  `shared/markdown/` → `web/markdown/`.
- **MARKET** : `modules/{cantine,hanout,marketplace,resto}`,
  `pages/{dashboard,delivery,hanout,marketplace,marketplaceHero,pharmacy,pos,
  restaurant}` + 27 pages plates (`RestaurantPage`, `CheckoutPage`,
  `OrdersPage`...), `shared/components/{marketplace,storeHero,shopping-list,
  catalog,dashboard,geo}/` → `market/components/`, `config/
  {needCategories,shoppingCategories,businessConfig}.js` → `market/config/`.
- **SHARED** : `modules/{admin,auth,core,notifications}` (admin et
  notifications confirmés morts, voir plus bas), 10 pages plates
  (`LoginPage`, `OrgsPage`, `SubscriptionPage`...), `CustomerAuthContext.jsx`
  extrait de `modules/marketplace/` (session générique, zéro logique panier,
  ~25 importeurs WEB qui le consommaient à travers un module MARKET).
- **`pages/seo/`** éclaté fichier par fichier (7 vues + composants MARKET,
  6 vues WEB, `Breadcrumbs`/`StarRating` → `shared/seo/components/`, seuls
  composants réellement utilisés des deux côtés).

**Outillage** : `scripts/migrate-frontend-module-tree.mjs`, même principe
dry-run/apply que le backend, mais avec une table de correspondance
`[ancien chemin, nouveau chemin]` explicite (fichiers ET dossiers) plutôt
qu'une liste de noms de module — nécessaire pour découper `pages/seo/` fichier
par fichier et extraire `CustomerAuthContext.jsx` isolément.

**Trois bugs réels trouvés en vérifiant en conditions réelles** (aucun
n'était visible au simple parse/dry-run) :
1. Les imports à effet de bord sans liaison (`import "./chemin";`, ex.
   `main.jsx` import du thème markdown) n'étaient pas détectés par la regex
   d'origine (seulement `require(`/`from `/`import(`) — trouvé via `vite dev`
   (500 au chargement).
2. Les déplacements de **fichier isolé** (pages plates, `CustomerAuthContext.jsx`,
   vues SEO) changent la profondeur du fichier lui-même, mais le calcul du
   nouveau dossier ne remappait que le dossier du fichier — jamais le cas
   pour un déplacement de fichier seul. Résultat : ~56 fichiers avec leurs
   propres imports sortants (`../api`, `../hooks/useApi`...) cassés d'un cran.
   Trouvé via `vite dev` (erreurs de résolution en cascade au démarrage).
3. Plusieurs fichiers du repo sont minifiés sans espace
   (`from'../../shared/services/api'`) — la regex exigeait `from\s+` (un
   espace minimum), ratant ces imports. **Ce dernier n'a été trouvé qu'au
   `npm run build` (Rollup)** — ni le dry-run, ni `vite dev` sur les pages
   testées manuellement ne l'avaient révélé, parce que la page cassée
   (`ComicsAccount.jsx`) n'était simplement pas dans l'échantillon testé.
   Confirme la règle ajoutée au plan : un vrai build complet est
   obligatoire, pas seulement le serveur de dev.

Après chaque correction, retour à l'état git propre (`git checkout HEAD --
frontend/` + nettoyage des dossiers orphelins créés par le rename) et
recommencement complet du cycle dry-run→apply→vérification — plus fiable
que rafistoler un état partiellement appliqué avec un bug déjà "cuit" dans
le contenu des fichiers.

**Quatrième exception réelle trouvée en construisant le garde-fou** (en plus
des deux déjà connues côté backend) : `HeroDots.jsx` (indicateurs de slide)
vivait dans `market/components/marketplace/` mais était consommé aussi par
`web/components/portalHero/PortalHeroCarousel.jsx` — même famille que le
moteur hero déjà extrait côté backend. **Extrait vers
`shared/components/hero/HeroDots.jsx`** plutôt que documenté comme
exception, cohérent avec la décision prise sur `heroSchedulingService`/
`heroImageService`.

**Exceptions documentées** (couplages produit intentionnels, pas des
utilitaires mal rangés) dans `scripts/check-web-market-boundaries-frontend.mjs` :
- `discover/ArticlePage.jsx` (WEB) affiche des produits marketplace réels
  liés à l'article (`ProductCard`, MARKET).
- `MarketplacePage.jsx` (MARKET) fait une promo croisée vers Gaming Hub
  (`GamingHubPromoCard`, WEB).
- `BusinessSeoView.jsx` et `RestaurantSeoView.jsx` (MARKET, SEO commerce)
  réutilisent `MagazineArticleCard` du magazine Discover (WEB) pour du
  contenu éditorial lié.

**Vérifié avant commit** : recherche de requires dynamiques (aucun trouvé),
syntaxe sur les 471 fichiers touchés (esbuild), `vite dev` + Playwright sur
plusieurs pages des 3 domaines (0 erreur JS — le seul "problème" observé
était un vrai 400 d'API backend sans rapport), **`npm run build` complet**
(succès, 23.9s), **`npm run build:ssr`** (succès, 6.9s),
`check-web-market-boundaries-frontend.mjs` (0 violation hors les 4
exceptions documentées), `check-web-market-boundaries.mjs` backend relancé
(toujours 0, non affecté).

**Non fait** : `market.ifilino.com` + redirections (Phase 6b, décision
produit à part nécessitant DNS/SSL — voir clarification obtenue en amont de
cette phase), déploiement en prod de ce changement (pas de `npm run build`
suivi de `deploy-frontend.sh` exécuté pour ce lot — à faire séparément,
comme pour toutes les phases précédentes).
