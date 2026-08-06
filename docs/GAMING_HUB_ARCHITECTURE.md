# iFilino Gaming Hub — architecture produit et technique

Statut : blueprint d'implémentation  
Stack cible : React 18 + Vite, Express, MySQL, Sequelize  
Langues : français, anglais, arabe (RTL)  
Principe juridique : contenu éditorial indépendant ; aucun jeu propriétaire distribué

## 1. Décisions structurantes

Le Gaming Hub est un module éditorial distinct de `iFilino Play` :

- `gaming_games` décrit des jeux connus à des fins éditoriales et SEO ; il ne contient jamais d'URL de lancement.
- `play_games` reste l'unique catalogue de jeux effectivement jouables sur iFilino.
- `gaming_similar_html5_games` relie un jeu éditorial à un `play_game` actif avec un score et une justification traduite.
- toutes les pages publiques sont rendues par le pipeline SSR existant pour que les métadonnées et le contenu soient présents sans JavaScript ; les balises ajoutées seulement côté client ne suffisent pas pour ce module.
- les contenus IA sont toujours créés en brouillon, sourcés et validés par un humain avant publication.
- les contenus traduits sont stockés dans des tables de traduction afin d'éviter les colonnes `*_fr`, `*_en`, `*_ar` impossibles à étendre.

Le module vit sous :

```text
backend/src/modules/gaming/
frontend/src/modules/gaming/
frontend/src/pages/gaming/
frontend/src/pages/superadmin/gaming/
```

Il réutilise `PlayChrome`, `GameCard`, le système i18n, `traffic_events`, les composants SEO SSR et les permissions SuperAdmin existantes.

## 2. Architecture des composants

```text
App / BrowserRouter
├── PlayChrome
│   ├── Play (catalogue jouable existant)
│   └── Gaming Hub (éditorial)
│       ├── GamingHubPage
│       │   ├── GamingHero
│       │   ├── EditorialSectionNav
│       │   ├── TrendingRail
│       │   ├── LatestUpdatesRail
│       │   ├── GameOfTheDayCard
│       │   ├── WeeklyTopList
│       │   ├── EditorialCardGrid
│       │   └── PlayGameRail
│       ├── GamingGamePage
│       │   ├── SeoBreadcrumbs
│       │   ├── EditorialGameHero
│       │   ├── LegalAffiliationNotice
│       │   ├── GameFactsPanel
│       │   ├── RichContentSections
│       │   ├── OfficialVideoGallery
│       │   ├── GamingFaq
│       │   ├── RelatedArticles
│       │   ├── ModeratedComments
│       │   └── SimilarPlayableGames (15)
│       ├── GamingArticlePage
│       │   ├── ArticleHeader
│       │   ├── ArticleTableOfContents
│       │   ├── ArticleBody
│       │   ├── RankedGameList
│       │   ├── RelatedGamingGames
│       │   └── RelatedPlayableGames
│       ├── GamingListingPage
│       │   ├── FacetFilters
│       │   ├── SortControl
│       │   └── EditorialCardGrid
│       └── SimilarGameFinderPage
│           ├── FamousGameCombobox
│           ├── MatchingExplanation
│           └── PlayGameGrid (30)
└── PageLayout / SuperAdmin
    └── GamingAdminLayout
        ├── GamingAdminDashboard
        ├── GamingGamesAdminPage
        ├── GamingGameEditorPage
        ├── GamingArticlesAdminPage
        ├── GamingArticleEditorPage
        ├── GamingTaxonomyPage
        ├── GamingSeoManagerPage
        ├── GamingImportPage
        └── GamingAiSuggestionsPage
```

Composants transversaux réutilisables : `ContentStatusBadge`, `LocaleTabs`, `SeoPreview`, `PublishScheduler`, `SourceListEditor`, `OfficialMediaPicker`, `SimilarityScore`, `EditorialDisclaimer`, `JsonLd`, `EmptyState`, `SkeletonGrid` et `Pagination`.

## 3. Routes frontend

| Route | Page | Indexation |
|---|---|---|
| `/gaming` | accueil Gaming Hub | index |
| `/gaming/actualites` | actualités | index |
| `/gaming/guides` | guides et astuces | index |
| `/gaming/mises-a-jour` | mises à jour | index |
| `/gaming/tests` | tests | index |
| `/gaming/classements` | tops et classements | index |
| `/gaming/comparatifs` | comparatifs | index |
| `/gaming/collections` | collections | index |
| `/gaming/jeux-similaires` | moteur de découverte | index |
| `/gaming/jeu/:gameSlug` | fiche éditoriale d'un jeu connu | index |
| `/gaming/:section/:articleSlug` | article | index si publié |
| `/gaming/tag/:tagSlug` | archive de tag | index si contenu suffisant |
| `/gaming/categorie/:categorySlug` | archive de catégorie | index |
| `/superadmin/gaming` | dashboard | noindex + auth |
| `/superadmin/gaming/games` | gestion des jeux éditoriaux | noindex + auth |
| `/superadmin/gaming/games/new` | création | noindex + auth |
| `/superadmin/gaming/games/:id` | édition | noindex + auth |
| `/superadmin/gaming/articles` | gestion des contenus | noindex + auth |
| `/superadmin/gaming/articles/new` | création | noindex + auth |
| `/superadmin/gaming/articles/:id` | édition | noindex + auth |
| `/superadmin/gaming/taxonomy` | catégories et tags | noindex + auth |
| `/superadmin/gaming/seo` | audit SEO | noindex + auth |
| `/superadmin/gaming/import` | import contrôlé | noindex + auth |
| `/superadmin/gaming/ai` | suggestions IA | noindex + auth |

Les URLs canoniques sont sans préfixe de langue pour le français. Les variantes anglaises et arabes utilisent la stratégie i18n déjà retenue par la plateforme ; chaque page expose ses `hreflang` réciproques.

## 4. Schéma SQL

Toutes les tables utilisent `InnoDB`, `utf8mb4_unicode_ci`, des timestamps et des clés étrangères. Les suppressions de taxonomie sont bloquées lorsqu'elles sont référencées ; les relations éditoriales sont supprimées en cascade.

### 4.1 Tables demandées

```sql
CREATE TABLE gaming_publishers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  official_url VARCHAR(500),
  legal_notice VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE gaming_games (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  publisher_id INT UNSIGNED,
  slug VARCHAR(160) NOT NULL UNIQUE,
  canonical_name VARCHAR(180) NOT NULL,
  content_status ENUM('draft','review','scheduled','published','archived') NOT NULL DEFAULT 'draft',
  release_date DATE,
  age_rating VARCHAR(40),
  developer_name VARCHAR(180),
  official_url VARCHAR(500),
  hero_image_url VARCHAR(500),
  gallery JSON,
  min_configuration JSON,
  recommended_configuration JSON,
  trademark_notice VARCHAR(500) NOT NULL,
  is_trending TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME,
  scheduled_at DATETIME,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_gaming_games_status_date (content_status, published_at),
  CONSTRAINT fk_gaming_game_publisher FOREIGN KEY (publisher_id) REFERENCES gaming_publishers(id)
);

CREATE TABLE gaming_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED,
  slug VARCHAR(120) NOT NULL UNIQUE,
  kind ENUM('genre','universe','mechanic','view','difficulty','editorial') NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gaming_category_parent FOREIGN KEY (parent_id) REFERENCES gaming_categories(id)
);

CREATE TABLE gaming_tags (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  tag_group ENUM('genre','universe','mechanic','view','difficulty','theme','audience') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE gaming_platforms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  official_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE gaming_articles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  article_type ENUM('news','guide','tip','update','review','ranking','comparison','similar','top','collection') NOT NULL,
  slug VARCHAR(180) NOT NULL,
  content_status ENUM('draft','review','scheduled','published','archived') NOT NULL DEFAULT 'draft',
  hero_image_url VARCHAR(500),
  author_id INT UNSIGNED,
  ai_generated TINYINT(1) NOT NULL DEFAULT 0,
  human_reviewed_at DATETIME,
  scheduled_at DATETIME,
  published_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gaming_article_slug_type (slug, article_type),
  INDEX idx_gaming_articles_publication (content_status, published_at)
);

CREATE TABLE gaming_news (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  article_id INT UNSIGNED NOT NULL UNIQUE,
  source_url VARCHAR(500) NOT NULL,
  source_name VARCHAR(180) NOT NULL,
  event_date DATETIME,
  embargo_until DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gaming_news_article FOREIGN KEY (article_id) REFERENCES gaming_articles(id) ON DELETE CASCADE
);

CREATE TABLE gaming_updates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id INT UNSIGNED NOT NULL,
  article_id INT UNSIGNED,
  version_label VARCHAR(80),
  release_date DATE NOT NULL,
  official_source_url VARCHAR(500) NOT NULL,
  importance ENUM('minor','major','season','expansion') NOT NULL DEFAULT 'minor',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gaming_update_game FOREIGN KEY (game_id) REFERENCES gaming_games(id),
  CONSTRAINT fk_gaming_update_article FOREIGN KEY (article_id) REFERENCES gaming_articles(id) ON DELETE SET NULL
);

CREATE TABLE gaming_faq (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id INT UNSIGNED,
  article_id INT UNSIGNED,
  locale ENUM('fr','en','ar') NOT NULL,
  question VARCHAR(300) NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_gaming_faq_owner CHECK ((game_id IS NULL) <> (article_id IS NULL)),
  CONSTRAINT fk_gaming_faq_game FOREIGN KEY (game_id) REFERENCES gaming_games(id) ON DELETE CASCADE,
  CONSTRAINT fk_gaming_faq_article FOREIGN KEY (article_id) REFERENCES gaming_articles(id) ON DELETE CASCADE
);

CREATE TABLE gaming_videos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id INT UNSIGNED NOT NULL,
  locale ENUM('fr','en','ar'),
  youtube_video_id VARCHAR(20) NOT NULL,
  official_channel_name VARCHAR(180) NOT NULL,
  official_channel_id VARCHAR(80),
  title VARCHAR(250) NOT NULL,
  thumbnail_url VARCHAR(500),
  sort_order INT NOT NULL DEFAULT 0,
  verified_official TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gaming_video_game_youtube (game_id, youtube_video_id),
  CONSTRAINT fk_gaming_video_game FOREIGN KEY (game_id) REFERENCES gaming_games(id) ON DELETE CASCADE
);

CREATE TABLE gaming_related_games (
  game_id INT UNSIGNED NOT NULL,
  related_game_id INT UNSIGNED NOT NULL,
  relation_type ENUM('similar','sequel','prequel','same_universe','competitor') NOT NULL DEFAULT 'similar',
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  source ENUM('manual','rules','ai') NOT NULL DEFAULT 'rules',
  approved_at DATETIME,
  PRIMARY KEY (game_id, related_game_id),
  CONSTRAINT fk_gaming_related_source FOREIGN KEY (game_id) REFERENCES gaming_games(id) ON DELETE CASCADE,
  CONSTRAINT fk_gaming_related_target FOREIGN KEY (related_game_id) REFERENCES gaming_games(id) ON DELETE CASCADE,
  CONSTRAINT chk_gaming_related_distinct CHECK (game_id <> related_game_id)
);

CREATE TABLE gaming_similar_html5_games (
  gaming_game_id INT UNSIGNED NOT NULL,
  play_game_id INT UNSIGNED NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  matched_dimensions JSON NOT NULL,
  source ENUM('manual','rules','ai') NOT NULL DEFAULT 'rules',
  active TINYINT(1) NOT NULL DEFAULT 1,
  approved_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (gaming_game_id, play_game_id),
  INDEX idx_gaming_similar_rank (gaming_game_id, active, score),
  CONSTRAINT fk_gaming_similar_editorial FOREIGN KEY (gaming_game_id) REFERENCES gaming_games(id) ON DELETE CASCADE,
  CONSTRAINT fk_gaming_similar_play FOREIGN KEY (play_game_id) REFERENCES play_games(id) ON DELETE CASCADE
);
```

### 4.2 Tables complémentaires indispensables

```text
gaming_game_translations     game_id, locale, title, summary, description, popularity,
                             gameplay, universe, seo_title, seo_description
gaming_article_translations  article_id, locale, title, excerpt, body_json, seo_title,
                             seo_description, review_status
gaming_category_translations category_id, locale, name, description, seo fields
gaming_tag_translations      tag_id, locale, name
gaming_game_categories       game_id, category_id
gaming_game_tags             game_id, tag_id, weight
gaming_article_games         article_id, game_id, relation_type, sort_order
gaming_article_categories    article_id, category_id
gaming_article_tags          article_id, tag_id
gaming_game_platforms        game_id, platform_id, release_date, official_url
gaming_content_sources       owner_type, owner_id, source_type, url, publisher, checked_at
gaming_comments              owner_type, owner_id, user_id, body, status, moderation fields
gaming_ai_jobs               job_type, entity_type, entity_id, locale, prompt_version,
                             input_hash, status, result_json, token_usage, reviewed_by
```

`body_json` utilise un schéma de blocs versionné (`paragraph`, `heading`, `image`, `quote`, `game-list`, `play-game-list`, `table`, `callout`) ; aucune chaîne HTML arbitraire n'est stockée sans assainissement.

## 5. Modèles Sequelize et associations

Un fichier par modèle, avec `underscored: true`, timestamps et validation de slug/URL :

```text
GamingGame, GamingGameTranslation, GamingPublisher, GamingPlatform,
GamingCategory, GamingCategoryTranslation, GamingTag, GamingTagTranslation,
GamingArticle, GamingArticleTranslation, GamingNews, GamingUpdate,
GamingFaq, GamingVideo, GamingRelatedGame, GamingSimilarHtml5Game,
GamingContentSource, GamingComment, GamingAiJob
```

Associations principales :

```js
GamingPublisher.hasMany(GamingGame, { as: 'games', foreignKey: 'publisher_id' });
GamingGame.belongsTo(GamingPublisher, { as: 'publisher', foreignKey: 'publisher_id' });
GamingGame.hasMany(GamingGameTranslation, { as: 'translations', foreignKey: 'game_id' });
GamingGame.belongsToMany(GamingTag, { through: 'gaming_game_tags', as: 'tags' });
GamingGame.belongsToMany(GamingCategory, { through: 'gaming_game_categories', as: 'categories' });
GamingGame.belongsToMany(GamingPlatform, { through: 'gaming_game_platforms', as: 'platforms' });
GamingGame.belongsToMany(PlayGame, { through: GamingSimilarHtml5Game, as: 'playableAlternatives' });
GamingArticle.hasMany(GamingArticleTranslation, { as: 'translations', foreignKey: 'article_id' });
GamingArticle.belongsToMany(GamingGame, { through: 'gaming_article_games', as: 'games' });
```

Les modèles sont enregistrés dans `backend/models/index.js`, mais toute la logique métier reste dans `backend/src/modules/gaming/services`, jamais dans les routes.

## 6. API REST

### Publique — `/api/gaming`

| Méthode | Endpoint | Usage |
|---|---|---|
| GET | `/home?locale=fr` | blocs du hub, tendances, nouveautés, tops |
| GET | `/games?category=&tag=&q=&page=` | recherche paginée |
| GET | `/games/:slug?locale=fr` | fiche complète publiée |
| GET | `/games/:slug/similar-playable?limit=15` | alternatives `play_games` actives |
| GET | `/games/:slug/related` | jeux éditoriaux liés |
| GET | `/articles?type=&category=&tag=&page=` | listing publié |
| GET | `/articles/:type/:slug?locale=fr` | article publié |
| GET | `/trending` | jeux/articles tendances |
| GET | `/updates` | dernières mises à jour |
| GET | `/finder/options?q=` | jeux disponibles dans le sélecteur |
| GET | `/finder/:slug?limit=30` | résultat de découverte HTML5 |
| GET | `/categories` | taxonomie publique |
| POST | `/comments` | commentaire soumis à modération |

Les GET publics reçoivent `ETag`, cache public court et pagination bornée. Les commentaires ont rate limit, validation, protection anti-spam et ne sont jamais publiés automatiquement.

### Administration — `/api/superadmin/gaming`

CRUD : `/games`, `/articles`, `/news`, `/updates`, `/categories`, `/tags`, `/publishers`, `/platforms`, `/faqs`, `/videos`, `/comments`.

Actions métier :

```text
POST /games/:id/publish
POST /games/:id/schedule
POST /articles/:id/publish
POST /articles/:id/schedule
POST /articles/generate-ranking
POST /similarity/recompute/:gameId
PUT  /similarity/:gameId/approve
POST /ai/generate
POST /ai/jobs/:id/apply-draft
POST /imports/preview
POST /imports/commit
GET  /seo/audit
GET  /stats
```

Les actions sont protégées par `requireAuth`, `requireSuperAdmin`, permission `GAMING_MANAGE`, journal d'audit et validation stricte des champs autorisés. `preview` est obligatoire avant tout import.

## 7. Moteur de similarité

Le calcul n'utilise pas le nom du jeu comme raccourci. Il compare six dimensions normalisées :

```text
genre 30 % · mécaniques 25 % · univers 15 % · tags 10 %
vue 10 % · difficulté 10 %
```

Score additionnel limité : popularité iFilino `+5`, mobile compatible `+3`, fraîcheur `+2`. Seuls les `play_games.active = true` dont le fournisseur est actif/licencié sont éligibles.

```js
score = weightedJaccard(editorialVector, playVector);
reason = topSharedDimensions(scoreBreakdown, locale);
```

Le résultat est pré-calculé dans `gaming_similar_html5_games`, approuvé et recalculé lors d'un changement de tags. Le service public effectue un dernier filtre de disponibilité puis retourne 15 ou 30 résultats. Si moins de 15 correspondances fiables existent, l'interface affiche le nombre réel plutôt que des résultats trompeurs.

## 8. Articles automatiques

`rankingService` produit un brouillon à partir de modèles éditoriaux versionnés :

- `top-by-category` : « Top 20 des MMORPG » ;
- `games-like` : « 15 jeux comme Minecraft » ;
- `best-by-trait` : stratégie, difficulté, détente, enfants, coopération, réflexion, horreur, survie ;
- `most-played` : alimenté par `play_sessions` et `traffic_events`, avec période explicite ;
- `comparison` : matrice de critères éditoriaux déclarés.

Chaque entrée doit avoir une justification, des sources, une date de vérification et au moins un lien interne. Un article ne peut être publié que s'il contient : une traduction complète, une image autorisée, deux sources, des métadonnées SEO uniques et une validation humaine.

## 9. Service IA

```text
backend/src/modules/gaming/services/ai/
├── gamingAiService.js
├── promptRegistry.js
├── groundingService.js
├── generationValidator.js
├── similarityAiService.js
└── seoAiService.js
```

Capacités : résumé, description, FAQ, plan/article, comparatif, métadonnées et suggestions. Le service réutilise le fournisseur IA partagé, mais impose :

- entrée exclusivement constituée de données internes et de sources autorisées ;
- sortie JSON selon un schéma par type de génération ;
- citations conservées dans `gaming_content_sources` ;
- détection des affirmations non sourcées, marques, URLs et dates ;
- refus de produire une URL de jeu propriétaire ou de prétendre à une affiliation ;
- idempotence par `input_hash` et `prompt_version` ;
- quotas, timeout, journalisation sans données personnelles ;
- état final `draft`, jamais `published`.

## 10. SEO et SSR

Extension du pipeline actuel :

```text
backend/src/modules/seo/
├── gamingMetaGenerator.js
├── gamingSchemaGenerator.js
├── gamingPublicDataService.js
└── ssrRouter.js (nouvelles routes gaming)

frontend/src/pages/seo/
├── GamingHubSeoView.jsx
├── GamingGameSeoView.jsx
├── GamingArticleSeoView.jsx
└── GamingArchiveSeoView.jsx
```

Schémas :

- hub/archive : `CollectionPage`, `ItemList`, `BreadcrumbList` ;
- jeu : `VideoGame` (pas `SoftwareApplication` si non jouable), `FAQPage`, `BreadcrumbList` ;
- article : `Article` ou `NewsArticle`, `ItemList` pour les tops, `FAQPage` si FAQ visible ;
- vidéos : `VideoObject` uniquement pour les vidéos officielles intégrées.

Règles : un seul H1, canonical absolu, OpenGraph/Twitter, dates ISO, auteur, `dateModified`, images 1200×630, liens `hreflang`, sitemap gaming segmenté et pagination canonique. Les filtres arbitraires, previews, brouillons, recherche interne et pages pauvres sont `noindex`.

Les données structurées doivent correspondre exactement au contenu visible. Aucun `AggregateRating` sans notes réelles vérifiables.

## 11. UX et design system

Le Hub prolonge l'identité sombre de Play avec des tokens, sans surcharge de scanlines/glows sur le texte éditorial : fond `#0F0F23`, primaire `#7C3AED`, accent CTA `#F43F5E`, texte `#E2E8F0`. Les polices actuelles de Play restent prioritaires pour éviter une rupture de marque et un coût de chargement supplémentaire.

Principes :

- contenu principal lisible sur 65–75 caractères ;
- navigation Gaming Hub limitée aux rubriques essentielles, le reste dans « Plus » ;
- cartes image avec ratio réservé, WebP/AVIF et lazy loading ;
- grilles 1/2/3/4 colonnes aux paliers 375/768/1024/1440 ;
- cibles tactiles de 44 px minimum, focus visible et navigation clavier ;
- skeleton au-delà de 300 ms, états vide/erreur avec action ;
- RTL réel en arabe, pas seulement texte aligné à droite ;
- `prefers-reduced-motion`, absence de carrousel auto imposé ;
- bouton principal des alternatives : « Jouer sur iFilino Play » ;
- mention non-officielle immédiatement visible près du hero et des médias.

## 12. Conformité juridique et éditoriale

Chaque page affiche : « iFilino est un média indépendant et n'est ni affilié ni approuvé par [éditeur]. Les marques citées appartiennent à leurs propriétaires respectifs. »

Garde-fous obligatoires :

- aucune ROM, APK, iframe, téléchargement ou lien de lancement propriétaire ;
- logos seulement avec licence/autorisation documentée ; sinon couverture éditoriale originale ou image officiellement réutilisable ;
- vidéos YouTube provenant d'un canal officiel vérifié et intégrées selon les conditions YouTube ;
- registre de provenance, licence et date de vérification pour chaque média ;
- procédure de retrait, contact ayant droit et historique de modération ;
- distinction visuelle entre avis éditorial, information officielle et contenu sponsorisé.

## 13. Phases et priorités

### P0 — fondations et conformité (1 sprint)

Migration idempotente, modèles, associations, permission `GAMING_MANAGE`, registre de sources/médias, contrats API, tests de non-régression Play. Aucun contenu public.

### P1 — MVP SEO (2 sprints)

Hub, fiches jeux, catégories/tags, SSR, sitemap, métadonnées, FAQ, vidéos officielles, SuperAdmin jeux, FR complet. Seed éditorial limité à 5–10 fiches vérifiées.

### P2 — conversion vers Play (1 sprint)

Enrichissement taxonomique de `play_games`, moteur de similarité, bloc de 15 alternatives, finder de 30 jeux, analytics clic → lancement. C'est la priorité produit après l'indexabilité.

### P3 — articles et administration éditoriale (2 sprints)

Articles, news, guides, tops, comparatifs, planification, preview, commentaires modérés, relations internes, tableau SEO.

### P4 — IA assistée (1–2 sprints)

Jobs asynchrones, génération structurée, validation, suggestions, articles automatiques en brouillon, audit des sources et coût.

### P5 — internationalisation et optimisation (1 sprint)

EN/AR, RTL, hreflang, Core Web Vitals, cache, tests accessibilité, expérimentation des CTA et tableaux de conversion.

### P6 — industrialisation continue

Import contrôlé, rafraîchissement des nouveautés, alertes de contenu périmé, analyse Search Console, nettoyage des pages pauvres et extension graduelle du catalogue.

## 14. Critères d'acceptation et non-régression

- une fiche célèbre ne peut lancer ni distribuer le jeu cité ;
- les alternatives ne contiennent que des jeux Play actifs et autorisés ;
- toute page publiée possède canonical, description, OG/Twitter, breadcrumb et JSON-LD valide ;
- sitemap exclut brouillons, archives et previews ;
- publication impossible sans mention juridique, source et traduction principale ;
- aucune sortie IA n'est publiée sans revue humaine ;
- FR/EN/AR n'affichent aucune clé brute et l'arabe est RTL ;
- Lighthouse cible : SEO 100, accessibilité ≥95, CLS <0,1, LCP <2,5 s au p75 ;
- API publiques paginées, bornées, mises en cache et testées contre injections/abus ;
- suites Play, authentification, marketplace, SSR existant et SuperAdmin restent vertes.

## 15. Arborescence de livraison

```text
backend/
├── models/gaming*.js
├── scripts/migrate_gaming_hub.js
├── src/modules/gaming/
│   ├── routes.js
│   ├── adminRoutes.js
│   ├── validators/
│   └── services/
└── tests/gaming_*.test.js
frontend/src/
├── modules/gaming/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── gaming.css
├── pages/gaming/
├── pages/superadmin/gaming/
├── pages/seo/Gaming*SeoView.jsx
└── i18n/locales/{fr,en,ar}/gaming.json
```

Cette séparation permet de livrer chaque phase indépendamment et de désactiver le Gaming Hub par feature flag sans affecter le catalogue jouable.
